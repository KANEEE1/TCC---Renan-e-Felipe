import { z } from "zod";

export const createMatriculaSchema = z.object({
  alunoId: z.string().cuid(),
  turmaId: z.string().cuid(),
  dataMatricula: z.coerce.date().optional()
});

export type CreateMatriculaInput = z.infer<typeof createMatriculaSchema>;
