import { z } from "zod";

export const createDisciplinaSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional()
});

export type CreateDisciplinaInput = z.infer<typeof createDisciplinaSchema>;
