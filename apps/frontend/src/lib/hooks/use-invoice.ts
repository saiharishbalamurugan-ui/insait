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

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actorName, actorUserId }: { id: string; actorName?: string; actorUserId?: string }) => {
      const params = new URLSearchParams();
      if (actorName) params.set("actorName", actorName);
      if (actorUserId) params.set("actorUserId", actorUserId);
      const qs = params.toString();
      return apiClient.delete<{ deleted: boolean }>(`/invoices/${id}${qs ? `?${qs}` : ""}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["approval-counts"] });
    },
  });
}

export function useBulkDeleteInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.post<{ deleted: number }>("/invoices/bulk-delete", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
