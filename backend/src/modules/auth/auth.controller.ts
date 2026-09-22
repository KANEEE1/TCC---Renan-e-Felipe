import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { requireAuth } from "../../shared/auth.js";
import { loginSchema } from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";

export class AuthController {
  readonly router = Router();

  constructor(private readonly authService: AuthService) {
    this.router.post("/login", asyncHandler(async (req, res) => {
      const input = loginSchema.parse(req.body);
      res.json(await this.authService.login(input));
    }));

    this.router.get("/me", requireAuth, asyncHandler(async (req, res) => {
      res.json(await this.authService.me(req.auth!.sub));
    }));
  }
}
