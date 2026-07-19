import { z } from "zod";

export const createAlunoSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["ATIVO", "INATIVO"]).optional(),
  createdById: z.string().cuid().optional(),
  updatedById: z.string().cuid().optional()
});

export type CreateAlunoInput = z.infer<typeof createAlunoSchema>;
