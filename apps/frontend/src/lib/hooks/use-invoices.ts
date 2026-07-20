import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { InvoiceListItem } from "@/lib/types";
import { useMonthContext } from "@/lib/hooks/use-month";

export function useInvoices(params?: { status?: string; search?: string }) {
  const { selectedMonth } = useMonthContext();
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (selectedMonth) query.set("month", selectedMonth);
  const qs = query.toString();

  return useQuery<InvoiceListItem[]>({
    queryKey: ["invoices", params?.status ?? "all", params?.search ?? "", selectedMonth],
    queryFn: () => apiClient.get<InvoiceListItem[]>(`/invoices${qs ? `?${qs}` : ""}`),
    enabled: selectedMonth !== null,
  });
}
