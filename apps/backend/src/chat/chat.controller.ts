import { Body, Controller, Post } from "@nestjs/common";
import { ChatService } from "./chat.service";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  reply(@Body("message") message: string, @Body("invoiceId") invoiceId?: string, @Body("month") month?: string) {
    return this.chatService.reply(message, invoiceId, month);
  }
}
