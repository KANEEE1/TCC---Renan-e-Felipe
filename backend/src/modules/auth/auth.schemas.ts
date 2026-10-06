import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  celular: z.string().min(1).optional(),
  departamento: z.string().min(1).optional(),
  bio: z.string().min(1).optional()
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
