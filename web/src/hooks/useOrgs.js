import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "../lib/queryClient";

export const orgKeys = {
  all: ["orgs"],
  list: () => [...orgKeys.all, "list"],
  detail: (id) => [...orgKeys.all, "detail", id],
};

export function useOrgs(options = {}) {
  return useQuery({
    queryKey: orgKeys.list(),
    queryFn: () => fetchWithAuth("/api/orgs"),
    select: (data) => data.organizations || [],
    enabled: options.enabled !== false,
  });
}

export function useOrg(orgId) {
  return useQuery({
    queryKey: orgKeys.detail(orgId),
    queryFn: () => fetchWithAuth(`/api/orgs/${orgId}`),
    enabled: !!orgId,
  });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      fetchWithAuth("/api/orgs", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.list() });
    },
  });
}

export function useUpdateOrg(orgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      fetchWithAuth(`/api/orgs/${orgId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.list() });
      qc.invalidateQueries({ queryKey: orgKeys.detail(orgId) });
    },
  });
}

export function useAddOrgMember(orgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email) =>
      fetchWithAuth(`/api/orgs/${orgId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.detail(orgId) });
    },
  });
}

export function useRemoveOrgMember(orgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId) =>
      fetchWithAuth(`/api/orgs/${orgId}/members/${memberId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.detail(orgId) });
    },
  });
}

export function useSetOrgMemberRole(orgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }) =>
      fetchWithAuth(`/api/orgs/${orgId}/members/${memberId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.detail(orgId) });
    },
  });
}

export function useLeaveOrg(orgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/orgs/${orgId}/leave`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.list() });
    },
  });
}
