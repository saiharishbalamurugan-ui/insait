import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useChatSend() {
  return useMutation({
    mutationFn: ({ message, invoiceId }: { message: string; invoiceId?: string }) =>
      apiClient.post<{ available: boolean; reply: string }>("/chat", { message, invoiceId }),
  });
}
