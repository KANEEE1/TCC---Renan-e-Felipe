import { Router } from "express";
import { requireAuth, requireRole } from "../../shared/auth.js";
import { asyncHandler } from "../../shared/http.js";
import { createAlunoSchema, importarAlunosSchema, updateAlunoSchema } from "./alunos.schemas.js";
import type { AlunosService } from "./alunos.service.js";

export class AlunosController {
  readonly router = Router();

  constructor(private readonly alunosService: AlunosService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.alunosService.list());
    }));

    this.router.get("/indicadores", requireAuth, asyncHandler(async (_req, res) => {
      res.json(await this.alunosService.indicadores());
    }));

    this.router.get("/:id", asyncHandler(async (req, res) => {
      res.json(await this.alunosService.getById(req.params.id as string));
    }));

    // Cadastrar, editar e excluir alunos é da gestão; a leitura continua aberta.
    this.router.post("/", requireAuth, requireRole("GESTAO"), asyncHandler(async (req, res) => {
      const input = createAlunoSchema.parse(req.body);
      res.status(201).json(await this.alunosService.create(input));
    }));

    // Confere a planilha sem cadastrar nada, para o gestor ver os problemas antes de confirmar.
    this.router.post("/importar/validacao", requireAuth, requireRole("GESTAO"), asyncHandler(async (req, res) => {
      const { csv } = importarAlunosSchema.parse(req.body);
      const { novos, erros } = await this.alunosService.validarPlanilha(csv);
      res.json({ total: novos.length, erros });
    }));

    this.router.post("/importar", requireAuth, requireRole("GESTAO"), asyncHandler(async (req, res) => {
      const { csv } = importarAlunosSchema.parse(req.body);
      res.status(201).json(await this.alunosService.importarPlanilha(csv));
    }));

    this.router.put("/:id", requireAuth, requireRole("GESTAO"), asyncHandler(async (req, res) => {
      const input = updateAlunoSchema.parse(req.body);
      res.json(await this.alunosService.update(req.params.id as string, input));
    }));

    // Exclusão lógica (some das listas atuais; o histórico fica).
    this.router.delete("/:id", requireAuth, requireRole("GESTAO"), asyncHandler(async (req, res) => {
      await this.alunosService.remove(req.params.id as string);
      res.status(204).end();
    }));
  }
}
