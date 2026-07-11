import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaService } from "../prisma/prisma.service";
import { riskLabel } from "../common/risk.util";

const CLAUDE_MODEL = "claude-opus-4-8";

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  isAvailable() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async reply(message: string, invoiceId?: string) {
    if (!this.isAvailable()) {
      return {
        available: false,
        reply:
          "AI chat isn't turned on yet — it needs an ANTHROPIC_API_KEY in the backend's .env file. Ask your admin to add one from https://console.anthropic.com, then this will start working.",
      };
    }

    const context = invoiceId ? await this.buildInvoiceContext(invoiceId) : await this.buildPortfolioContext();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system:
        "You are the Audix AI assistant, embedded in an invoice-auditing dashboard for a staffing/consulting company. " +
        "Answer questions about the invoice or audit data given to you in the user message. Be concise (2-4 sentences). " +
        "If asked something outside the given data, say what you don't know rather than guessing.",
      messages: [{ role: "user", content: `${context}\n\nQuestion: ${message}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return {
      available: true,
      reply: textBlock && textBlock.type === "text" ? textBlock.text : "I couldn't generate a response.",
    };
  }

  private async buildInvoiceContext(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        matchedTimesheet: true,
        auditReports: { orderBy: { createdAt: "desc" }, take: 1, include: { findings: true } },
      },
    });
    if (!invoice) return "No invoice data available.";

    const report = invoice.auditReports[0];
    const findings = report?.findings.map((f) => `- ${f.discrepancyType}: ${f.explanation}`).join("\n") ?? "none";

    return `Invoice ${invoice.invoiceNumber} from ${invoice.vendorName}, consultant ${invoice.consultantName}, ${invoice.hours} hours at $${invoice.hourlyRate}/hr = $${invoice.amount}.
Matched QuickBooks timesheet: ${invoice.matchedTimesheet ? `${invoice.matchedTimesheet.hours} hours at $${invoice.matchedTimesheet.hourlyRate}/hr` : "none found"}.
Audit status: ${invoice.status}. Risk score: ${report?.overallRiskScore ?? "not yet audited"} (${riskLabel(report?.overallRiskScore)}).
Findings:
${findings}`;
  }

  private async buildPortfolioContext() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: "AUDITED" },
      include: { auditReports: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const flagged = invoices.filter((i) => riskLabel(i.auditReports[0]?.overallRiskScore) !== "Approved");
    return `Portfolio: ${invoices.length} audited invoices, ${flagged.length} flagged or high-risk.`;
  }
}
