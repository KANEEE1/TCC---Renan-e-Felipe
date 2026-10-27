import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createDisciplinaSchema, createDisciplinasLoteSchema, updateDisciplinaSchema } from "./disciplinas.schemas.js";
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

    this.router.post("/lote", asyncHandler(async (req, res) => {
      const input = createDisciplinasLoteSchema.parse(req.body);
      res.status(201).json(await this.disciplinasService.createLote(input));
    }));

    this.router.put("/:id", asyncHandler(async (req, res) => {
      const input = updateDisciplinaSchema.parse(req.body);
      res.json(await this.disciplinasService.update(req.params.id as string, input));
    }));

    this.router.delete("/:id", asyncHandler(async (req, res) => {
      await this.disciplinasService.remove(req.params.id as string);
      res.status(204).send();
    }));
  }
}
