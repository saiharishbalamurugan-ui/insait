import { Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { MonthsService } from "./months.service";

@Controller("months")
export class MonthsController {
  constructor(private readonly monthsService: MonthsService) {}

  @Get()
  findAll() {
    return this.monthsService.findAll();
  }

  @Get("current")
  current() {
    return this.monthsService.current();
  }

  @Post()
  createNext() {
    return this.monthsService.createNext();
  }

  @Delete(":label/data")
  clearData(@Param("label") label: string) {
    return this.monthsService.clearData(label);
  }
}
