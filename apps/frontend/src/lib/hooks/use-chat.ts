import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useMonthContext } from "@/lib/hooks/use-month";

export function useChatSend() {
  const { selectedMonth } = useMonthContext();
  return useMutation({
    mutationFn: ({ message, invoiceId }: { message: string; invoiceId?: string }) =>
      apiClient.post<{ available: boolean; reply: string }>("/chat", { message, invoiceId, month: selectedMonth }),
  });
}
