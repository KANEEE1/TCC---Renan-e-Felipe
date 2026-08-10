import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createDisciplinaSchema } from "./disciplinas.schemas.js";
import type { DisciplinasService } from "./disciplinas.service.js";

export class DisciplinasController {
  readonly router = Router();

  constructor(private readonly disciplinasService: DisciplinasService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.disciplinasService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createDisciplinaSchema.parse(req.body);
      res.status(201).json(await this.disciplinasService.create(input));
    }));
  }
}
