import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { RosterEntry } from "@/lib/types";

export function useRoster() {
  return useQuery<RosterEntry[]>({
    queryKey: ["roster"],
    queryFn: () => apiClient.get<RosterEntry[]>("/roster"),
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
