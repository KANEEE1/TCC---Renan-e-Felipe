import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createDisponibilidadeSchema, updateDisponibilidadeSchema } from "./disponibilidade.schemas.js";
import type { DisponibilidadeService } from "./disponibilidade.service.js";

export class DisponibilidadeController {
  readonly router = Router();

  constructor(private readonly disponibilidadeService: DisponibilidadeService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.disponibilidadeService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createDisponibilidadeSchema.parse(req.body);
      res.status(201).json(await this.disponibilidadeService.create(input));
    }));

    this.router.put("/:id", asyncHandler(async (req, res) => {
      const input = updateDisponibilidadeSchema.parse(req.body);
      res.json(await this.disponibilidadeService.update(req.params.id as string, input));
    }));

    this.router.delete("/:id", asyncHandler(async (req, res) => {
      await this.disponibilidadeService.remove(req.params.id as string);
      res.status(204).send();
    }));
  }
}
