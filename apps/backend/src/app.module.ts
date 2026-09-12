import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { HealthModule } from "./health/health.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ReportsModule } from "./reports/reports.module";
import { ChatModule } from "./chat/chat.module";
import { RosterModule } from "./roster/roster.module";
import { MonthsModule } from "./months/months.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
    PrismaModule,
    QueueModule,
    HealthModule,
    InvoicesModule,
    DashboardModule,
    ReportsModule,
    ChatModule,
    RosterModule,
    MonthsModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
