import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createAlunoSchema } from "./alunos.schemas.js";
import type { AlunosService } from "./alunos.service.js";

export class AlunosController {
  readonly router = Router();

  constructor(private readonly alunosService: AlunosService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.alunosService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createAlunoSchema.parse(req.body);
      res.status(201).json(await this.alunosService.create(input));
    }));
  }
}
