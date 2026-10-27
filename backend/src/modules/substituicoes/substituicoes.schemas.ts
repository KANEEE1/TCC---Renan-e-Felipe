import { z } from "zod";

export const createSubstituicaoSchema = z.object({
  ausenciaId: z.string().min(1),
  substitutoId: z.string().min(1)
});

export const candidatesQuerySchema = z.object({
  ausenciaId: z.string().min(1)
});

export const mineQuerySchema = z.object({
  status: z.enum(["PENDENTE", "ACEITA", "RECUSADA"]).optional()
});

export const respondSubstituicaoSchema = z.object({
  status: z.enum(["ACEITA", "RECUSADA"])
});

export type RespondSubstituicaoInput = z.infer<typeof respondSubstituicaoSchema>;
export type CreateSubstituicaoInput = z.infer<typeof createSubstituicaoSchema>;
