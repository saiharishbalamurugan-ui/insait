// Plain connection options, not a constructed IORedis instance — BullMQ bundles its own
// nested copy of ioredis, and passing an instance built from this package's ioredis version
// fails to typecheck against BullMQ's ConnectionOptions (two incompatible ioredis types).
export function createRedisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

export const AI_AUDIT_QUEUE_NAME = "ai-audit";
