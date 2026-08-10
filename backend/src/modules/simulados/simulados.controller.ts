import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createSimuladoSchema } from "./simulados.schemas.js";
import type { SimuladosService } from "./simulados.service.js";

export class SimuladosController {
  readonly router = Router();

  constructor(private readonly simuladosService: SimuladosService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.simuladosService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createSimuladoSchema.parse(req.body);
      res.status(201).json(await this.simuladosService.create(input));
    }));
  }
}
