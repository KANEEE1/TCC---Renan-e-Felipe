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

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const createDisponibilidadeSchema = z.object({
  professorId: z.string().cuid(),
  diaSemana: diaSemanaSchema,
  horarioInicio: timeSchema,
  horarioFim: timeSchema
});

export const updateDisponibilidadeSchema = z
  .object({
    diaSemana: diaSemanaSchema,
    horarioInicio: timeSchema,
    horarioFim: timeSchema
  })
  .partial();

export type CreateDisponibilidadeInput = z.infer<typeof createDisponibilidadeSchema>;
export type UpdateDisponibilidadeInput = z.infer<typeof updateDisponibilidadeSchema>;
