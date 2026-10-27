import { z } from "zod";

const nomeSchema = z.string().trim().min(1);

export const createDisciplinaSchema = z.object({
  nome: nomeSchema
});

export const updateDisciplinaSchema = z.object({
  nome: nomeSchema
});

export const createDisciplinasLoteSchema = z.object({
  nomes: z.array(nomeSchema).min(1).max(50)
});

export type CreateDisciplinaInput = z.infer<typeof createDisciplinaSchema>;
export type UpdateDisciplinaInput = z.infer<typeof updateDisciplinaSchema>;
export type CreateDisciplinasLoteInput = z.infer<typeof createDisciplinasLoteSchema>;
