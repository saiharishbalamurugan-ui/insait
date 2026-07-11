import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { TimesheetItem } from "@/lib/types";

export function useTimesheets() {
  return useQuery<TimesheetItem[]>({
    queryKey: ["timesheets"],
    queryFn: () => apiClient.get<TimesheetItem[]>("/timesheets"),
  });
}
