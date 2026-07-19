import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  passwordHash: z.string().min(1),
  role: z.enum(["GESTAO", "PROFESSOR"])
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
