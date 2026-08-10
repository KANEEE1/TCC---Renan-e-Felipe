import { z } from "zod";

export const createAlunoSchema = z.object({
  nome: z.string().min(1)
});

export type CreateAlunoInput = z.infer<typeof createAlunoSchema>;
