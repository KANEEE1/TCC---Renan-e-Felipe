import { z } from "zod";

export const createSubstituicaoSchema = z.object({
  ausenciaId: z.string().min(1),
  substitutoId: z.string().min(1)
});

export const candidatesQuerySchema = z.object({
  ausenciaId: z.string().min(1)
});

export type CreateSubstituicaoInput = z.infer<typeof createSubstituicaoSchema>;
