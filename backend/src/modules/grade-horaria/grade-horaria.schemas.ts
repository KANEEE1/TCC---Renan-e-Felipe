import { z } from "zod";
import { diaSemanaSchema } from "../disponibilidade/disponibilidade.schemas.js";

export const createAulaSchema = z.object({
  turmaId: z.string().cuid(),
  disciplinaId: z.string().cuid(),
  professorId: z.string().cuid(),
  diaSemana: diaSemanaSchema,
  horarioInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horarioFim: z.string().regex(/^\d{2}:\d{2}$/)
});

export type CreateAulaInput = z.infer<typeof createAulaSchema>;
