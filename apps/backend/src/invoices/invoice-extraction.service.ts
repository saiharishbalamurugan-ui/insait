import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { FileStorageService } from "../common/file-storage.service";

const CLAUDE_MODEL = "claude-opus-4-8";

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const EXTRACTABLE_FIELDS = [
  "vendorName",
  "invoiceNumber",
  "consultantName",
  "project",
  "hours",
  "hourlyRate",
  "amount",
  "issueDate",
  "dueDate",
  "periodStart",
  "periodEnd",
  "paymentTerms",
] as const;

export type ExtractableField = (typeof EXTRACTABLE_FIELDS)[number];

export interface FieldPosition {
  field: ExtractableField;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

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
    periodStart: { type: ["string", "null"], description: "ISO 8601 date — start of the billing/service period, if stated" },
    periodEnd: { type: ["string", "null"], description: "ISO 8601 date — end of the billing/service period, if stated" },
    paymentTermsLabel: {
      type: ["string", "null"],
      description: "Payment terms as stated or clearly implied on the invoice, e.g. 'Net 30', 'Net 45', 'Due on Receipt'. Null if not identifiable.",
    },
    paymentTermsDays: {
      type: ["number", "null"],
      description: "The same payment terms as a number of days from receipt (0 for Due on Receipt, 45 for Net 45, etc). Null if paymentTermsLabel is null.",
    },
    lineItems: {
      type: "array",
      description:
        "Every billable line item on the invoice, exactly as itemized. Most invoices have one line " +
        "for one consultant; staffing invoices sometimes bill multiple different consultants as separate " +
        "lines on the same invoice — emit one entry per line in that case, each with its own consultant name.",
      items: {
        type: "object",
        properties: {
          consultantName: {
            type: ["string", "null"],
            description: "The specific person this line item bills for, if identifiable from the line's description. Null if this line isn't tied to a named person.",
          },
          description: { type: "string" },
          hours: {
            type: ["number", "null"],
            description: "Hours for this line, if the quantity represents actual hours worked. Null if the quantity is a unit other than hours (e.g. a flat monthly fee).",
          },
          hourlyRate: {
            type: ["number", "null"],
            description: "This line's rate, only if it is genuinely a $/hour rate. Null if the 'rate' shown is actually a lump-sum/flat amount rather than a true per-hour rate — do not divide a flat fee by a nominal '1 hour' quantity to fabricate an hourly rate.",
          },
          amount: { type: "number" },
        },
        required: ["consultantName", "description", "hours", "hourlyRate", "amount"],
        additionalProperties: false,
      },
    },
    fieldPositions: {
      type: "array",
      description:
        "For each field you actually located on the page, its approximate bounding box, normalized to 0-1 " +
        "relative to the page width/height (0,0 = top-left). Skip fields you couldn't visually locate.",
      items: {
        type: "object",
        properties: {
          field: { type: "string", enum: [...EXTRACTABLE_FIELDS] },
          page: { type: "integer", description: "1-indexed page number" },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
        },
        required: ["field", "page", "x", "y", "width", "height"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "vendorName",
    "invoiceNumber",
    "consultantName",
    "project",
    "hours",
    "hourlyRate",
    "amount",
    "issueDate",
    "dueDate",
    "periodStart",
    "periodEnd",
    "paymentTermsLabel",
    "paymentTermsDays",
    "lineItems",
    "fieldPositions",
  ],
  additionalProperties: false,
} as const;

export interface ExtractedLineItem {
  consultantName: string | null;
  description: string;
  hours: number | null;
  hourlyRate: number | null;
  amount: number;
}

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
  periodStart: string | null;
  periodEnd: string | null;
  paymentTermsLabel: string | null;
  paymentTermsDays: number | null;
  lineItems?: ExtractedLineItem[];
  fieldPositions: FieldPosition[];
  fileUrl: string;
  mimeType: string;
}

@Injectable()
export class InvoiceExtractionService {
  constructor(private readonly fileStorage: FileStorageService) {}

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

    const fileUrl = await this.fileStorage.store(file.buffer, extension, file.mimetype);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const base64 = file.buffer.toString("base64");
    const documentBlock: Anthropic.Messages.ContentBlockParam =
      file.mimetype === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: file.mimetype as "image/png" | "image/jpeg" | "image/webp", data: base64 } };

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system:
        "You extract structured data from staffing/consulting invoices. Read the attached document and pull out " +
        "exactly what's visibly present. If a field isn't on the invoice, use null — never guess or invent a value. " +
        "Also identify the invoice's payment terms if stated or clearly implied anywhere on the document (e.g. " +
        "'Net 30', 'Payment due within 45 days', 'Due on Receipt') — report both the label as printed/implied and " +
        "the equivalent number of days from receipt. If no payment terms appear anywhere, leave both null rather " +
        "than assuming a default. " +
        "All dates you output must be ISO 8601 (YYYY-MM-DD), but the invoice itself may print dates in any " +
        "format. A numeric date like 04/08/2026 is ambiguous — it could be April 8 (US, month/day/year) or " +
        "August 4 (most of the rest of the world, day/month/year). Never default to month/day/year just because " +
        "that's a common convention. Instead, determine the vendor's locale from the document itself — country " +
        "in the billing address, a tax ID format that implies a country (e.g. a GSTIN implies India), phone " +
        "country code, currency — and use that to resolve the format. Also cross-check against any other date " +
        "information on the page: if the invoice is described as being for a specific month's work (e.g. a " +
        "subject line reading 'Invoice for July 2026'), the invoice date must make sense relative to that — an " +
        "invoice for July's work dated before July even started is a sign the date was misread, not that it was " +
        "actually issued early. If truly nothing on the document disambiguates it, month/day/year is a reasonable " +
        "last resort, but only after checking for these signals. " +
        "Also report the approximate on-page location of each field you found, normalized 0-1 relative to page size. " +
        "Some staffing invoices bill more than one consultant on the same invoice, one line item each — list " +
        "every line item in lineItems with its own consultant name. When a line's quantity is labeled 'hour(s)' " +
        "but the rate next to it is really a flat/lump-sum charge for that person (not a genuine per-hour rate), " +
        "leave that line's hourlyRate null rather than reporting the flat amount as if it were an hourly rate. " +
        "For the top-level consultantName/hours/hourlyRate fields: if the invoice has exactly one consultant, " +
        "fill them in as usual. If it bills multiple different consultants, leave consultantName null and " +
        "hourlyRate null (there is no single rate that describes the invoice) rather than picking one arbitrarily.",
      messages: [
        {
          role: "user",
          content: [
            documentBlock,
            { type: "text", text: "Extract the invoice fields from this document, with their page positions." },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new ServiceUnavailableException("Claude didn't return extracted data — try again.");
    }

    const parsed = JSON.parse(textBlock.text) as Omit<ExtractedInvoiceData, "fileUrl" | "mimeType">;
    return { ...parsed, fileUrl, mimeType: file.mimetype };
  }

}
