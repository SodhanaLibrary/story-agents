import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "story_agents_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY);
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Check if token is still valid (basic check)
        if (parsedUser.exp && parsedUser.exp * 1000 > Date.now()) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to load user from storage:", error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (credential) => {
    try {
      // Decode JWT locally for basic info
      const base64Url = credential.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64));

      // Authenticate with backend to get/create database user
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      if (response.ok) {
        const data = await response.json();
        const userData = {
          ...payload,
          id: data.user.id, // Database user ID
          dbUser: data.user,
        };
        setUser(userData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        console.log("User logged in, ID saved in context:", data.user.id);
        return userData;
      } else {
        // Fallback to just JWT data if backend auth fails
        setUser(payload);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        return payload;
      }
    } catch (error) {
      console.error("Login error:", error);
      // Still allow login with just Google data
      const base64Url = credential.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64));
      setUser(payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return payload;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = {
    user,
    userId: user?.id || user?.dbUser?.id || null,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
