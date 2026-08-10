import { z } from "zod";

export const createNotaSchema = z.object({
  alunoId: z.string().cuid(),
  simuladoId: z.string().cuid(),
  valor: z.number().min(0)
});

export type CreateNotaInput = z.infer<typeof createNotaSchema>;
