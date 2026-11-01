import { Router } from "express";
import { z } from "zod";
import { getActor } from "../../shared/auth.js";
import { asyncHandler } from "../../shared/http.js";
import type { AvisosProfessorService } from "./avisos-professor.service.js";

const responderConvocacaoSchema = z.object({ status: z.enum(["CONFIRMADO", "RECUSADO"]) });

export class AvisosProfessorController {
  readonly router = Router();

  constructor(private readonly avisosProfessorService: AvisosProfessorService) {
    this.router.get("/", asyncHandler(async (req, res) => {
      res.json(await this.avisosProfessorService.listMine(getActor(req)));
    }));

    this.router.put("/convocacoes/:id", asyncHandler(async (req, res) => {
      const { status } = responderConvocacaoSchema.parse(req.body);
      res.json(await this.avisosProfessorService.responderConvocacao(req.params.id as string, status, getActor(req)));
    }));

    this.router.post("/:id/ciente", asyncHandler(async (req, res) => {
      await this.avisosProfessorService.ciente(req.params.id as string, getActor(req));
      res.status(204).end();
    }));
  }
}
