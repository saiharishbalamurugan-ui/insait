import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ReportItem } from "@/lib/types";
import { useMonthContext } from "@/lib/hooks/use-month";

export function useReports() {
  const { selectedMonth } = useMonthContext();
  return useQuery<ReportItem[]>({
    queryKey: ["reports", selectedMonth],
    queryFn: () => apiClient.get<ReportItem[]>(`/reports${selectedMonth ? `?month=${selectedMonth}` : ""}`),
    enabled: selectedMonth !== null,
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
