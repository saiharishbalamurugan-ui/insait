import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { CreateInvoicePayload, ExtractedInvoiceData, CheckResult, InvoiceDetail } from "@/lib/types";

export function useExtractInvoice() {
  return useMutation({
    mutationFn: ({ file, receivedDate }: { file: File; receivedDate: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("receivedDate", receivedDate);
      return apiClient.postFormData<ExtractedInvoiceData>("/invoices/extract", formData);
    },
  });
}

export function useRecomputeChecks() {
  return useMutation({
    mutationFn: (data: Omit<ExtractedInvoiceData, "checks" | "uploadedAt">) =>
      apiClient.post<{ checks: CheckResult[] }>("/invoices/recompute-checks", data),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInvoicePayload) => apiClient.post<InvoiceDetail>("/invoices", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
