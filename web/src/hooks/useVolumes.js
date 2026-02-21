import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "../lib/queryClient";
import { userKeys } from "./useUser";

export const volumeKeys = {
  all: ["volumes"],
  byUser: (userId) => [...volumeKeys.all, "user", userId],
  detail: (volumeId) => [...volumeKeys.all, "detail", volumeId],
  stories: (volumeId) => [...volumeKeys.all, "stories", volumeId],
};

export function useVolumes(userId) {
  return useQuery({
    queryKey: volumeKeys.byUser(userId),
    queryFn: () => fetchWithAuth(`/api/v1/users/${userId}/volumes`),
    enabled: !!userId,
    select: (data) => data.volumes || [],
  });
}

export function useVolume(volumeId) {
  return useQuery({
    queryKey: volumeKeys.detail(volumeId),
    queryFn: () => fetchWithAuth(`/api/v1/volumes/${volumeId}`),
    enabled: !!volumeId,
  });
}

export function useVolumeStories(volumeId) {
  return useQuery({
    queryKey: volumeKeys.stories(volumeId),
    queryFn: () => fetchWithAuth(`/api/v1/volumes/${volumeId}/stories`),
    enabled: !!volumeId,
    select: (data) => data.stories || [],
  });
}

export function useCreateVolume(userId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      fetchWithAuth(`/api/v1/users/${userId}/volumes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (_, __, context) => {
      qc.invalidateQueries({ queryKey: volumeKeys.byUser(userId) });
    },
  });
}

export function useUpdateVolume(userId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ volumeId, ...body }) =>
      fetchWithAuth(`/api/v1/volumes/${volumeId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: volumeKeys.byUser(userId) });
    },
  });
}

export function useDeleteVolume(userId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (volumeId) =>
      fetchWithAuth(`/api/v1/volumes/${volumeId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: volumeKeys.byUser(userId) });
    },
  });
}
