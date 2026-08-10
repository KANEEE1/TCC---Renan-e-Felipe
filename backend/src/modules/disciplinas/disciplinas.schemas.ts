import { z } from "zod";

export const createDisciplinaSchema = z.object({
  nome: z.string().min(1)
});

export type CreateDisciplinaInput = z.infer<typeof createDisciplinaSchema>;
