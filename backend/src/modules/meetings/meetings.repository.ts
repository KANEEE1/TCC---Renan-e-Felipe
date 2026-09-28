import type { PrismaClient } from "@prisma/client";
import { parseTimeToDate } from "../../shared/time.js";
import type { CreateMeetingInput, UpdateMeetingInput } from "./meetings.schemas.js";

export class MeetingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.reuniao.findMany({ orderBy: [{ data: "asc" }, { horarioInicio: "asc" }] });
  }

  findById(id: string) {
    return this.prisma.reuniao.findUnique({ where: { id } });
  }

  create(data: CreateMeetingInput) {
    return this.prisma.reuniao.create({
      data: {
        ...data,
        horarioInicio: parseTimeToDate(data.horarioInicio),
        horarioFim: parseTimeToDate(data.horarioFim),
        participantes: data.participantes ?? []
      }
    });
  }

  update(id: string, data: UpdateMeetingInput) {
    return this.prisma.reuniao.update({
      where: { id },
      data: {
        ...data,
        horarioInicio: data.horarioInicio ? parseTimeToDate(data.horarioInicio) : undefined,
        horarioFim: data.horarioFim ? parseTimeToDate(data.horarioFim) : undefined
      }
    });
  }

  remove(id: string) {
    return this.prisma.reuniao.delete({ where: { id } });
  }
}
