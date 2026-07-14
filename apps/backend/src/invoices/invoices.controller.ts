import { BadRequestException, Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { InvoicesService } from "./invoices.service";
import { InvoiceExtractionService } from "./invoice-extraction.service";

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
  fileUrl: string | null;
  extractedData: unknown;
}

@Controller("invoices")
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly extractionService: InvoiceExtractionService,
  ) {}

  @Post("extract")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  extract(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.extractionService.extract(file);
  }

  @Get()
  findAll(@Query("status") status?: string, @Query("search") search?: string) {
    return this.invoicesService.findAll({ status, search });
  }

  @Post()
  create(@Body() body: CreateInvoiceBody) {
    return this.invoicesService.create(body);
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
