import { Router } from "express";
import { getActor, requireRole } from "../../shared/auth.js";
import { asyncHandler } from "../../shared/http.js";
import { candidatesQuerySchema, createSubstituicaoSchema } from "./substituicoes.schemas.js";
import type { SubstituicoesService } from "./substituicoes.service.js";

export class SubstituicoesController {
  readonly router = Router();

  constructor(private readonly substituicoesService: SubstituicoesService) {
    this.router.get("/candidates", requireRole("GESTAO"), asyncHandler(async (req, res) => {
      const { ausenciaId } = candidatesQuerySchema.parse(req.query);
      res.json(await this.substituicoesService.findCandidates(ausenciaId));
    }));

    this.router.post("/", requireRole("GESTAO"), asyncHandler(async (req, res) => {
      const actor = getActor(req);
      const input = createSubstituicaoSchema.parse(req.body);
      res.status(201).json(await this.substituicoesService.create(input, actor.id));
    }));

    this.router.delete("/:id", requireRole("GESTAO"), asyncHandler(async (req, res) => {
      await this.substituicoesService.remove(req.params.id as string);
      res.status(204).end();
    }));
  }
}
