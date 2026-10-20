import { Router } from "express";
import { getActor } from "../../shared/auth.js";
import { asyncHandler } from "../../shared/http.js";
import { createAusenciaSchema, listAusenciasQuerySchema } from "./ausencias.schemas.js";
import type { AusenciasService } from "./ausencias.service.js";

export class AusenciasController {
  readonly router = Router();

  constructor(private readonly ausenciasService: AusenciasService) {
    this.router.get("/", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      const query = listAusenciasQuerySchema.parse(req.query);
      res.json(await this.ausenciasService.list(query, actor));
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      const input = createAusenciaSchema.parse(req.body);
      res.status(201).json(await this.ausenciasService.create(input, actor));
    }));

    this.router.delete("/:id", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      await this.ausenciasService.remove(req.params.id as string, actor);
      res.status(204).end();
    }));
  }
}
