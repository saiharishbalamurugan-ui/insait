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
  fileUrl: string | null;
  uploadedAt: string;
  extractedData: unknown;
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
  async extract(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file uploaded");
    const uploadedAt = new Date();
    const currentMonth = await this.monthsService.currentLabel();
    const extracted = await this.extractionService.extract(file);
    const checks = await this.checksService.runChecks(extracted, DEMO_ORG_ID, uploadedAt, currentMonth);
    return { ...extracted, uploadedAt: uploadedAt.toISOString(), checks };
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
