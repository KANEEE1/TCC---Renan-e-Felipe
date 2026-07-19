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
  periodoLetivoId: z.string().cuid(),
  diaSemana: diaSemanaSchema,
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/)
});

export type CreateDisponibilidadeInput = z.infer<typeof createDisponibilidadeSchema>;
