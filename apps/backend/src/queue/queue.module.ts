import { Global, Module } from "@nestjs/common";
import { AiAuditQueueService } from "./ai-audit-queue.service";

@Global()
@Module({
  providers: [AiAuditQueueService],
  exports: [AiAuditQueueService],
})
export class QueueModule {}
