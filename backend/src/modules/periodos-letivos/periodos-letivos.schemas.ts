import { z } from "zod";

export const createPeriodoLetivoSchema = z.object({
  name: z.string().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  active: z.boolean().optional()
});

export type CreatePeriodoLetivoInput = z.infer<typeof createPeriodoLetivoSchema>;
