"use client";

import Link from "next/link";
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

const NAV_ITEMS = [
  { key: "dashboard", href: "/", label: "Dashboard", icon: LayoutGrid },
  { key: "invoices", href: "/invoices", label: "Invoices", icon: FileText },
  { key: "inbox", href: "/inbox", label: "Email Inbox", icon: Mail },
  { key: "roster", href: "/roster", label: "Consultant Roster", icon: Users },
  { key: "audit", href: "/audit", label: "AI Audit", icon: ShieldCheck },
  { key: "reports", href: "/reports", label: "Reports", icon: ClipboardList },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { data: invoices } = useInvoices();

  const inboxCount = invoices?.filter((i) => i.status === "PENDING" || i.status === "PROCESSING").length ?? 0;
  const auditCount = invoices?.filter((i) => i.riskLabel === "Flagged" || i.riskLabel === "High Risk").length ?? 0;

  return (
    <aside className="w-[232px] shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 py-[22px] pb-[18px]">
        <div className="size-8 rounded-[9px] bg-gradient-to-br from-primary to-indigo flex items-center justify-center text-white shrink-0">
          <ShieldCheck className="size-4" strokeWidth={2.2} />
        </div>
        <div>
          <div className="font-display font-bold text-[17px] tracking-tight leading-none">Audix</div>
          <div className="text-[10.5px] text-text-faint uppercase tracking-wider mt-0.5">Invoice Auditor</div>
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
        <div>
          <div className="text-[12.5px] font-semibold leading-tight">Jordan Meyers</div>
          <div className="text-[11px] text-text-faint leading-tight">AP Finance Lead</div>
        </div>
      </div>
    </aside>
  );
}
