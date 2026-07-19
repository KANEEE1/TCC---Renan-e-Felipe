import { z } from "zod";

export const createPresencaSchema = z.object({
  aulaId: z.string().cuid(),
  alunoId: z.string().cuid(),
  registradaPorId: z.string().cuid(),
  data: z.coerce.date(),
  status: z.enum(["PRESENTE", "AUSENTE", "JUSTIFICADA"])
});

export type CreatePresencaInput = z.infer<typeof createPresencaSchema>;
