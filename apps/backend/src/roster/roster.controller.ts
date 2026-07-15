import { BadRequestException, Controller, Get, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RosterService } from "./roster.service";

@Controller("roster")
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.rosterService.uploadSheet(file);
  }

  @Get()
  findAll() {
    return this.rosterService.findAll();
  }
}
