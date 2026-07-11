import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ReportItem } from "@/lib/types";

export function useReports() {
  return useQuery<ReportItem[]>({
    queryKey: ["reports"],
    queryFn: () => apiClient.get<ReportItem[]>("/reports"),
  });
}

export function useReportAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, action }: { reportId: string; action: "APPROVED" | "REJECTED" | "CLARIFICATION_REQUESTED" }) =>
      apiClient.post(`/reports/${reportId}/action`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["invoice"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
