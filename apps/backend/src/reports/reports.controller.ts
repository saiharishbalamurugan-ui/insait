import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll() {
    return this.reportsService.findAll();
  }

  @Post(":id/action")
  setAction(@Param("id") id: string, @Body("action") action: string) {
    return this.reportsService.setReviewAction(id, action);
  }
}
