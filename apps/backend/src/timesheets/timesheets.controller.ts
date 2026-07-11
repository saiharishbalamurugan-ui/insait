import { Controller, Get } from "@nestjs/common";
import { TimesheetsService } from "./timesheets.service";

@Controller("timesheets")
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  findAll() {
    return this.timesheetsService.findAll();
  }
}
