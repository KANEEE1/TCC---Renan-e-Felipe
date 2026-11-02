import { Router } from "express";
import { getActor } from "../../shared/auth.js";
import { asyncHandler } from "../../shared/http.js";
import { lancarNotasSchema } from "./simulados.schemas.js";
import type { SimuladosService } from "./simulados.service.js";

// Todos os usuários logados veem os simulados e as notas; o lançamento é checado no serviço (corretores e gestão).
export class SimuladosController {
  readonly router = Router();

  constructor(private readonly simuladosService: SimuladosService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.simuladosService.list());
    }));

    this.router.get("/:id", asyncHandler(async (req, res) => {
      res.json(await this.simuladosService.getById(req.params.id as string, getActor(req)));
    }));

    this.router.put("/:id/notas", asyncHandler(async (req, res) => {
      const input = lancarNotasSchema.parse(req.body);
      res.json(await this.simuladosService.lancarNotas(req.params.id as string, input, getActor(req)));
    }));
  }
}
