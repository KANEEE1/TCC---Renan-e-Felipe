import { z } from "zod";

export const createMatriculaSchema = z.object({
  alunoId: z.string().cuid(),
  turmaId: z.string().cuid(),
  dataMatricula: z.coerce.date().optional()
});

export const assignStudentsSchema = z.object({
  studentIds: z.array(z.string().cuid()).min(1)
});

export type CreateMatriculaInput = z.infer<typeof createMatriculaSchema>;
export type AssignStudentsInput = z.infer<typeof assignStudentsSchema>;
