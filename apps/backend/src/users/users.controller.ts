import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { AuthedRequest, SessionGuard } from "../auth/session.guard";

// Every route here needs a verified caller (SessionGuard) and Admin role — this manages
// other people's accounts, so unlike the rest of the app it can't just trust a client-supplied name.
@Controller("users")
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private requireAdmin(req: AuthedRequest) {
    if (req.user.role !== "ADMIN") throw new ForbiddenException("Admin access required");
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    this.requireAdmin(req);
    return this.usersService.list();
  }

  @Post("invite")
  invite(@Req() req: AuthedRequest, @Body() body: { name: string; email: string; role: string }) {
    this.requireAdmin(req);
    return this.usersService.invite(body);
  }

  @Post(":id/resend-invite")
  resendInvite(@Req() req: AuthedRequest, @Param("id") id: string) {
    this.requireAdmin(req);
    return this.usersService.resendInvite(id);
  }

  @Post(":id/revoke-invite")
  revokeInvite(@Req() req: AuthedRequest, @Param("id") id: string) {
    this.requireAdmin(req);
    return this.usersService.revokeInvite(id);
  }

  @Patch(":id")
  setActive(@Req() req: AuthedRequest, @Param("id") id: string, @Body("isActive") isActive: boolean) {
    this.requireAdmin(req);
    return this.usersService.setActive(id, isActive);
  }

  @Post(":id/reset-password")
  resetPassword(@Req() req: AuthedRequest, @Param("id") id: string, @Body("password") password: string) {
    this.requireAdmin(req);
    return this.usersService.resetPassword(id, password);
  }
}
