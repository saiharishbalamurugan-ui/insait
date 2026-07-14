import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const CLAUDE_MODEL = "claude-opus-4-8";
const UPLOAD_DIR = join(process.cwd(), "uploads");

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    vendorName: { type: "string" },
    invoiceNumber: { type: "string" },
    consultantName: { type: ["string", "null"] },
    project: { type: ["string", "null"] },
    hours: { type: ["number", "null"] },
    hourlyRate: { type: ["number", "null"] },
    amount: { type: ["number", "null"] },
    issueDate: { type: ["string", "null"], description: "ISO 8601 date (YYYY-MM-DD) if present" },
    dueDate: { type: ["string", "null"], description: "ISO 8601 date (YYYY-MM-DD) if present" },
  },
  required: ["vendorName", "invoiceNumber", "consultantName", "project", "hours", "hourlyRate", "amount", "issueDate", "dueDate"],
  additionalProperties: false,
} as const;

export interface ExtractedInvoiceData {
  vendorName: string;
  invoiceNumber: string;
  consultantName: string | null;
  project: string | null;
  hours: number | null;
  hourlyRate: number | null;
  amount: number | null;
  issueDate: string | null;
  dueDate: string | null;
  fileUrl: string;
}

@Injectable()
export class InvoiceExtractionService {
  isAvailable() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async extract(file: Express.Multer.File): Promise<ExtractedInvoiceData> {
    if (!this.isAvailable()) {
      throw new ServiceUnavailableException(
        "AI extraction isn't turned on yet — ANTHROPIC_API_KEY is missing from the backend's .env file.",
      );
    }

    const extension = SUPPORTED_MIME_TYPES[file.mimetype];
    if (!extension) {
      throw new BadRequestException(`Unsupported file type "${file.mimetype}". Upload a PDF, PNG, JPEG, or WebP.`);
    }

    const fileUrl = await this.storeFile(file, extension);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const base64 = file.buffer.toString("base64");
    const documentBlock: Anthropic.Messages.ContentBlockParam =
      file.mimetype === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: file.mimetype as "image/png" | "image/jpeg" | "image/webp", data: base64 } };

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system:
        "You extract structured data from staffing/consulting invoices. Read the attached document and pull out " +
        "exactly what's visibly present. If a field isn't on the invoice, use null — never guess or invent a value.",
      messages: [
        {
          role: "user",
          content: [
            documentBlock,
            { type: "text", text: "Extract the invoice fields from this document." },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new ServiceUnavailableException("Claude didn't return extracted data — try again.");
    }

    const parsed = JSON.parse(textBlock.text) as Omit<ExtractedInvoiceData, "fileUrl">;
    return { ...parsed, fileUrl };
  }

  private async storeFile(file: Express.Multer.File, extension: string): Promise<string> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);
    return `/uploads/${filename}`;
  }
}
