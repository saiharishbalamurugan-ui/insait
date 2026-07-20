import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEMO_ORG_ID = "seed-org-1";

function nextLabel(label: string): string {
  const [year, month] = label.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1)); // month is 1-indexed in the label, so this lands on the 1st of next month
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

@Injectable()
export class MonthsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const months = await this.prisma.month.findMany({
      where: { organizationId: DEMO_ORG_ID },
      orderBy: { label: "desc" },
    });
    if (months.length === 0) {
      return [await this.ensureCurrentMonth()];
    }
    return months;
  }

  async current() {
    const current = await this.prisma.month.findFirst({ where: { organizationId: DEMO_ORG_ID, isCurrent: true } });
    return current ?? this.ensureCurrentMonth();
  }

  async currentLabel(): Promise<string> {
    const month = await this.current();
    return month.label;
  }

  private async ensureCurrentMonth() {
    const label = new Date().toISOString().slice(0, 7);
    return this.prisma.month.upsert({
      where: { organizationId_label: { organizationId: DEMO_ORG_ID, label } },
      update: { isCurrent: true },
      create: { organizationId: DEMO_ORG_ID, label, isCurrent: true },
    });
  }

  async createNext() {
    const current = await this.current();
    const label = nextLabel(current.label);

    const existing = await this.prisma.month.findUnique({
      where: { organizationId_label: { organizationId: DEMO_ORG_ID, label } },
    });
    if (existing) {
      throw new BadRequestException(`${label} already exists — switch to it instead of creating it again.`);
    }

    const [, created] = await this.prisma.$transaction([
      this.prisma.month.updateMany({ where: { organizationId: DEMO_ORG_ID }, data: { isCurrent: false } }),
      this.prisma.month.create({ data: { organizationId: DEMO_ORG_ID, label, isCurrent: true } }),
    ]);
    return created;
  }

  async clearData(label: string) {
    const month = await this.prisma.month.findUnique({
      where: { organizationId_label: { organizationId: DEMO_ORG_ID, label } },
    });
    if (!month) throw new BadRequestException("No such month.");
    if (!month.isCurrent) {
      throw new BadRequestException("Only the current month's data can be cleared — historical months are read-only.");
    }

    const [deletedInvoices, deletedRoster] = await this.prisma.$transaction([
      this.prisma.invoice.deleteMany({ where: { organizationId: DEMO_ORG_ID, month: label } }),
      this.prisma.timesheet.deleteMany({ where: { organizationId: DEMO_ORG_ID, month: label } }),
    ]);

    return { clearedInvoices: deletedInvoices.count, clearedRosterRows: deletedRoster.count };
  }

  async assertCurrent(month: string) {
    const current = await this.currentLabel();
    if (month !== current) {
      throw new BadRequestException(`${month} is a historical month and is read-only — switch to ${current} to make changes.`);
    }
  }
}
