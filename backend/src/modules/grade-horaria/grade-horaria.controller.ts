import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { confirmScheduleSchema, createAulaSchema, suggestScheduleSchema, updateAulaSchema } from "./grade-horaria.schemas.js";
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

    this.router.post("/suggest", asyncHandler(async (req, res) => {
      const input = suggestScheduleSchema.parse(req.body);
      res.json(await this.gradeHorariaService.suggest(input));
    }));

    this.router.post("/confirm", asyncHandler(async (req, res) => {
      const input = confirmScheduleSchema.parse(req.body);
      res.status(201).json({ criadas: await this.gradeHorariaService.confirm(input) });
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
