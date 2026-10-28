import { Router } from "express";
import { getActor, requireAuth } from "../../shared/auth.js";
import { asyncHandler } from "../../shared/http.js";
import { attendanceSummaryQuerySchema, markAttendanceSchema } from "./presenca.schemas.js";
import type { PresencaService } from "./presenca.service.js";

export class PresencaController {
  readonly router = Router();

  constructor(private readonly presencaService: PresencaService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.presencaService.list());
    }));

    this.router.get("/summary", asyncHandler(async (req, res) => {
      const query = attendanceSummaryQuerySchema.parse(req.query);
      res.json(await this.presencaService.summary(query));
    }));

    this.router.get("/today", requireAuth, asyncHandler(async (req, res) => {
      res.json(await this.presencaService.today(getActor(req)));
    }));

    this.router.get("/by-class/:classId", asyncHandler(async (req, res) => {
      res.json(await this.presencaService.listByTurma(req.params.classId as string));
    }));

    this.router.get("/report/:studentId", asyncHandler(async (req, res) => {
      res.json(await this.presencaService.report(req.params.studentId as string));
    }));

    this.router.post("/mark", requireAuth, asyncHandler(async (req, res) => {
      const input = markAttendanceSchema.parse(req.body);
      res.status(201).json(await this.presencaService.markBulk(getActor(req), input));
    }));
  }
}
