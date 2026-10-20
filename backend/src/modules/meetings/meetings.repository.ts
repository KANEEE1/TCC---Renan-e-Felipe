import type { PrismaClient } from "@prisma/client";
import { parseTimeToDate } from "../../shared/time.js";
import type { CreateMeetingInput, UpdateMeetingInput } from "./meetings.schemas.js";

const meetingInclude = {
  criadoPor: { select: { id: true, name: true } }
} as const;

export class MeetingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.reuniao.findMany({
      include: meetingInclude,
      orderBy: [{ data: "asc" }, { horarioInicio: "asc" }]
    });
  }

  findById(id: string) {
    return this.prisma.reuniao.findUnique({ where: { id }, include: meetingInclude });
  }

  create(data: CreateMeetingInput, criadoPorId: string) {
    return this.prisma.reuniao.create({
      data: {
        ...data,
        horarioInicio: parseTimeToDate(data.horarioInicio),
        horarioFim: parseTimeToDate(data.horarioFim),
        participantes: data.participantes ?? [],
        criadoPorId
      },
      include: meetingInclude
    });
  }

  update(id: string, data: UpdateMeetingInput) {
    return this.prisma.reuniao.update({
      where: { id },
      data: {
        ...data,
        horarioInicio: data.horarioInicio ? parseTimeToDate(data.horarioInicio) : undefined,
        horarioFim: data.horarioFim ? parseTimeToDate(data.horarioFim) : undefined
      },
      include: meetingInclude
    });
  }

  remove(id: string) {
    return this.prisma.reuniao.delete({ where: { id } });
  }
}
