import { Router } from "express";
import { getActor, requireAuth } from "../../shared/auth.js";
import { asyncHandler, HttpError } from "../../shared/http.js";
import { createDisponibilidadeSchema, updateDisponibilidadeSchema } from "./disponibilidade.schemas.js";
import type { DisponibilidadeService } from "./disponibilidade.service.js";

export class DisponibilidadeController {
  readonly router = Router();

  constructor(private readonly disponibilidadeService: DisponibilidadeService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.disponibilidadeService.list());
    }));

    this.router.post("/", requireAuth, asyncHandler(async (req, res) => {
      const input = createDisponibilidadeSchema.parse(req.body);

      if (input.professorId !== getActor(req).id) {
        throw new HttpError(403, "Somente o próprio professor pode alterar a disponibilidade");
      }

      res.status(201).json(await this.disponibilidadeService.create(input));
    }));

    this.router.put("/:id", requireAuth, asyncHandler(async (req, res) => {
      const input = updateDisponibilidadeSchema.parse(req.body);
      res.json(await this.disponibilidadeService.update(req.params.id as string, input, getActor(req).id));
    }));

    this.router.delete("/:id", requireAuth, asyncHandler(async (req, res) => {
      await this.disponibilidadeService.remove(req.params.id as string, getActor(req).id);
      res.status(204).send();
    }));
  }
}
