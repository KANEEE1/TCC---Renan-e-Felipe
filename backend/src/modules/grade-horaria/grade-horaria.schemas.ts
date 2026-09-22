import { z } from "zod";
import { diaSemanaSchema } from "../disponibilidade/disponibilidade.schemas.js";

const tipoAulaSchema = z.enum(["AULA", "PLANTAO", "AULAO"]);

export const createAulaSchema = z.object({
  turmaId: z.string().cuid(),
  disciplinaId: z.string().cuid(),
  professorId: z.string().cuid(),
  diaSemana: diaSemanaSchema,
  horarioInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horarioFim: z.string().regex(/^\d{2}:\d{2}$/),
  sala: z.string().min(1).optional(),
  tipo: tipoAulaSchema.optional()
});

export const updateAulaSchema = createAulaSchema.partial();

export type CreateAulaInput = z.infer<typeof createAulaSchema>;
export type UpdateAulaInput = z.infer<typeof updateAulaSchema>;
