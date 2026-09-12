import { BadRequestException, Body, Controller, Get, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RosterService } from "./roster.service";
import { RosterField } from "./column-matcher";

@Controller("roster")
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@UploadedFile() file?: Express.Multer.File, @Body("mapping") mappingJson?: string) {
    if (!file) throw new BadRequestException("No file uploaded");
    let mapping: Partial<Record<RosterField, string>> | undefined;
    if (mappingJson) {
      try {
        mapping = JSON.parse(mappingJson);
      } catch {
        throw new BadRequestException("Invalid column mapping.");
      }
    }
    return this.rosterService.uploadSheet(file, mapping);
  }

  @Get()
  findAll(@Query("month") month?: string) {
    return this.rosterService.findAll(month);
  }
}
