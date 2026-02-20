import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setAuthFailureHandler } from "../services/api";

const AuthContext = createContext(null);

const STORAGE_KEY = "story_agents_user";

// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
  'user': 1,
  'premium-user': 2,
  'admin': 3,
  'super-admin': 4,
};

/**
 * Check if a role has at least the required permission level
 */
function hasRoleLevel(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verify session with server; returns user data if valid so we can merge into stored user
  const verifySession = useCallback(async (userId) => {
    try {
      const response = await fetch("/api/auth/verify", {
        headers: { "X-User-Id": userId.toString() },
      });
      if (response.ok) {
        const data = await response.json();
        return data.valid && data.user ? data.user : false;
      }
      return false;
    } catch (error) {
      console.error("Session verification failed:", error);
      return false;
    }
  }, []);

  // Load user from localStorage on mount and verify with server
  useEffect(() => {
    const loadAndVerifyUser = async () => {
      try {
        const storedUser = localStorage.getItem(STORAGE_KEY);
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          const userId = parsedUser.id || parsedUser.dbUser?.id;
          // Valid if: we have userId and (email login has no exp, or exp is in future)
          const hasValidExp = !parsedUser.exp || parsedUser.exp * 1000 > Date.now();
          if (userId && hasValidExp) {
            const serverUser = await verifySession(userId);
            if (serverUser) {
              const merged = {
                ...parsedUser,
                dbUser: { ...(parsedUser.dbUser || {}), ...serverUser },
              };
              setUser(merged);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } else {
              console.warn("Server session invalid, clearing local storage");
              localStorage.removeItem(STORAGE_KEY);
            }
          } else {
            if (!userId) localStorage.removeItem(STORAGE_KEY);
            else if (!hasValidExp) localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error("Failed to load user from storage:", error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadAndVerifyUser();
  }, [verifySession]);

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

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /** Login with email and password. Stores user and returns same shape as login(). */
  const loginWithEmail = useCallback(async (email, password) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }
    const dbUser = data.user;
    const userData = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      picture: dbUser.picture,
      dbUser: { ...dbUser },
      exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60, // 10 years for session check
    };
    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    return userData;
  }, []);

  /** Sign up with email, name, password. Does not log in; user must verify email then login. */
  const signup = useCallback(async (email, name, password) => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), name: (name || "").trim() || undefined, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Signup failed");
    }
    return data;
  }, []);

  /** Verify email with token (from link). Returns { verified, user } or throws. */
  const verifyEmail = useCallback(async (token) => {
    const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Verification failed");
    }
    return data;
  }, []);

  /** Request password reset email. */
  const forgotPassword = useCallback(async (email) => {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }, []);

  /** Reset password with token from email. */
  const resetPassword = useCallback(async (token, newPassword) => {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Reset failed");
    }
    return data;
  }, []);

  /** Change password (authenticated). */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const userId = user?.id || user?.dbUser?.id;
    if (!userId) throw new Error("Not logged in");
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": String(userId) },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Change password failed");
    }
    return data;
  }, [user]);

  // Refresh user from server (e.g. after plan upgrade)
  const refreshUser = useCallback(async () => {
    const userId = user?.id || user?.dbUser?.id;
    if (!userId) return;
    try {
      const response = await fetch("/api/users/me", {
        headers: { "X-User-Id": String(userId) },
      });
      if (response.ok) {
        const data = await response.json();
        const updated = {
          ...user,
          dbUser: { ...(user?.dbUser || {}), ...data },
          plan: data.plan,
          role: data.role,
        };
        setUser(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.error("Refresh user failed:", e);
    }
  }, [user]);

  // Register auth failure handler with API service
  useEffect(() => {
    setAuthFailureHandler(logout);
    return () => setAuthFailureHandler(null);
  }, [logout]);

  // Get user role and plan from dbUser or defaults
  const userRole = user?.dbUser?.role || user?.role || 'user';
  const userPlan = user?.dbUser?.plan || user?.plan || 'free';

  // Role checking helpers
  const isAdmin = hasRoleLevel(userRole, 'admin');
  const isSuperAdmin = userRole === 'super-admin';
  const isPremium = hasRoleLevel(userRole, 'premium-user');
  const isPro = userPlan === 'pro';

  const value = {
    user,
    userId: user?.id || user?.dbUser?.id || null,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithEmail,
    signup,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    logout,
    refreshUser,
    // Role & plan
    role: userRole,
    plan: userPlan,
    isAdmin,
    isSuperAdmin,
    isPremium,
    isPro,
    hasRole: (requiredRole) => hasRoleLevel(userRole, requiredRole),
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
