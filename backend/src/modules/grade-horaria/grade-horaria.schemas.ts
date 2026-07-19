import { z } from "zod";
import { diaSemanaSchema } from "../disponibilidade/disponibilidade.schemas.js";

export const createAulaSchema = z.object({
  turmaId: z.string().cuid(),
  disciplinaId: z.string().cuid(),
  professorId: z.string().cuid(),
  periodoLetivoId: z.string().cuid(),
  diaSemana: diaSemanaSchema,
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/),
  sala: z.string().min(1).optional()
});

export type CreateAulaInput = z.infer<typeof createAulaSchema>;
