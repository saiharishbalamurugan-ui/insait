import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll(@Query("month") month?: string) {
    return this.reportsService.findAll(month);
  }

  @Post(":id/action")
  setAction(@Param("id") id: string, @Body("action") action: string) {
    return this.reportsService.setReviewAction(id, action);
  }
}
