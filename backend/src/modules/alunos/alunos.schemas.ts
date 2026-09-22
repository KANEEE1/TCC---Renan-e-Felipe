import { z } from "zod";

export const createAlunoSchema = z.object({
  nome: z.string().min(1),
  numero: z.string().min(1).optional(),
  email: z.string().email().optional(),
  telefone: z.string().min(1).optional(),
  dataNascimento: z.coerce.date().optional(),
  cpf: z.string().min(1).optional(),
  endereco: z.string().min(1).optional()
});

export const updateAlunoSchema = createAlunoSchema.partial();

export type CreateAlunoInput = z.infer<typeof createAlunoSchema>;
export type UpdateAlunoInput = z.infer<typeof updateAlunoSchema>;
