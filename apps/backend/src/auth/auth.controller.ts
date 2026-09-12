import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body("email") email: string, @Body("password") password: string) {
    return this.authService.login(email, password);
  }

  // Public — the invited person isn't logged in yet. Looks up the invite without consuming it,
  // so the "Set your password" page can prefill name/email and show a clear error up front.
  @Get("invite/:token")
  validateInvite(@Param("token") token: string) {
    return this.authService.validateInvite(token);
  }

  @Post("accept-invite")
  acceptInvite(@Body("token") token: string, @Body("password") password: string) {
    return this.authService.acceptInvite(token, password);
  }
}
