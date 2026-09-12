import { BadRequestException, GoneException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword, verifyPassword } from "./password.util";
import { hashInviteToken } from "./invite-token.util";

const INVALID_INVITE_MESSAGE = "This invite link isn't valid. Ask your Admin to resend a new invite.";
const EXPIRED_INVITE_MESSAGE = "This invite link has expired. Ask your Admin to resend a new invite.";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    if (!email?.trim() || !password) {
      throw new BadRequestException("Email and password are required");
    }

    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.status !== "ACTIVE" || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Incorrect email or password");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async validateInvite(token: string) {
    const user = await this.prisma.user.findUnique({ where: { inviteTokenHash: hashInviteToken(token) } });
    if (!user || user.status !== "INVITED") throw new NotFoundException(INVALID_INVITE_MESSAGE);
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) throw new GoneException(EXPIRED_INVITE_MESSAGE);

    return { name: user.name, email: user.email };
  }

  async acceptInvite(token: string, password: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const user = await this.prisma.user.findUnique({ where: { inviteTokenHash: hashInviteToken(token) } });
    if (!user || user.status !== "INVITED") throw new NotFoundException(INVALID_INVITE_MESSAGE);
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) throw new GoneException(EXPIRED_INVITE_MESSAGE);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(password),
        status: "ACTIVE",
        inviteTokenHash: null,
        inviteExpiresAt: null,
        lastLoginAt: new Date(),
      },
    });

    return { id: updated.id, name: updated.name, email: updated.email, role: updated.role };
  }
}
