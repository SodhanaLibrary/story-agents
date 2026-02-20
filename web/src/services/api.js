/**
 * Centralized API service that automatically includes user context
 */

const STORAGE_KEY = "story_agents_user";

// Callback for handling auth failures (set by AuthContext)
let onAuthFailure = null;

/**
 * Set the auth failure handler (called by AuthContext)
 */
export function setAuthFailureHandler(handler) {
  onAuthFailure = handler;
}

// Get user ID from localStorage
function getUserId() {
  try {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user.id || user.dbUser?.id || null;
    }
  } catch (e) {
    console.error("Error getting user ID:", e);
  }
  return null;
}

// Build headers with user context
function buildHeaders(customHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  const userId = getUserId();
  if (userId) {
    headers["X-User-Id"] = userId.toString();
  }

  return headers;
}

/**
 * Handle auth failure - clear storage and trigger callback
 */
function handleAuthFailure() {
  console.warn("API auth failure detected, clearing session");
  localStorage.removeItem(STORAGE_KEY);
  if (onAuthFailure) {
    onAuthFailure();
  }
}

/** Call from react-query fetch layer on 401 so logout runs */
export function triggerAuthFailure() {
  handleAuthFailure();
}

/**
 * Wrapper around fetch that automatically includes user context
 * Also handles 401 responses by triggering logout
 */
export async function apiFetch(url, options = {}) {
  const headers = buildHeaders(options.headers);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle auth failures (401 Unauthorized)
  // Skip for auth endpoints to avoid loops
  if (response.status === 401 && !url.includes("/api/auth/")) {
    handleAuthFailure();
  }

  return response;
}

/**
 * GET request with user context
 */
export async function get(url, options = {}) {
  return apiFetch(url, { ...options, method: "GET" });
}

/**
 * POST request with user context
 */
export async function post(url, body, options = {}) {
  return apiFetch(url, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * PUT request with user context
 */
export async function put(url, body, options = {}) {
  return apiFetch(url, {
    ...options,
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * PATCH request with user context
 */
export async function patch(url, options = {}) {
  return apiFetch(url, { ...options, method: "PATCH" });
}

/**
 * DELETE request with user context
 */
export async function del(url, options = {}) {
  return apiFetch(url, { ...options, method: "DELETE" });
}

/**
 * POST with FormData (for file uploads)
 */
export async function postFormData(url, formData, options = {}) {
  const headers = {};
  const userId = getUserId();
  if (userId) {
    headers["X-User-Id"] = userId.toString();
  }

  return fetch(url, {
    ...options,
    method: "POST",
    headers: { ...headers, ...options.headers },
    body: formData,
  });
}

export default {
  fetch: apiFetch,
  get,
  post,
  put,
  patch,
  del,
  postFormData,
  getUserId,
  setAuthFailureHandler,
  triggerAuthFailure,
};
