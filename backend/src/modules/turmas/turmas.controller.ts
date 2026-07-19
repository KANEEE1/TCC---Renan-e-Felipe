import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createTurmaSchema } from "./turmas.schemas.js";
import type { TurmasService } from "./turmas.service.js";

export class TurmasController {
  readonly router = Router();

  constructor(private readonly turmasService: TurmasService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.turmasService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createTurmaSchema.parse(req.body);
      res.status(201).json(await this.turmasService.create(input));
    }));
  }
}
