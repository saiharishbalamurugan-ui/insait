import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEMO_ORG_ID = "seed-org-1";

@Injectable()
export class TimesheetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const timesheets = await this.prisma.timesheet.findMany({
      where: { organizationId: DEMO_ORG_ID },
      include: { matchedInvoice: { select: { id: true, invoiceNumber: true, status: true } } },
      orderBy: { employeeName: "asc" },
    });

    return timesheets.map((ts) => ({
      id: ts.id,
      employeeName: ts.employeeName,
      project: ts.project,
      managerName: ts.managerName,
      hours: Number(ts.hours),
      hourlyRate: Number(ts.hourlyRate),
      approvedValue: Number(ts.hours) * Number(ts.hourlyRate),
      workDate: ts.workDate,
      matchedInvoice: ts.matchedInvoice,
    }));
  }
}
