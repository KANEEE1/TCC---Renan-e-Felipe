import { z } from "zod";

export const diaSemanaSchema = z.enum([
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
  "DOMINGO"
]);

export const createDisponibilidadeSchema = z.object({
  professorId: z.string().cuid(),
  periodoLetivo: z.string().min(1),
  diaSemana: diaSemanaSchema,
  horarioInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horarioFim: z.string().regex(/^\d{2}:\d{2}$/)
});

export type CreateDisponibilidadeInput = z.infer<typeof createDisponibilidadeSchema>;
