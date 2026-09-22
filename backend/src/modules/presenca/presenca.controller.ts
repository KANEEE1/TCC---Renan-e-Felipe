import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createPresencaSchema, markAttendanceSchema } from "./presenca.schemas.js";
import type { PresencaService } from "./presenca.service.js";

export class PresencaController {
  readonly router = Router();

  constructor(private readonly presencaService: PresencaService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.presencaService.list());
    }));

    this.router.get("/by-class/:classId", asyncHandler(async (req, res) => {
      res.json(await this.presencaService.listByTurma(req.params.classId as string));
    }));

    this.router.get("/report/:studentId", asyncHandler(async (req, res) => {
      res.json(await this.presencaService.report(req.params.studentId as string));
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createPresencaSchema.parse(req.body);
      res.status(201).json(await this.presencaService.create(input));
    }));

    this.router.post("/mark", asyncHandler(async (req, res) => {
      const input = markAttendanceSchema.parse(req.body);
      res.status(201).json(await this.presencaService.markBulk(input));
    }));
  }
}
