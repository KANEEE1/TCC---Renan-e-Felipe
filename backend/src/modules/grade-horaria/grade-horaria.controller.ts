import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createAulaSchema, updateAulaSchema } from "./grade-horaria.schemas.js";
import type { GradeHorariaService } from "./grade-horaria.service.js";

export class GradeHorariaController {
  readonly router = Router();

  constructor(private readonly gradeHorariaService: GradeHorariaService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.gradeHorariaService.list());
    }));

    this.router.get("/weekly", asyncHandler(async (_req, res) => {
      res.json(await this.gradeHorariaService.list());
    }));

    this.router.get("/by-class/:classId", asyncHandler(async (req, res) => {
      res.json(await this.gradeHorariaService.listByTurma(req.params.classId as string));
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createAulaSchema.parse(req.body);
      res.status(201).json(await this.gradeHorariaService.create(input));
    }));

    this.router.put("/:id", asyncHandler(async (req, res) => {
      const input = updateAulaSchema.parse(req.body);
      res.json(await this.gradeHorariaService.update(req.params.id as string, input));
    }));

    this.router.delete("/:id", asyncHandler(async (req, res) => {
      await this.gradeHorariaService.remove(req.params.id as string);
      res.status(204).end();
    }));
  }
}
