import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "../lib/queryClient";

// Query keys for cache management
export const storyKeys = {
  all: ["stories"],
  lists: () => [...storyKeys.all, "list"],
  list: (filters) => [...storyKeys.lists(), filters],
  feed: (userId) => [...storyKeys.all, "feed", userId],
  search: (query) => [...storyKeys.all, "search", query],
  details: () => [...storyKeys.all, "detail"],
  detail: (id) => [...storyKeys.details(), id],
};

/**
 * Fetch all stories or search stories
 */
export function useStories(searchQuery = "") {
  return useQuery({
    queryKey: searchQuery ? storyKeys.search(searchQuery) : storyKeys.lists(),
    queryFn: () => {
      const url = searchQuery
        ? `/api/stories?q=${encodeURIComponent(searchQuery)}`
        : "/api/stories";
      return fetchWithAuth(url);
    },
    select: (data) => data.stories || [],
  });
}

/**
 * Fetch personalized feed for authenticated user
 */
export function useFeed(userId) {
  return useQuery({
    queryKey: storyKeys.feed(userId),
    queryFn: () => fetchWithAuth(`/api/feed?userId=${userId}`),
    enabled: !!userId,
    select: (data) => data.stories || [],
  });
}

/**
 * Fetch a single story by ID
 */
export function useStory(storyId) {
  return useQuery({
    queryKey: storyKeys.detail(storyId),
    queryFn: () => fetchWithAuth(`/api/stories/${storyId}`),
    enabled: !!storyId,
  });
}

/**
 * Create a new story
 */
export function useCreateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyData) =>
      fetchWithAuth("/api/stories", {
        method: "POST",
        body: JSON.stringify(storyData),
      }),
    onSuccess: () => {
      // Invalidate stories list to refetch
      queryClient.invalidateQueries({ queryKey: storyKeys.lists() });
    },
  });
}

/**
 * Delete a story
 */
export function useDeleteStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId) =>
      fetchWithAuth(`/api/stories/${storyId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.lists() });
    },
  });
}

/**
 * Publish a draft as a story
 */
export function usePublishStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyData) =>
      fetchWithAuth("/api/stories/publish", {
        method: "POST",
        body: JSON.stringify(storyData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.lists() });
    },
  });
}
