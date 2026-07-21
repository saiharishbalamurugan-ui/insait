"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { APP_FULL_NAME } from "@/lib/brand";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong");
        setIsPending(false);
        return;
      }
      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — try again.");
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[360px]">
        <CardContent className="p-6">
          <div className="flex flex-col items-center mb-5">
            <div className="bg-white rounded-lg px-3 py-2.5 mb-3">
              <Image src="/logo.jpg" alt="INSAIT Solutions" width={350} height={107} className="h-8 w-auto" priority />
            </div>
            <div className="font-display font-semibold text-[15px]">{APP_FULL_NAME}</div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3.5">
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
                placeholder="Enter the shared password"
              />
            </div>
            {error && <div className="text-[12.5px] text-danger">{error}</div>}
            <Button type="submit" className="w-full gap-1.5" disabled={isPending || !password}>
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
