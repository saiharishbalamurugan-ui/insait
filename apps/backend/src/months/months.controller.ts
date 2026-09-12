import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
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
  createMonth(@Body("label") label?: string) {
    return this.monthsService.createMonth(label);
  }

  @Delete(":label/data")
  clearData(@Param("label") label: string) {
    return this.monthsService.clearData(label);
  }

  @Delete(":label")
  deleteMonth(@Param("label") label: string) {
    return this.monthsService.deleteMonth(label);
  }
}
