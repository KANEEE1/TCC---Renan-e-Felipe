import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { assignStudentsSchema } from "../matriculas/matriculas.schemas.js";
import type { MatriculasService } from "../matriculas/matriculas.service.js";
import { createTurmaSchema, updateTurmaSchema } from "./turmas.schemas.js";
import type { TurmasService } from "./turmas.service.js";

export class TurmasController {
  readonly router = Router();

  constructor(
    private readonly turmasService: TurmasService,
    private readonly matriculasService: MatriculasService
  ) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.turmasService.list());
    }));

    this.router.get("/:id", asyncHandler(async (req, res) => {
      res.json(await this.turmasService.getById(req.params.id as string));
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createTurmaSchema.parse(req.body);
      res.status(201).json(await this.turmasService.create(input));
    }));

    this.router.put("/:id", asyncHandler(async (req, res) => {
      const input = updateTurmaSchema.parse(req.body);
      res.json(await this.turmasService.update(req.params.id as string, input));
    }));

    this.router.post("/:id/students", asyncHandler(async (req, res) => {
      await this.turmasService.getById(req.params.id as string);
      const input = assignStudentsSchema.parse(req.body);
      res.status(201).json(await this.matriculasService.assignStudents(req.params.id as string, input));
    }));
  }
}
