"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clearSessionToken } from "@/lib/session-token";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "REVIEWER";
}

export function useSession() {
  return useQuery<{ user: SessionUser | null }>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/session");
      if (res.status === 401) return { user: null };
      return res.json();
    },
    staleTime: Infinity,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    await fetch("/api/logout", { method: "POST" });
    clearSessionToken();
    queryClient.clear();
    window.location.href = "/login";
  };
}
