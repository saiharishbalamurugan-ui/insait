import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(@Query("status") status?: string, @Query("search") search?: string) {
    return this.invoicesService.findAll({ status, search });
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
