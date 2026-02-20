import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "../lib/queryClient";

export const planKeys = { all: ["plans"], status: () => [...planKeys.all, "status"] };

export function usePlansStatus() {
  return useQuery({
    queryKey: planKeys.status(),
    queryFn: () => fetchWithAuth("/api/plans/status"),
  });
}
