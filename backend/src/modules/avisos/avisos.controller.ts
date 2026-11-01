import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import type { AvisosService } from "./avisos.service.js";

export class AvisosController {
  readonly router = Router();

  constructor(private readonly avisosService: AvisosService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.avisosService.list());
    }));

    this.router.post("/:id/ciente", asyncHandler(async (req, res) => {
      await this.avisosService.ciente(req.params.id as string);
      res.status(204).end();
    }));
  }
}
