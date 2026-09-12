import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "REVIEWER";
  status: "INVITED" | "ACTIVE" | "DEACTIVATED";
  lastLoginAt: string | null;
  createdAt: string;
}

export function useUsers() {
  return useQuery<ManagedUser[]>({
    queryKey: ["users"],
    queryFn: () => apiClient.get<ManagedUser[]>("/users"),
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; role: "ADMIN" | "REVIEWER" }) =>
      apiClient.post<{ user: ManagedUser; inviteUrl: string }>("/users/invite", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ inviteUrl: string }>(`/users/${id}/resend-invite`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ ok: boolean }>(`/users/${id}/revoke-invite`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch<ManagedUser>(`/users/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiClient.post<{ ok: boolean }>(`/users/${id}/reset-password`, { password }),
  });
}
