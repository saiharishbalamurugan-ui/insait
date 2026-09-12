import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";
import { AppSecretGuard } from "./common/app-secret.guard";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "x-app-secret", "x-session-token"],
  });
  app.useGlobalGuards(new AppSecretGuard());
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });
  const port = process.env.BACKEND_PORT ?? 4000;
  await app.listen(port);
  console.log(`Audix – Invoice Reconciliation backend listening on http://localhost:${port}`);
}

bootstrap();
