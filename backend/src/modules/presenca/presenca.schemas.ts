import { z } from "zod";

export const createPresencaSchema = z.object({
  aulaId: z.string().cuid(),
  alunoId: z.string().cuid(),
  presente: z.boolean(),
  data: z.coerce.date()
});

export type CreatePresencaInput = z.infer<typeof createPresencaSchema>;
