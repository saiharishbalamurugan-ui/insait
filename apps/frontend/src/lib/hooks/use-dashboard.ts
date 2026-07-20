import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DashboardStats } from "@/lib/types";
import { useMonthContext } from "@/lib/hooks/use-month";

export function useDashboardStats() {
  const { selectedMonth } = useMonthContext();
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", selectedMonth],
    queryFn: () => apiClient.get<DashboardStats>(`/dashboard/stats${selectedMonth ? `?month=${selectedMonth}` : ""}`),
    enabled: selectedMonth !== null,
  });
}
