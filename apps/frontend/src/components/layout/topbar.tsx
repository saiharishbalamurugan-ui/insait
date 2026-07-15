"use client";

import { usePathname } from "next/navigation";
import { Bell, Moon, Sun, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/invoices": "Invoices",
  "/inbox": "Email Inbox",
  "/roster": "Consultant Roster",
  "/audit": "AI Audit",
  "/reports": "Reports",
  "/settings": "Settings",
};

function titleFor(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname === "/invoices/upload") return "Upload Invoice";
  if (pathname.startsWith("/invoices/")) return "Invoice Detail";
  return "Audix";
}

interface TopbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

export function Topbar({ searchValue, onSearchChange, searchPlaceholder }: TopbarProps) {
  const pathname = usePathname();
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
    <div className="h-[60px] shrink-0 flex items-center gap-3.5 px-6 border-b border-border bg-card sticky top-0 z-20">
      <div className="font-display font-semibold text-[17px]">{titleFor(pathname)}</div>
      <div className="flex-1" />
      {onSearchChange && (
        <div className="w-[280px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-[15px] text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder ?? "Search..."}
              className="pl-9 h-9 bg-secondary border-border"
            />
          </div>
        </div>
      )}
      <Button
        variant="outline"
        size="icon"
        className="size-[34px]"
        onClick={() => toast.message("Notifications", { description: "You have invoices needing review." })}
      >
        <Bell className="size-4" />
      </Button>
      <Button variant="outline" size="icon" className="size-[34px]" onClick={toggleTheme}>
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  );
}
