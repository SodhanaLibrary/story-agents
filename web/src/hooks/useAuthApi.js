import { useMutation } from "@tanstack/react-query";
import { fetchNoAuth, fetchWithAuth } from "../lib/queryClient";

export const authKeys = { all: ["auth"] };

export function useLoginGoogle() {
  return useMutation({
    mutationKey: [...authKeys.all, "google"],
    mutationFn: async (credential) => {
      const base64Url = credential.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64));
      const data = await fetchNoAuth("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      if (data.user) {
        return { ...payload, id: data.user.id, dbUser: data.user };
      }
      return payload;
    },
  });
}

export function useLoginEmail() {
  return useMutation({
    mutationKey: [...authKeys.all, "login"],
    mutationFn: async ({ email, password }) => {
      const data = await fetchNoAuth("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const dbUser = data.user;
      const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60;
      return { id: dbUser.id, email: dbUser.email, name: dbUser.name, picture: dbUser.picture, dbUser: { ...dbUser }, exp };
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationKey: [...authKeys.all, "signup"],
    mutationFn: ({ email, name, password }) =>
      fetchNoAuth("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), name: (name || "").trim() || undefined, password }),
      }),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationKey: [...authKeys.all, "verifyEmail"],
    mutationFn: (token) =>
      fetchNoAuth(`/api/auth/verify-email?token=${encodeURIComponent(token)}`),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationKey: [...authKeys.all, "forgotPassword"],
    mutationFn: (email) =>
      fetchNoAuth("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationKey: [...authKeys.all, "resetPassword"],
    mutationFn: ({ token, newPassword }) =>
      fetchNoAuth("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationKey: [...authKeys.all, "changePassword"],
    mutationFn: ({ currentPassword, newPassword }) =>
      fetchWithAuth("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  });
}
