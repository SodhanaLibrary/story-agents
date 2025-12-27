/**
 * Centralized API service that automatically includes user context
 */

// Get user ID from localStorage
function getUserId() {
  try {
    const storedUser = localStorage.getItem("story_agents_user");
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
 * Wrapper around fetch that automatically includes user context
 */
export async function apiFetch(url, options = {}) {
  const headers = buildHeaders(options.headers);

  const response = await fetch(url, {
    ...options,
    headers,
  });

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
  del,
  postFormData,
  getUserId,
};
