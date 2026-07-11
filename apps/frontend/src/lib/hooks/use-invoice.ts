import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { InvoiceDetail } from "@/lib/types";

export function useInvoice(id: string, options?: { refetchInterval?: number | false }) {
  return useQuery<InvoiceDetail>({
    queryKey: ["invoice", id],
    queryFn: () => apiClient.get<InvoiceDetail>(`/invoices/${id}`),
    enabled: Boolean(id),
    refetchInterval: options?.refetchInterval,
  });
}

export function useTriggerAudit(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ jobId: string; status: string }>(`/invoices/${id}/audit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
