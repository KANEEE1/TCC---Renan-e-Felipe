import { z } from "zod";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid date");

export const createAusenciaSchema = z.object({
  aulaId: z.string().min(1),
  data: dateOnlySchema,
  motivo: z.string().trim().min(1).max(500).optional()
});

export const listAusenciasQuerySchema = z.object({
  de: dateOnlySchema.optional(),
  ate: dateOnlySchema.optional()
});

export type CreateAusenciaInput = z.infer<typeof createAusenciaSchema>;
export type ListAusenciasQuery = z.infer<typeof listAusenciasQuerySchema>;
