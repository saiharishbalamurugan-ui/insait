import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

const AI_AUDIT_QUEUE_NAME = "ai-audit";

function parseRedisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

@Injectable()
export class AiAuditQueueService implements OnModuleDestroy {
  private queue = new Queue(AI_AUDIT_QUEUE_NAME, { connection: parseRedisConnection() });

  async enqueueAudit(invoiceId: string) {
    return this.queue.add("audit-invoice", { invoiceId });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
