import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "../lib/queryClient";

export const authorKeys = {
  all: ["authors"],
  list: (params) => [...authorKeys.all, "list", params],
};

export function useAuthors(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.offset != null) searchParams.set("offset", String(params.offset));
  if (params.q) searchParams.set("q", params.q);
  const queryString = searchParams.toString();

  return useQuery({
    queryKey: authorKeys.list(params),
    queryFn: () =>
      fetchWithAuth(`/api/v1/authors${queryString ? `?${queryString}` : ""}`),
    select: (data) => data.authors || [],
  });
}
