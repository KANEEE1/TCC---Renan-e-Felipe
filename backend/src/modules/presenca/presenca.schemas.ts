import { z } from "zod";

export const createPresencaSchema = z.object({
  aulaId: z.string().cuid(),
  alunoId: z.string().cuid(),
  presente: z.boolean(),
  data: z.coerce.date()
});

export const markAttendanceSchema = z.object({
  aulaId: z.string().cuid(),
  data: z.coerce.date(),
  entries: z
    .array(
      z.object({
        alunoId: z.string().cuid(),
        presente: z.boolean()
      })
    )
    .min(1)
});

export const attendanceSummaryQuerySchema = z.object({
  turmaId: z.string().min(1).optional(),
  limite: z.coerce.number().min(0).max(100).default(75)
});

export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>;
export type CreatePresencaInput = z.infer<typeof createPresencaSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
