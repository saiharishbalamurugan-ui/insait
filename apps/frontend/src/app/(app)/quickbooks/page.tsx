"use client";

import { Database } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimesheets } from "@/lib/hooks/use-timesheets";
import { money, initials, initialsColor } from "@/lib/format";

export default function QuickbooksPage() {
  const { data: timesheets, isLoading } = useTimesheets();

  return (
    <>
      <Topbar />
      <PageContent>
        <Card className="mb-[18px]">
          <CardContent className="p-5 flex items-center gap-3.5">
            <div className="size-[42px] rounded-[9px] bg-brand-soft text-primary flex items-center justify-center shrink-0">
              <Database className="size-5" />
            </div>
            <div>
              <div className="font-bold text-[14.5px]">QuickBooks Online — Connected</div>
              <div className="text-[12px] text-text-faint">Syncing approved timesheets in real time</div>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-[3px] rounded-full bg-success-soft text-success">
                <span className="size-1.5 rounded-full bg-success" />
                Live Sync
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="p-5 pb-3.5 border-b border-border">
            <div className="font-display font-semibold text-[15.5px]">Approved Timesheets</div>
            <div className="text-[12.5px] text-muted-foreground">
              Consultant hours approved by project managers, synced from QuickBooks Time.
            </div>
          </div>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Approved Hours</TableHead>
                  <TableHead>Approved Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(timesheets ?? []).map((ts) => (
                  <TableRow key={ts.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="size-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ background: initialsColor(ts.employeeName) }}
                        >
                          {initials(ts.employeeName)}
                        </div>
                        <span className="font-semibold">{ts.employeeName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{ts.project}</TableCell>
                    <TableCell className="text-text-faint">{ts.managerName}</TableCell>
                    <TableCell className="font-mono">{ts.hours} hrs</TableCell>
                    <TableCell className="font-mono">{money(ts.approvedValue)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-[3px] rounded-full bg-success-soft text-success">
                        <span className="size-1.5 rounded-full bg-success" />
                        Approved
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>
    </>
  );
}
