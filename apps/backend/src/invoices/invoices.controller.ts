import { BadRequestException, Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { InvoicesService } from "./invoices.service";
import { InvoiceExtractionService } from "./invoice-extraction.service";
import { InvoiceChecksService } from "./invoice-checks.service";
import { MonthsService } from "../months/months.service";

const DEMO_ORG_ID = "seed-org-1";

interface CreateInvoiceBody {
  vendorName: string;
  invoiceNumber: string;
  consultantName: string | null;
  project: string | null;
  hours: number | null;
  hourlyRate: number | null;
  amount: number;
  issueDate: string;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paymentTermsLabel: string | null;
  paymentTermsDays: number | null;
  fileUrl: string | null;
  uploadedAt: string;
  receivedDate: string;
  extractedData: unknown;
}

interface RecomputeChecksBody {
  vendorName: string;
  invoiceNumber: string;
  consultantName: string | null;
  project: string | null;
  hours: number | null;
  hourlyRate: number | null;
  amount: number | null;
  issueDate: string | null;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paymentTermsLabel: string | null;
  paymentTermsDays: number | null;
  fieldPositions: unknown;
  fileUrl: string;
  mimeType: string;
  receivedDate: string;
}

@Controller("invoices")
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly extractionService: InvoiceExtractionService,
    private readonly checksService: InvoiceChecksService,
    private readonly monthsService: MonthsService,
  ) {}

  @Post("extract")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  async extract(@UploadedFile() file?: Express.Multer.File, @Body("receivedDate") receivedDateStr?: string) {
    if (!file) throw new BadRequestException("No file uploaded");
    if (!receivedDateStr) throw new BadRequestException("receivedDate is required");
    const receivedDate = new Date(receivedDateStr);
    const uploadedAt = new Date();
    const currentMonth = await this.monthsService.currentLabel();
    const extracted = await this.extractionService.extract(file);
    const checks = await this.checksService.runChecks(extracted, DEMO_ORG_ID, receivedDate, currentMonth);
    return { ...extracted, uploadedAt: uploadedAt.toISOString(), receivedDate: receivedDate.toISOString(), checks };
  }

  @Post("recompute-checks")
  async recomputeChecks(@Body() body: RecomputeChecksBody) {
    if (!body.receivedDate) throw new BadRequestException("receivedDate is required");
    const currentMonth = await this.monthsService.currentLabel();
    const checks = await this.checksService.runChecks(
      {
        vendorName: body.vendorName,
        invoiceNumber: body.invoiceNumber,
        consultantName: body.consultantName,
        project: body.project,
        hours: body.hours,
        hourlyRate: body.hourlyRate,
        amount: body.amount,
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        paymentTermsLabel: body.paymentTermsLabel,
        paymentTermsDays: body.paymentTermsDays,
        fieldPositions: (body.fieldPositions as never) ?? [],
        fileUrl: body.fileUrl,
        mimeType: body.mimeType,
      },
      DEMO_ORG_ID,
      new Date(body.receivedDate),
      currentMonth,
    );
    return { checks };
  }

  @Get()
  findAll(@Query("status") status?: string, @Query("search") search?: string, @Query("month") month?: string) {
    return this.invoicesService.findAll({ status, search, month });
  }

  @Post()
  create(@Body() body: CreateInvoiceBody) {
    return this.invoicesService.create(body, this.checksService);
  }

  @Post("bulk-delete")
  bulkDelete(@Body("ids") ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException("No invoice ids given");
    return this.invoicesService.bulkDelete(ids);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post(":id/audit")
  triggerAudit(@Param("id") id: string) {
    return this.invoicesService.triggerAudit(id);
  }
}
