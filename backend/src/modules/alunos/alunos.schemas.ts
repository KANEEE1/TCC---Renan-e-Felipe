import { z } from "zod";

const alunoFields = z.object({
  nome: z.string().min(1),
  numero: z.string().min(1).optional(),
  email: z.string().email().optional(),
  telefone: z.string().min(1).optional(),
  dataNascimento: z.coerce.date().optional(),
  cpf: z.string().min(1).optional(),
  endereco: z.string().min(1).optional()
});

// Todo aluno nasce matriculado numa turma; a edição não troca a turma (isso é feito pela matrícula).
export const createAlunoSchema = alunoFields.extend({ turmaId: z.string().min(1) });

export const updateAlunoSchema = alunoFields.partial();

export type CreateAlunoInput = z.infer<typeof createAlunoSchema>;
export type UpdateAlunoInput = z.infer<typeof updateAlunoSchema>;
