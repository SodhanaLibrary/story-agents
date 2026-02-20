import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "../lib/queryClient";

// Query keys for user-related data
export const userKeys = {
  all: ["user"],
  profile: (userId) => [...userKeys.all, "profile", userId],
  stories: (userId, viewerId) => [...userKeys.all, "stories", userId, viewerId],
  favorites: (userId) => [...userKeys.all, "favorites", userId],
  favoriteIds: (userId) => [...userKeys.all, "favorite-ids", userId],
  reading: (userId) => [...userKeys.all, "reading", userId],
  drafts: (userId) => [...userKeys.all, "drafts", userId],
  followers: (userId) => [...userKeys.all, "followers", userId],
  following: (userId) => [...userKeys.all, "following", userId],
};

/**
 * Fetch user profile
 */
export function useUserProfile(userId) {
  return useQuery({
    queryKey: userKeys.profile(userId),
    queryFn: () => fetchWithAuth(`/api/users/${userId}/profile`),
    enabled: !!userId,
    select: (data) => data.profile,
  });
}

/**
 * Fetch user's favorite stories
 */
export function useFavorites(userId) {
  return useQuery({
    queryKey: userKeys.favorites(userId),
    queryFn: () => fetchWithAuth(`/api/users/${userId}/favorites`),
    enabled: !!userId,
    select: (data) => data.favorites || [],
  });
}

/**
 * Fetch user's favorite story IDs (for quick lookup)
 */
export function useFavoriteIds(userId) {
  return useQuery({
    queryKey: userKeys.favoriteIds(userId),
    queryFn: () => fetchWithAuth(`/api/users/${userId}/favorite-ids`),
    enabled: !!userId,
    select: (data) => new Set(data.favoriteIds || []),
  });
}

/**
 * Fetch currently reading stories
 */
export function useCurrentlyReading(userId) {
  return useQuery({
    queryKey: userKeys.reading(userId),
    queryFn: () => fetchWithAuth(`/api/users/${userId}/reading`),
    enabled: !!userId,
    select: (data) => data.reading || [],
  });
}

/**
 * Add story to favorites
 */
export function useAddFavorite(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId) =>
      fetchWithAuth(`/api/users/${userId}/favorites`, {
        method: "POST",
        body: JSON.stringify({ storyId }),
      }),
    onMutate: async (storyId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: userKeys.favoriteIds(userId),
      });

      // Snapshot previous value
      const previousIds = queryClient.getQueryData(
        userKeys.favoriteIds(userId)
      );

      // Optimistically update
      queryClient.setQueryData(userKeys.favoriteIds(userId), (old) => ({
        favoriteIds: [...(old?.favoriteIds || []), storyId],
      }));

      return { previousIds };
    },
    onError: (err, storyId, context) => {
      // Rollback on error
      queryClient.setQueryData(
        userKeys.favoriteIds(userId),
        context.previousIds
      );
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: userKeys.favorites(userId) });
      queryClient.invalidateQueries({ queryKey: userKeys.favoriteIds(userId) });
    },
  });
}

/**
 * Remove story from favorites
 */
export function useRemoveFavorite(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId) =>
      fetchWithAuth(`/api/users/${userId}/favorites/${storyId}`, {
        method: "DELETE",
      }),
    onMutate: async (storyId) => {
      await queryClient.cancelQueries({
        queryKey: userKeys.favoriteIds(userId),
      });

      const previousIds = queryClient.getQueryData(
        userKeys.favoriteIds(userId)
      );

      // Optimistically remove
      queryClient.setQueryData(userKeys.favoriteIds(userId), (old) => ({
        favoriteIds: (old?.favoriteIds || []).filter((id) => id !== storyId),
      }));

      return { previousIds };
    },
    onError: (err, storyId, context) => {
      queryClient.setQueryData(
        userKeys.favoriteIds(userId),
        context.previousIds
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.favorites(userId) });
      queryClient.invalidateQueries({ queryKey: userKeys.favoriteIds(userId) });
    },
  });
}

/**
 * Update reading progress
 */
export function useUpdateReadingProgress(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ storyId, progress, currentPage }) =>
      fetchWithAuth(`/api/users/${userId}/reading/${storyId}`, {
        method: "PUT",
        body: JSON.stringify({ progress, currentPage }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.reading(userId) });
    },
  });
}

/**
 * Fetch user's drafts
 */
export function useDrafts(userId) {
  return useQuery({
    queryKey: userKeys.drafts(userId),
    queryFn: () => fetchWithAuth(`/api/drafts?userId=${userId}`),
    enabled: !!userId,
    select: (data) => data.drafts || [],
  });
}

/**
 * Follow a user (targetUserId = user to follow, currentUserId = follower)
 */
export function useFollowUser(currentUserId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId) =>
      fetchWithAuth(`/api/users/${targetUserId}/follow`, {
        method: "POST",
        body: JSON.stringify({ followerId: currentUserId }),
      }),
    onSuccess: (_, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: userKeys.following(currentUserId) });
      queryClient.invalidateQueries({ queryKey: userKeys.followers(targetUserId) });
      queryClient.invalidateQueries({ queryKey: userKeys.profile(targetUserId) });
    },
  });
}

/**
 * Unfollow a user
 */
export function useUnfollowUser(currentUserId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId) =>
      fetchWithAuth(`/api/users/${targetUserId}/follow?followerId=${currentUserId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: userKeys.following(currentUserId) });
      queryClient.invalidateQueries({ queryKey: userKeys.followers(targetUserId) });
      queryClient.invalidateQueries({ queryKey: userKeys.profile(targetUserId) });
    },
  });
}

/**
 * Check if current user is following target user
 */
export function useIsFollowing(currentUserId, targetUserId) {
  return useQuery({
    queryKey: [...userKeys.all, "is-following", currentUserId, targetUserId],
    queryFn: () =>
      fetchWithAuth(`/api/users/${currentUserId}/is-following/${targetUserId}`),
    enabled: !!currentUserId && !!targetUserId && currentUserId !== targetUserId,
    select: (data) => data.isFollowing,
  });
}

/**
 * Fetch user's public stories (for profile page)
 */
export function useUserStories(userId, viewerId) {
  return useQuery({
    queryKey: userKeys.stories(userId, viewerId),
    queryFn: () =>
      fetchWithAuth(
        `/api/users/${userId}/stories?viewerId=${viewerId || ""}`
      ),
    enabled: !!userId,
    select: (data) => data.stories || [],
  });
}

/**
 * Fetch user's followers
 */
export function useFollowers(userId) {
  return useQuery({
    queryKey: userKeys.followers(userId),
    queryFn: () => fetchWithAuth(`/api/users/${userId}/followers`),
    enabled: !!userId,
    select: (data) => data.followers || [],
  });
}

/**
 * Fetch user's following
 */
export function useFollowing(userId) {
  return useQuery({
    queryKey: userKeys.following(userId),
    queryFn: () => fetchWithAuth(`/api/users/${userId}/following`),
    enabled: !!userId,
    select: (data) => data.following || [],
  });
}

/**
 * Update user profile
 */
export function useUpdateProfile(userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      fetchWithAuth(`/api/users/${userId}/profile`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userKeys.profile(userId) });
    },
  });
}

/**
 * Delete a draft
 */
export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId) =>
      fetchWithAuth(`/api/drafts/${jobId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user", "drafts"],
      });
    },
  });
}
