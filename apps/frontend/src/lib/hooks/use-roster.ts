import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { RosterEntry } from "@/lib/types";
import { useMonthContext } from "@/lib/hooks/use-month";

export function useRoster() {
  const { selectedMonth } = useMonthContext();
  return useQuery<RosterEntry[]>({
    queryKey: ["roster", selectedMonth],
    queryFn: () => apiClient.get<RosterEntry[]>(`/roster${selectedMonth ? `?month=${selectedMonth}` : ""}`),
    enabled: selectedMonth !== null,
  });
}

export interface RosterUploadResult {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  results: { employeeName: string; ok: boolean; error?: string }[];
}

export function useUploadRoster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiClient.postFormData<RosterUploadResult>("/roster/upload", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
    },
  });
}
