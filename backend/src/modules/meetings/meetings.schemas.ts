import { z } from "zod";

const tipoReuniaoSchema = z.enum(["REUNIAO", "SIMULADO", "AULAO", "AULA"]);

export const createMeetingSchema = z.object({
  titulo: z.string().min(1),
  tipo: tipoReuniaoSchema,
  data: z.coerce.date(),
  horarioInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horarioFim: z.string().regex(/^\d{2}:\d{2}$/),
  local: z.string().min(1).optional(),
  descricao: z.string().min(1).optional(),
  participanteIds: z.array(z.string().min(1)).optional(),
  turmaIds: z.array(z.string().cuid()).optional()
});

export const updateMeetingSchema = createMeetingSchema.partial();

export const rsvpSchema = z.object({
  status: z.enum(["CONFIRMADO", "RECUSADO"])
});

export type RsvpInput = z.infer<typeof rsvpSchema>;
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
