import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createMatriculaSchema } from "./matriculas.schemas.js";
import type { MatriculasService } from "./matriculas.service.js";

export class MatriculasController {
  readonly router = Router();

  constructor(private readonly matriculasService: MatriculasService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.matriculasService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createMatriculaSchema.parse(req.body);
      res.status(201).json(await this.matriculasService.create(input));
    }));
  }
}
