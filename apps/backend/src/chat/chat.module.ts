import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { MonthsModule } from "../months/months.module";

@Module({
  imports: [MonthsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
