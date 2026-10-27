import { z } from "zod";

export const createTeacherSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  celular: z.string().min(1).optional(),
  password: z.string().min(8),
  disciplinaIds: z.array(z.string().cuid()).optional()
});

// A gestão altera só disciplinas e status; os dados pessoais são do próprio professor (PUT /auth/me).
export const updateTeacherSchema = z
  .object({
    ativo: z.boolean().optional(),
    disciplinaIds: z.array(z.string().cuid()).optional()
  })
  .strict();

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
