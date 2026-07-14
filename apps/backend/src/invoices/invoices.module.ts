import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoiceExtractionService } from "./invoice-extraction.service";

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceExtractionService],
})
export class InvoicesModule {}
