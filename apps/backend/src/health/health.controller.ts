import { Controller, Get } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  private redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: true,
    retryStrategy: () => null,
  });

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    return {
      status: database.ok && redis.ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: { database, redis },
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  private async checkRedis() {
    try {
      await this.redis.connect();
      await this.redis.ping();
      this.redis.disconnect();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
}
