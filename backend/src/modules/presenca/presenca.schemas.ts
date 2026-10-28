import { boundedNumberQuery } from "../../shared/query.js";
import { z } from "zod";

export const markAttendanceSchema = z.object({
  aulaId: z.string().cuid(),
  // Opcional: o servidor sempre usa "hoje"; se vier, precisa ser a data de hoje.
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
  limite: boundedNumberQuery(0, 100, 75)
});

export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
