import { z } from "zod";
import { parseDateOnly } from "../../shared/time.js";
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

export const suggestScheduleSchema = z.object({
  pedidos: z
    .array(
      z.object({
        professorId: z.string().cuid(),
        disciplinaId: z.string().cuid(),
        turmaId: z.string().cuid(),
        quantidade: z.number().int().min(1).max(20),
        sala: z.string().min(1).optional(),
        tipo: tipoAulaSchema.optional()
      })
    )
    .min(1)
});

export const confirmScheduleSchema = z.object({
  aulas: z.array(createAulaSchema).min(1)
});

export const generateScheduleSchema = z.object({
  turmaId: z.string().cuid(),
  professoresExcluidos: z.array(z.string().cuid()).optional(),
  // Assinaturas de grades já mostradas ao gestor ("Gerar novamente" pede uma diferente delas).
  evitar: z.array(z.string().min(1).max(64)).max(100).optional()
});

export const replaceScheduleSchema = z.object({
  turmaId: z.string().cuid(),
  aulas: z
    .array(createAulaSchema.omit({ turmaId: true, sala: true, tipo: true }))
    .min(1)
});

// Na edição, sala: null remove a sala (omitir o campo mantém a atual).
export const updateAulaSchema = createAulaSchema.partial().extend({ sala: z.string().min(1).nullable().optional() });

const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = parseDateOnly(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid date");

export const ocorrenciaParamsSchema = z.object({ id: z.string().min(1), dataOriginal: dataSchema });

// Campos omitidos herdam os da ocorrência atual.
export const updateOcorrenciaSchema = z.object({
  data: dataSchema.optional(),
  horarioInicio: createAulaSchema.shape.horarioInicio.optional(),
  horarioFim: createAulaSchema.shape.horarioFim.optional(),
  professorId: z.string().cuid().optional()
});

export type CreateAulaInput = z.infer<typeof createAulaSchema>;
export type UpdateAulaInput = z.infer<typeof updateAulaSchema>;
export type SuggestScheduleInput = z.infer<typeof suggestScheduleSchema>;
export type ConfirmScheduleInput = z.infer<typeof confirmScheduleSchema>;
export type GenerateScheduleInput = z.infer<typeof generateScheduleSchema>;
export type ReplaceScheduleInput = z.infer<typeof replaceScheduleSchema>;
export type UpdateOcorrenciaInput = z.infer<typeof updateOcorrenciaSchema>;
