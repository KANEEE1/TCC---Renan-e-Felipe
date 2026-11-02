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
  turmaIds: z.array(z.string().cuid()).optional(),
  disciplinaId: z.string().min(1).optional(),
  semProfessores: z.boolean().optional(),
  exigePresenca: z.boolean().optional(),
  // Só no simulado (obrigatórios nele): quem lança as notas, até quando (data) e a nota máxima da prova.
  corretorIds: z.array(z.string().min(1)).optional(),
  prazoCorrecao: z.coerce.date().optional(),
  pontuacaoMaxima: z.number().positive("A pontuação máxima precisa ser maior que zero").optional()
});

// A matéria não entra na edição: é definida na criação e não muda depois.
export const updateMeetingSchema = createMeetingSchema.omit({ disciplinaId: true }).partial();

export const rsvpSchema = z.object({
  status: z.enum(["CONFIRMADO", "RECUSADO"])
});

export type RsvpInput = z.infer<typeof rsvpSchema>;
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
