import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoiceExtractionService } from "./invoice-extraction.service";
import { InvoiceChecksService } from "./invoice-checks.service";

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceExtractionService, InvoiceChecksService],
})
export class InvoicesModule {}
