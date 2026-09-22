import { z } from "zod";

export const createNotaSchema = z.object({
  alunoId: z.string().cuid(),
  simuladoId: z.string().cuid(),
  valor: z.number().min(0),
  observacoes: z.string().min(1).optional()
});

export type CreateNotaInput = z.infer<typeof createNotaSchema>;
