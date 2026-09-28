import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import type { DashboardService } from "./dashboard.service.js";

export class DashboardController {
  readonly router = Router();

  constructor(private readonly dashboardService: DashboardService) {
    this.router.get("/summary", asyncHandler(async (_req, res) => {
      res.json(await this.dashboardService.summary());
    }));
  }
}
