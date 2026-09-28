import { z } from "zod";

const tipoReuniaoSchema = z.enum(["AULAO", "SIMULADO", "REVISAO"]);

export const createMeetingSchema = z.object({
  titulo: z.string().min(1),
  tipo: tipoReuniaoSchema,
  data: z.coerce.date(),
  horarioInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horarioFim: z.string().regex(/^\d{2}:\d{2}$/),
  local: z.string().min(1).optional(),
  descricao: z.string().min(1).optional(),
  participantes: z.array(z.string().min(1)).optional()
});

export const updateMeetingSchema = createMeetingSchema.partial();

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
