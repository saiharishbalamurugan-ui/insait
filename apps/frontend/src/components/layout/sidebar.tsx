"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FileText,
  Mail,
  Users,
  ShieldCheck,
  ClipboardList,
  Settings,
} from "lucide-react";
import { useInvoices } from "@/lib/hooks/use-invoices";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";
import { FEATURES } from "@/lib/feature-flags";

const ALL_NAV_ITEMS = [
  { key: "dashboard", href: "/", label: "Dashboard", icon: LayoutGrid },
  { key: "invoices", href: "/invoices", label: "Invoices", icon: FileText },
  { key: "inbox", href: "/inbox", label: "Email Inbox", icon: Mail, feature: "emailInbox" as const },
  { key: "roster", href: "/roster", label: "Consultant Roster", icon: Users },
  { key: "audit", href: "/audit", label: "AI Audit", icon: ShieldCheck },
  { key: "reports", href: "/reports", label: "Reports", icon: ClipboardList },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
] as const;

const NAV_ITEMS = ALL_NAV_ITEMS.filter((item) => !("feature" in item) || FEATURES[item.feature]);

export function Sidebar() {
  const pathname = usePathname();
  const { data: invoices } = useInvoices();

  const inboxCount = invoices?.filter((i) => i.status === "PENDING" || i.status === "PROCESSING").length ?? 0;
  const auditCount = invoices?.filter((i) => i.riskLabel === "Flagged" || i.riskLabel === "High Risk").length ?? 0;

  return (
    <aside className="w-[232px] shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-[22px] pb-[18px]">
        <div className="bg-white rounded-lg px-3 py-2.5 inline-block mb-2.5">
          <Image src="/logo.jpg" alt="INSAIT Solutions" width={350} height={107} className="h-11 w-auto" priority />
        </div>
        <div>
          <div className="font-display font-bold text-[17px] tracking-tight leading-none">{APP_NAME}</div>
          <div className="text-[10.5px] text-text-faint uppercase tracking-wider mt-0.5">Invoice Reconciliation</div>
        </div>
      </div>

      <nav className="px-3 py-1.5">
        <div className="text-[10.5px] uppercase tracking-wider text-text-faint font-semibold px-3 pt-3.5 pb-1.5">
          Workspace
        </div>
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const count = item.key === "inbox" ? inboxCount : item.key === "audit" ? auditCount : 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-[9px] rounded-[8px] text-[13.5px] font-medium mb-0.5 transition-colors",
                active
                  ? "bg-brand-soft text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-[17px] shrink-0" strokeWidth={2} />
              <span>{item.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "ml-auto text-[11px] font-mono px-1.5 py-0.5 rounded-full",
                    active ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-3.5 border-t border-sidebar-border flex items-center gap-2.5">
        <div className="size-[30px] rounded-full bg-gradient-to-br from-indigo to-primary text-white flex items-center justify-center text-[12px] font-semibold shrink-0">
          JM
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold leading-tight">Jordan Meyers</div>
          <div className="text-[11px] text-text-faint leading-tight">AP Finance Lead</div>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="text-[11px] text-text-faint hover:text-foreground shrink-0"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
