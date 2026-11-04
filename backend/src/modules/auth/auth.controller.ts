import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { requireAuth } from "../../shared/auth.js";
import {
  changePasswordSchema,
  confirmEmailSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  setupSchema,
  updateMeSchema
} from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";

export class AuthController {
  readonly router = Router();

  constructor(private readonly authService: AuthService) {
    this.router.post("/login", asyncHandler(async (req, res) => {
      const input = loginSchema.parse(req.body);
      res.json(await this.authService.login(input));
    }));

    this.router.post("/change-password", asyncHandler(async (req, res) => {
      const input = changePasswordSchema.parse(req.body);
      await this.authService.changePassword(input);
      res.status(204).send();
    }));

    this.router.get("/setup", asyncHandler(async (_req, res) => {
      res.json(await this.authService.setupStatus());
    }));

    this.router.post("/setup", asyncHandler(async (req, res) => {
      const input = setupSchema.parse(req.body);
      res.status(201).json(await this.authService.setup(input));
    }));

    this.router.post("/confirm-email", asyncHandler(async (req, res) => {
      const input = confirmEmailSchema.parse(req.body);
      await this.authService.confirmEmail(input);
      res.status(204).send();
    }));

    this.router.post("/forgot-password", asyncHandler(async (req, res) => {
      const input = forgotPasswordSchema.parse(req.body);
      await this.authService.forgotPassword(input);
      res.status(204).send();
    }));

    this.router.post("/reset-password", asyncHandler(async (req, res) => {
      const input = resetPasswordSchema.parse(req.body);
      await this.authService.resetPassword(input);
      res.status(204).send();
    }));

    this.router.get("/me", requireAuth, asyncHandler(async (req, res) => {
      res.json(await this.authService.me(req.auth!.sub));
    }));

    this.router.put("/me", requireAuth, asyncHandler(async (req, res) => {
      const input = updateMeSchema.parse(req.body);
      res.json(await this.authService.updateMe(req.auth!.sub, input));
    }));
  }
}
