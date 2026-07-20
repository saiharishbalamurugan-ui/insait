import { Module } from "@nestjs/common";
import { RosterController } from "./roster.controller";
import { RosterService } from "./roster.service";
import { MonthsModule } from "../months/months.module";

@Module({
  imports: [MonthsModule],
  controllers: [RosterController],
  providers: [RosterService],
})
export class RosterModule {}
