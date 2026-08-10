import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createPresencaSchema } from "./presenca.schemas.js";
import type { PresencaService } from "./presenca.service.js";

export class PresencaController {
  readonly router = Router();

  constructor(private readonly presencaService: PresencaService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.presencaService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createPresencaSchema.parse(req.body);
      res.status(201).json(await this.presencaService.create(input));
    }));
  }
}
