import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  celular: z.string().min(1).optional(),
  passwordHash: z.string().min(1),
  roles: z.array(z.enum(["GESTAO", "PROFESSOR"])).min(1)
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
