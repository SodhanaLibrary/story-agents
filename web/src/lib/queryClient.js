import { QueryClient } from "@tanstack/react-query";
import { triggerAuthFailure } from "../services/api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 5 minutes - data is considered fresh for this duration
      staleTime: 5 * 60 * 1000,
      // Cache time: 10 minutes - unused data is garbage collected after this
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      // Refetch on window focus (good for keeping data fresh)
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

// Helper function to get user ID from localStorage for authenticated requests
export function getUserId() {
  try {
    const user = localStorage.getItem("story_agents_user");
    if (user) {
      const parsed = JSON.parse(user);
      return parsed.id || parsed.dbUser?.id || null;
    }
  } catch (e) {
    console.error("Error getting user ID:", e);
  }
  return null;
}

// Default fetch function with auth headers (for use with react-query)
export async function fetchWithAuth(url, options = {}) {
  const userId = getUserId();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (userId) {
    headers["X-User-Id"] = userId.toString();
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && !String(url).includes("/api/v1/auth/")) {
    triggerAuthFailure();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/** Fetch without auth header (for login, signup, forgot-password, etc.) */
export async function fetchNoAuth(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}
