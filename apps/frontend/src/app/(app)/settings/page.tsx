"use client";

import { useEffect, useState } from "react";
import { Database, Mail, Bell, Moon, Sun } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

const INTEGRATIONS = [
  { name: "QuickBooks Online", desc: "Approved timesheets & payroll sync", status: "Connected", icon: Database },
  { name: "Vendor Email Inbox", desc: "invoices@company-ap.com", status: "Connected", icon: Mail },
  { name: "Slack Notifications", desc: "#finance-alerts channel", status: "Connected", icon: Bell },
];

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(false);

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
              <div className="font-display font-semibold text-[15.5px]">Connected Systems</div>
              <div className="text-[12.5px] text-muted-foreground mb-1">Integrations powering automated invoice auditing.</div>
              {INTEGRATIONS.map((i) => (
                <div key={i.name} className="flex items-center gap-3 py-3 border-t border-border">
                  <div className="size-[34px] rounded-[9px] bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                    <i.icon className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[13.5px]">{i.name}</div>
                    <div className="text-[12px] text-text-faint">{i.desc}</div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-[3px] rounded-full bg-success-soft text-success">
                    <span className="size-1.5 rounded-full bg-success" />
                    {i.status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="font-display font-semibold text-[15.5px]">Audit Thresholds</div>
              <div className="text-[12.5px] text-muted-foreground mb-3">Risk scoring rules applied to every invoice.</div>
              <div className="flex flex-col gap-2.5">
                <ThresholdRow label="Flag when hours variance exceeds" value="2 hrs" />
                <ThresholdRow label="High-risk overpayment threshold" value={money(1500)} />
                <ThresholdRow label="Auto-hold payment on High Risk" value="Enabled" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="font-display font-semibold text-[15.5px]">Your Profile</div>
              <div className="text-[12.5px] text-muted-foreground mb-1">Account details for this workspace.</div>
              <div className="flex items-center gap-3 py-2.5">
                <div className="size-11 rounded-full bg-gradient-to-br from-indigo to-primary text-white flex items-center justify-center text-[15px] font-bold">
                  JM
                </div>
                <div>
                  <div className="font-bold text-[14px]">Jordan Meyers</div>
                  <div className="text-[12px] text-text-faint">jordan.meyers@company.com · AP Finance Lead</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}

function ThresholdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px] px-3 py-2 bg-secondary rounded-lg">
      <span>{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
