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

// Keep in sync with apps/backend/src/roster/column-matcher.ts
export type RosterField =
  | "name"
  | "hours"
  | "rate"
  | "billRate"
  | "weekStart"
  | "weekEnd"
  | "country"
  | "project"
  | "manager"
  | "vendor"
  | "client";

export const REQUIRED_ROSTER_FIELDS: RosterField[] = ["name", "hours", "rate"];

export const ROSTER_FIELD_LABELS: Record<RosterField, string> = {
  name: "Consultant Name",
  hours: "Approved Hours",
  rate: "Pay Rate",
  billRate: "Bill Rate",
  vendor: "Vendor",
  client: "Client",
  weekStart: "Week Start",
  weekEnd: "Week End",
  country: "Country",
  project: "Project",
  manager: "Manager",
};

export interface RosterUploadResult {
  needsMapping: false;
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  results: { employeeName: string; ok: boolean; error?: string }[];
}

export interface RosterUploadNeedsMapping {
  needsMapping: true;
  headers: string[];
  detectedMapping: Partial<Record<RosterField, string>>;
  missingFields: RosterField[];
  sampleRows: Record<string, unknown>[];
}

export function useUploadRoster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, mapping }: { file: File; mapping?: Partial<Record<RosterField, string>> }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (mapping) formData.append("mapping", JSON.stringify(mapping));
      return apiClient.postFormData<RosterUploadResult | RosterUploadNeedsMapping>("/roster/upload", formData);
    },
    onSuccess: (result) => {
      if (!result.needsMapping) {
        queryClient.invalidateQueries({ queryKey: ["roster"] });
      }
    },
  });
}
