import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { verifySessionToken, SessionPayload } from "./session-token.util";

export interface AuthedRequest extends Request {
  user: SessionPayload;
}

// Verifies the x-session-token header the frontend forwards from its own signed cookie.
// Endpoints that need to know (and trust) who's calling — not just a self-reported name —
// use this guard and read req.user.
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new UnauthorizedException("Auth is not configured on this server");

    const req = context.switchToHttp().getRequest<Request>();
    const payload = verifySessionToken(req.header("x-session-token"), secret);
    if (!payload) throw new UnauthorizedException("Invalid or missing session");

    (req as AuthedRequest).user = payload;
    return true;
  }
}
