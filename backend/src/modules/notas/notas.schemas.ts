import { boundedNumberQuery } from "../../shared/query.js";
import { z } from "zod";

export const createNotaSchema = z.object({
  alunoId: z.string().cuid(),
  simuladoId: z.string().cuid(),
  valor: z.number().min(0),
  observacoes: z.string().min(1).optional()
});

export type CreateNotaInput = z.infer<typeof createNotaSchema>;

export const classSummaryParamsSchema = z.object({
  turmaId: z.string().min(1)
});

export const classSummaryQuerySchema = z.object({
  limite: boundedNumberQuery(0, 10, 6)
});

export type ClassSummaryQuery = z.infer<typeof classSummaryQuerySchema>;
