import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApprovalCounts, InvoiceListItem } from "@/lib/types";
import { useMonthContext } from "@/lib/hooks/use-month";

export function useInvoices(params?: { status?: string; approvalStatus?: string; search?: string; enabled?: boolean }) {
  const { selectedMonth } = useMonthContext();
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.approvalStatus) query.set("approvalStatus", params.approvalStatus);
  if (params?.search) query.set("search", params.search);
  if (selectedMonth) query.set("month", selectedMonth);
  const qs = query.toString();

  return useQuery<InvoiceListItem[]>({
    queryKey: ["invoices", params?.status ?? "all", params?.approvalStatus ?? "all", params?.search ?? "", selectedMonth],
    queryFn: () => apiClient.get<InvoiceListItem[]>(`/invoices${qs ? `?${qs}` : ""}`),
    enabled: selectedMonth !== null && params?.enabled !== false,
  });
}

// Separate queryKey (not "invoices") so approving/rejecting the current invoice — which
// invalidates ["invoices"] — doesn't refetch this mid-review and knock the invoice the
// reviewer is looking at out of the list before they've had a chance to click "Next".
export function useApprovalQueue(approvalStatus?: string | null) {
  const { selectedMonth } = useMonthContext();
  const query = new URLSearchParams();
  if (approvalStatus) query.set("approvalStatus", approvalStatus);
  if (selectedMonth) query.set("month", selectedMonth);
  const qs = query.toString();

  return useQuery<InvoiceListItem[]>({
    queryKey: ["invoice-queue", approvalStatus ?? "none", selectedMonth],
    queryFn: () => apiClient.get<InvoiceListItem[]>(`/invoices${qs ? `?${qs}` : ""}`),
    enabled: selectedMonth !== null && !!approvalStatus,
    staleTime: Infinity,
  });
}

export function useApprovalCounts() {
  const { selectedMonth } = useMonthContext();
  return useQuery<ApprovalCounts>({
    queryKey: ["approval-counts", selectedMonth],
    queryFn: () => apiClient.get<ApprovalCounts>(`/invoices/approval-counts${selectedMonth ? `?month=${selectedMonth}` : ""}`),
    enabled: selectedMonth !== null,
  });
}
