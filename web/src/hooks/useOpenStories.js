import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "../lib/queryClient";

export const openStoryKeys = {
  all: ["open-stories"],
  list: () => [...openStoryKeys.all, "list"],
  detail: (id) => [...openStoryKeys.all, "detail", id],
  comments: (id) => [...openStoryKeys.all, "comments", id],
};

export function useOpenStoriesList() {
  return useQuery({
    queryKey: openStoryKeys.list(),
    queryFn: () => fetchWithAuth("/api/open-stories"),
    select: (data) => data.submissions || [],
  });
}

export function useOpenStory(id) {
  return useQuery({
    queryKey: openStoryKeys.detail(id),
    queryFn: () => fetchWithAuth(`/api/open-stories/${id}`),
    enabled: !!id,
  });
}

export function useOpenStoryComments(submissionId) {
  return useQuery({
    queryKey: openStoryKeys.comments(submissionId),
    queryFn: () => fetchWithAuth(`/api/open-stories/${submissionId}/comments`),
    enabled: !!submissionId,
    select: (data) => data.comments || [],
  });
}

export function useCreateOpenStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      fetchWithAuth("/api/open-stories", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openStoryKeys.list() });
    },
  });
}

export function useUpdateOpenStory(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      fetchWithAuth(`/api/open-stories/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openStoryKeys.list() });
      qc.invalidateQueries({ queryKey: openStoryKeys.detail(id) });
    },
  });
}

export function useDeleteOpenStory(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/open-stories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openStoryKeys.list() });
    },
  });
}

export function useVoteOpenStory(submissionId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/open-stories/${submissionId}/vote`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openStoryKeys.detail(submissionId) });
      qc.invalidateQueries({ queryKey: openStoryKeys.list() });
    },
  });
}

export function usePostOpenStoryComment(submissionId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      fetchWithAuth(`/api/open-stories/${submissionId}/comments`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openStoryKeys.comments(submissionId) });
      qc.invalidateQueries({ queryKey: openStoryKeys.detail(submissionId) });
    },
  });
}

export function useUpdateOpenStoryComment(submissionId, commentId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      fetchWithAuth(`/api/open-stories/${submissionId}/comments/${commentId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openStoryKeys.comments(submissionId) });
      qc.invalidateQueries({ queryKey: openStoryKeys.detail(submissionId) });
    },
  });
}

export function useDeleteOpenStoryComment(submissionId, commentId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/open-stories/${submissionId}/comments/${commentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openStoryKeys.comments(submissionId) });
      qc.invalidateQueries({ queryKey: openStoryKeys.detail(submissionId) });
    },
  });
}

export function useOpenStoryImages(submissionId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ image }) =>
      fetchWithAuth(`/api/open-stories/${submissionId}/images`, {
        method: "POST",
        body: JSON.stringify({ image }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openStoryKeys.detail(submissionId) });
    },
  });
}

export function useDeleteOpenStoryImage(submissionId, imageId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/open-stories/${submissionId}/images/${imageId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: openStoryKeys.detail(submissionId) });
    },
  });
}
