import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createAulaSchema } from "./grade-horaria.schemas.js";
import type { GradeHorariaService } from "./grade-horaria.service.js";

export class GradeHorariaController {
  readonly router = Router();

  constructor(private readonly gradeHorariaService: GradeHorariaService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.gradeHorariaService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createAulaSchema.parse(req.body);
      res.status(201).json(await this.gradeHorariaService.create(input));
    }));
  }
}
