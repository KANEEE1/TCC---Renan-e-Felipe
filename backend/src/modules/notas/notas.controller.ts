import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { classSummaryParamsSchema, classSummaryQuerySchema, createNotaSchema } from "./notas.schemas.js";
import type { NotasService } from "./notas.service.js";

export class NotasController {
  readonly router = Router();

  constructor(private readonly notasService: NotasService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.notasService.list());
    }));

    this.router.get("/class-summary/:turmaId", asyncHandler(async (req, res) => {
      const { turmaId } = classSummaryParamsSchema.parse(req.params);
      const query = classSummaryQuerySchema.parse(req.query);
      res.json(await this.notasService.classSummary(turmaId, query));
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createNotaSchema.parse(req.body);
      res.status(201).json(await this.notasService.create(input));
    }));
  }
}
