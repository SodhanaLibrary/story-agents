import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setAuthFailureHandler } from "../services/api";
import { fetchWithAuth } from "../lib/queryClient";
import {
  useLoginGoogle,
  useLoginEmail,
  useSignup,
  useVerifyEmail,
  useForgotPassword,
  useResetPassword,
  useChangePassword,
} from "../hooks/useAuthApi";

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

  const loginGoogleMutation = useLoginGoogle();
  const loginEmailMutation = useLoginEmail();
  const signupMutation = useSignup();
  const verifyEmailMutation = useVerifyEmail();
  const forgotPasswordMutation = useForgotPassword();
  const resetPasswordMutation = useResetPassword();
  const changePasswordMutation = useChangePassword();

  // Verify session with server (uses X-User-Id from localStorage via fetchWithAuth)
  const verifySession = useCallback(async () => {
    try {
      const data = await fetchWithAuth("/api/auth/verify");
      return data.valid && data.user ? data.user : false;
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
            const serverUser = await verifySession();
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

  const login = useCallback(
    async (credential) => {
      try {
        const userData = await loginGoogleMutation.mutateAsync(credential);
        setUser(userData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        return userData;
      } catch (error) {
        console.error("Login error:", error);
        const base64Url = credential.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(base64));
        setUser(payload);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        return payload;
      }
    },
    [loginGoogleMutation]
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /** Login with email and password. Stores user and returns same shape as login(). */
  const loginWithEmail = useCallback(
    async (email, password) => {
      const userData = await loginEmailMutation.mutateAsync({ email, password });
      setUser(userData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return userData;
    },
    [loginEmailMutation]
  );

  /** Sign up with email, name, password. Does not log in; user must verify email then login. */
  const signup = useCallback(
    async (email, name, password) => {
      return signupMutation.mutateAsync({ email, name, password });
    },
    [signupMutation]
  );

  /** Verify email with token (from link). Returns { verified, user } or throws. */
  const verifyEmail = useCallback(
    async (token) => verifyEmailMutation.mutateAsync(token),
    [verifyEmailMutation]
  );

  /** Request password reset email. */
  const forgotPassword = useCallback(
    async (email) => forgotPasswordMutation.mutateAsync(email),
    [forgotPasswordMutation]
  );

  /** Reset password with token from email. */
  const resetPassword = useCallback(
    async (token, newPassword) =>
      resetPasswordMutation.mutateAsync({ token, newPassword }),
    [resetPasswordMutation]
  );

  /** Change password (authenticated). */
  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!user?.id && !user?.dbUser?.id) throw new Error("Not logged in");
      return changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
    },
    [user, changePasswordMutation]
  );

  // Refresh user from server (e.g. after plan upgrade)
  const refreshUser = useCallback(async () => {
    const userId = user?.id || user?.dbUser?.id;
    if (!userId) return;
    try {
      const data = await fetchWithAuth("/api/users/me");
      const updated = {
        ...user,
        dbUser: { ...(user?.dbUser || {}), ...data },
        plan: data.plan,
        role: data.role,
      };
      setUser(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
