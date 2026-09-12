"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MailWarning } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { APP_FULL_NAME } from "@/lib/brand";
import { apiClient, ApiError } from "@/lib/api-client";
import { setSessionToken } from "@/lib/session-token";

interface InviteInfo {
  name: string;
  email: string;
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const invite = useQuery<InviteInfo, ApiError>({
    queryKey: ["invite", token],
    queryFn: () => apiClient.get<InviteInfo>(`/auth/invite/${encodeURIComponent(token)}`),
    enabled: !!token,
    retry: false,
  });

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch("/api/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong");
        setIsPending(false);
        return;
      }
      setSessionToken(data.token);
      router.replace("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — try again.");
      setIsPending(false);
    }
  }

  const notFound = !token || invite.error?.status === 404;
  const expired = invite.error?.status === 410;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[380px]">
        <CardContent className="p-6">
          <div className="flex flex-col items-center mb-5">
            <div className="bg-white rounded-lg px-3 py-2.5 mb-3">
              <Image src="/logo.jpg" alt="INSAIT Solutions" width={350} height={107} className="h-8 w-auto" priority />
            </div>
            <div className="font-display font-semibold text-[15px]">{APP_FULL_NAME}</div>
          </div>

          {invite.isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}

          {!invite.isLoading && (notFound || expired) && (
            <div className="text-center py-4">
              <div className="size-11 rounded-full bg-danger-soft text-danger flex items-center justify-center mx-auto mb-3">
                <MailWarning className="size-5" />
              </div>
              <div className="font-display font-semibold text-[14.5px] mb-1">
                {expired ? "This invite link has expired" : "This invite link isn't valid"}
              </div>
              <div className="text-[12.5px] text-text-faint">
                Ask your Admin to resend a new invite from Settings &gt; Users.
              </div>
            </div>
          )}

          {!invite.isLoading && invite.data && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="rounded-lg bg-secondary px-3 py-2.5 text-[13px]">
                <div className="font-semibold">{invite.data.name}</div>
                <div className="text-muted-foreground">{invite.data.email}</div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[12px] text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-[12px] text-muted-foreground">
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                />
              </div>
              {error && <div className="text-[12.5px] text-danger">{error}</div>}
              <Button type="submit" className="w-full gap-1.5" disabled={isPending || !password || !confirmPassword}>
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Set Password &amp; Sign In
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
