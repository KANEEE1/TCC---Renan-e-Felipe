import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createPeriodoLetivoSchema } from "./periodos-letivos.schemas.js";
import type { PeriodosLetivosService } from "./periodos-letivos.service.js";

export class PeriodosLetivosController {
  readonly router = Router();

  constructor(private readonly periodosLetivosService: PeriodosLetivosService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.periodosLetivosService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createPeriodoLetivoSchema.parse(req.body);
      res.status(201).json(await this.periodosLetivosService.create(input));
    }));
  }
}
