"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/hooks/use-session";
import { initials } from "@/lib/format";
import { UsersPanel } from "@/components/settings/users-panel";

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(false);
  const { data: session } = useSession();
  const user = session?.user;

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <>
      <Topbar />
      <PageContent>
        <div className="grid grid-cols-2 gap-[18px] items-start">
          <Card>
            <CardContent className="p-5">
              <div className="font-display font-semibold text-[15.5px]">Appearance</div>
              <div className="text-[12.5px] text-muted-foreground mb-1">Personalize how Audix looks on your device.</div>
              <div className="flex items-center justify-between py-3 border-t border-border">
                <div>
                  <div className="font-semibold text-[13.5px]">Dark mode</div>
                  <div className="text-[12px] text-text-faint">Switch between light and dark themes</div>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleTheme}>
                  {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                  {isDark ? "Enable Light" : "Enable Dark"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="font-display font-semibold text-[15.5px]">How Risk Scoring Works</div>
              <div className="text-[12.5px] text-muted-foreground mb-3">
                Every discrepancy is flagged, no matter how small — 0.5 hours or $1 off still gets caught. The risk
                score ranks how much attention a flagged invoice needs; it doesn't decide whether something gets
                flagged in the first place.
              </div>
              <div className="flex flex-col gap-2.5">
                <ThresholdRow label="0–19" value="Approved" tone="success" />
                <ThresholdRow label="20–74" value="Flagged" tone="warning" />
                <ThresholdRow label="75–99" value="High Risk" tone="danger" />
              </div>
              <div className="text-[11.5px] text-text-faint mt-3">
                Score = sum of severity weights across every flagged check (Critical 40 · High 25 · Medium 15 · Low
                8), capped at 99.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="font-display font-semibold text-[15.5px]">Your Profile</div>
              <div className="text-[12.5px] text-muted-foreground mb-1">Account details for this workspace.</div>
              <div className="flex items-center gap-3 py-2.5">
                <div className="size-11 rounded-full bg-gradient-to-br from-indigo to-primary text-white flex items-center justify-center text-[15px] font-bold">
                  {user ? initials(user.name) : "—"}
                </div>
                <div>
                  <div className="font-bold text-[14px]">{user?.name ?? "…"}</div>
                  <div className="text-[12px] text-text-faint">
                    {user?.email} · {user?.role === "ADMIN" ? "Admin" : "Reviewer"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="col-span-2">
            <UsersPanel />
          </div>
        </div>
      </PageContent>
    </>
  );
}

function ThresholdRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger";
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger";
  return (
    <div className="flex justify-between text-[13px] px-3 py-2 bg-secondary rounded-lg">
      <span className="font-mono">{label}</span>
      <span className={`font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}
