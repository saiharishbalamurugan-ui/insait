import { Injectable } from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = join(process.cwd(), "uploads");

// Uses S3 when S3_BUCKET is configured (Railway/production — container disk is ephemeral
// and wiped on every redeploy), otherwise falls back to local disk so nothing extra needs
// setting up for local dev.
@Injectable()
export class FileStorageService {
  private s3 = process.env.S3_BUCKET
    ? new S3Client({
        region: process.env.AWS_REGION ?? "us-east-1",
        ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
      })
    : null;

  async store(buffer: Buffer, extension: string, contentType: string): Promise<string> {
    const filename = `${randomUUID()}.${extension}`;

    if (this.s3 && process.env.S3_BUCKET) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: filename,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      const publicBase = process.env.S3_PUBLIC_URL ?? `https://${process.env.S3_BUCKET}.s3.amazonaws.com`;
      return `${publicBase}/${filename}`;
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, filename), buffer);
    return `/uploads/${filename}`;
  }
}
