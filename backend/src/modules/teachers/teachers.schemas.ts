import { z } from "zod";

export const createTeacherSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  celular: z.string().min(1).optional(),
  password: z.string().min(8),
  disciplinaIds: z.array(z.string().cuid()).optional()
});

export const updateTeacherSchema = z.object({
  name: z.string().min(1).optional(),
  celular: z.string().min(1).optional(),
  ativo: z.boolean().optional(),
  disciplinaIds: z.array(z.string().cuid()).optional()
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
