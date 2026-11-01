import { Router } from "express";
import { getActor, requireAuth } from "../../shared/auth.js";
import { asyncHandler } from "../../shared/http.js";
import type { DashboardService } from "./dashboard.service.js";

export class DashboardController {
  readonly router = Router();

  constructor(private readonly dashboardService: DashboardService) {
    this.router.get("/summary", requireAuth, asyncHandler(async (req, res) => {
      res.json(await this.dashboardService.summary(getActor(req)));
    }));
  }
}
