import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";
import { generateInviteToken, buildInviteUrl } from "../auth/invite-token.util";

const DEMO_ORG_ID = "seed-org-1";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      where: { organizationId: DEMO_ORG_ID },
      orderBy: { createdAt: "asc" },
      select: USER_SELECT,
    });
  }

  async invite(data: { name: string; email: string; role: string }) {
    if (!data.name?.trim() || !data.email?.trim()) {
      throw new BadRequestException("Name and email are required");
    }
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("A user with that email already exists");

    const { token, tokenHash, expiresAt } = generateInviteToken();
    const user = await this.prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        role: data.role === "ADMIN" ? "ADMIN" : "REVIEWER",
        organizationId: DEMO_ORG_ID,
        status: "INVITED",
        inviteTokenHash: tokenHash,
        inviteExpiresAt: expiresAt,
      },
      select: USER_SELECT,
    });

    return { user, inviteUrl: buildInviteUrl(token) };
  }

  async resendInvite(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId: DEMO_ORG_ID } });
    if (!user) throw new NotFoundException("User not found");
    if (user.status !== "INVITED") throw new BadRequestException("This user has already activated their account");

    const { token, tokenHash, expiresAt } = generateInviteToken();
    await this.prisma.user.update({ where: { id }, data: { inviteTokenHash: tokenHash, inviteExpiresAt: expiresAt } });

    return { inviteUrl: buildInviteUrl(token) };
  }

  async revokeInvite(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId: DEMO_ORG_ID } });
    if (!user) throw new NotFoundException("User not found");
    if (user.status !== "INVITED") throw new BadRequestException("This user has already activated their account");

    // Never activated, so there's nothing to keep attributable — a real delete (not a
    // deactivate) frees up the email in case the Admin typo'd it and wants to re-invite.
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  async setActive(id: string, isActive: boolean) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId: DEMO_ORG_ID } });
    if (!user) throw new NotFoundException("User not found");
    if (user.status === "INVITED") throw new BadRequestException("This invite hasn't been accepted yet");

    return this.prisma.user.update({
      where: { id },
      data: { status: isActive ? "ACTIVE" : "DEACTIVATED" },
      select: USER_SELECT,
    });
  }

  async resetPassword(id: string, password: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
    const user = await this.prisma.user.findFirst({ where: { id, organizationId: DEMO_ORG_ID } });
    if (!user) throw new NotFoundException("User not found");
    if (user.status === "INVITED") {
      throw new BadRequestException("This user hasn't set a password yet — resend their invite instead");
    }
    await this.prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
    return { ok: true };
  }
}
