import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";

// Lightweight shared-secret gate, not a real auth system — keeps the API from being
// casually reachable by anyone who doesn't go through the password-gated frontend.
// Skipped entirely if API_SHARED_SECRET isn't set, so local dev needs no extra setup.
@Injectable()
export class AppSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.API_SHARED_SECRET;
    if (!secret) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (req.path === "/health") return true;

    const provided = req.header("x-app-secret");
    if (provided !== secret) throw new UnauthorizedException("Missing or invalid credentials");
    return true;
  }
}
