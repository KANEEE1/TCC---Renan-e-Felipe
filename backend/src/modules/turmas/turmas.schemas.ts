import { z } from "zod";
import { diaSemanaSchema } from "../disponibilidade/disponibilidade.schemas.js";

const cargaSchema = z
  .object({
    disciplinaId: z.string().cuid().optional(),
    nome: z.string().trim().min(1).optional(),
    aulasPorSemana: z.number().int().min(1).max(20),
    duracaoMinutos: z.number().int().min(30).max(240).multipleOf(5)
  })
  .refine((carga) => (carga.disciplinaId === undefined) !== (carga.nome === undefined), {
    message: "Informe exatamente um entre disciplinaId e nome"
  });

export const createTurmaSchema = z.object({
  nome: z.string().min(1),
  anoLetivo: z.number().int().min(2000),
  turno: z.string().min(1).optional(),
  sala: z.string().min(1).optional(),
  coordenador: z.string().min(1).optional(),
  capacidade: z.number().int().min(1).optional(),
  disciplinas: z.array(cargaSchema).optional()
});

export const updateTurmaSchema = createTurmaSchema.partial();

export type CargaInput = z.infer<typeof cargaSchema>;
export type CreateTurmaInput = z.infer<typeof createTurmaSchema>;
export type UpdateTurmaInput = z.infer<typeof updateTurmaSchema>;

const horarioSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const putJanelasSchema = z.object({
  janelas: z.array(
    z.object({
      diaSemana: diaSemanaSchema,
      horarioInicio: horarioSchema,
      horarioFim: horarioSchema
    })
  )
});

export type PutJanelasInput = z.infer<typeof putJanelasSchema>;
