import { z } from "zod";

export const createSimuladoSchema = z.object({
  nome: z.string().min(1),
  data: z.coerce.date()
});

export type CreateSimuladoInput = z.infer<typeof createSimuladoSchema>;
