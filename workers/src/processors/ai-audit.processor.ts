import { Worker, Job } from "bullmq";
import { createRedisConnection, AI_AUDIT_QUEUE_NAME } from "../queues/connection";

export interface AiAuditJobData {
  invoiceId: string;
}

// Phase 2 fills in the real implementation: load the invoice + matched
// QuickBooks timesheet, call Claude for a risk score / DiscrepancyType
// classification / explanation, and persist AuditFinding + AuditReport rows.
async function processAiAuditJob(job: Job<AiAuditJobData>) {
  console.log(`[ai-audit] received job ${job.id} for invoice ${job.data.invoiceId} (not yet implemented)`);
}

export function startAiAuditWorker() {
  return new Worker<AiAuditJobData>(AI_AUDIT_QUEUE_NAME, processAiAuditJob, {
    connection: createRedisConnection(),
  });
}
