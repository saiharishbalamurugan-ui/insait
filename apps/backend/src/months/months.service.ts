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

  async createMonth(label?: string) {
    const targetLabel = label ?? nextLabel((await this.current()).label);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetLabel)) {
      throw new BadRequestException("Month must be in YYYY-MM format.");
    }

    const existing = await this.prisma.month.findUnique({
      where: { organizationId_label: { organizationId: DEMO_ORG_ID, label: targetLabel } },
    });
    if (existing) {
      throw new BadRequestException(`${targetLabel} already exists — switch to it instead of creating it again.`);
    }

    const [, created] = await this.prisma.$transaction([
      this.prisma.month.updateMany({ where: { organizationId: DEMO_ORG_ID }, data: { isCurrent: false } }),
      this.prisma.month.create({ data: { organizationId: DEMO_ORG_ID, label: targetLabel, isCurrent: true } }),
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

  async deleteMonth(label: string) {
    const month = await this.prisma.month.findUnique({
      where: { organizationId_label: { organizationId: DEMO_ORG_ID, label } },
    });
    if (!month) throw new BadRequestException("No such month.");

    const [deletedInvoices, deletedRoster] = await this.prisma.$transaction([
      this.prisma.invoice.deleteMany({ where: { organizationId: DEMO_ORG_ID, month: label } }),
      this.prisma.timesheet.deleteMany({ where: { organizationId: DEMO_ORG_ID, month: label } }),
    ]);
    await this.prisma.month.delete({ where: { id: month.id } });

    // Deleting the current month leaves nothing editable — promote whatever's left (most
    // recent by label) to current so there's always exactly one, same invariant createMonth keeps.
    let newCurrentLabel: string | null = null;
    if (month.isCurrent) {
      const promoted = await this.prisma.month.findFirst({
        where: { organizationId: DEMO_ORG_ID },
        orderBy: { label: "desc" },
      });
      if (promoted) {
        await this.prisma.month.update({ where: { id: promoted.id }, data: { isCurrent: true } });
        newCurrentLabel = promoted.label;
      }
    }

    return { deletedInvoices: deletedInvoices.count, deletedRosterRows: deletedRoster.count, newCurrentLabel };
  }

  async assertCurrent(month: string) {
    const current = await this.currentLabel();
    if (month !== current) {
      throw new BadRequestException(`${month} is a historical month and is read-only — switch to ${current} to make changes.`);
    }
  }
}
