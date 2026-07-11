import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { InvoiceListItem } from "@/lib/types";

export function useInvoices(params?: { status?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();

  return useQuery<InvoiceListItem[]>({
    queryKey: ["invoices", params?.status ?? "all", params?.search ?? ""],
    queryFn: () => apiClient.get<InvoiceListItem[]>(`/invoices${qs ? `?${qs}` : ""}`),
  });
}
