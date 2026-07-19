import { z } from "zod";

export const createMatriculaSchema = z.object({
  alunoId: z.string().cuid(),
  turmaId: z.string().cuid(),
  periodoLetivoId: z.string().cuid(),
  status: z.enum(["ATIVA", "INATIVA", "CONCLUIDA", "DESISTENTE"]).optional()
});

export type CreateMatriculaInput = z.infer<typeof createMatriculaSchema>;
