import "dotenv/config";
import { startAiAuditWorker } from "./processors/ai-audit.processor";

const aiAuditWorker = startAiAuditWorker();

aiAuditWorker.on("ready", () => {
  console.log("Audix – Invoice Reconciliation workers connected to Redis, listening for jobs...");
});

aiAuditWorker.on("error", (err) => {
  console.error("[ai-audit worker] error:", err.message);
});

process.on("SIGTERM", async () => {
  await aiAuditWorker.close();
  process.exit(0);
});
