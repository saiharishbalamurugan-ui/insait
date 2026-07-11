"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, HealthCheckResult } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

function StatusBadge({ ok, loading }: { ok: boolean | undefined; loading: boolean }) {
  if (loading) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Loader2 className="size-3.5 animate-spin" />
        Checking
      </Badge>
    );
  }
  if (ok) {
    return (
      <Badge className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600">
        <CheckCircle2 className="size-3.5" />
        Healthy
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1.5">
      <XCircle className="size-3.5" />
      Unavailable
    </Badge>
  );
}

export default function Home() {
  const {
    data: backendHealth,
    isLoading,
    isError,
  } = useQuery<HealthCheckResult>({
    queryKey: ["backend-health"],
    queryFn: () => apiClient.get<HealthCheckResult>("/health"),
    refetchInterval: 5000,
  });

  const frontendOk = true; // this page rendering at all proves the frontend is up
  const backendOk = !isError && backendHealth?.status === "ok";
  const dbOk = backendHealth?.services.database.ok;
  const redisOk = backendHealth?.services.redis.ok;

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Audix</h1>
          <p className="text-muted-foreground">Phase 0 — local foundation status</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System health</CardTitle>
            <CardDescription>
              Live checks against the frontend, backend API, database, and cache.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Frontend</p>
                <p className="text-sm text-muted-foreground">Next.js app router</p>
              </div>
              <StatusBadge ok={frontendOk} loading={false} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Backend API</p>
                <p className="text-sm text-muted-foreground">NestJS · /health</p>
              </div>
              <StatusBadge ok={backendOk} loading={isLoading} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Database</p>
                <p className="text-sm text-muted-foreground">PostgreSQL via Prisma</p>
              </div>
              <StatusBadge ok={dbOk} loading={isLoading} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Cache / Queue</p>
                <p className="text-sm text-muted-foreground">Redis</p>
              </div>
              <StatusBadge ok={redisOk} loading={isLoading} />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
