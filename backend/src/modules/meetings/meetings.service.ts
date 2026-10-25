import { formatTimeHHMM } from "../../shared/time.js";
import { hasRole, type Actor } from "../../shared/auth.js";
import { HttpError } from "../../shared/http.js";
import type { CreateMeetingInput, UpdateMeetingInput } from "./meetings.schemas.js";
import type { MeetingsRepository } from "./meetings.repository.js";

function assertValidRange(horarioInicio: string, horarioFim: string) {
  if (horarioFim <= horarioInicio) {
    throw new HttpError(400, "Meeting end time must be after start time");
  }
}

export class MeetingsService {
  constructor(private readonly meetingsRepository: MeetingsRepository) {}

  async list(actor: Actor) {
    const meetings = await this.meetingsRepository.list();
    return meetings.map((meeting) => this.toResponse(meeting, actor));
  }

  async getById(id: string, actor: Actor) {
    return this.toResponse(await this.findOrThrow(id), actor);
  }

  async create(input: CreateMeetingInput, actor: Actor) {
    assertValidRange(input.horarioInicio, input.horarioFim);

    return this.toResponse(await this.meetingsRepository.create(input, actor.id), actor);
  }

  async update(id: string, input: UpdateMeetingInput, actor: Actor) {
    const current = await this.findOrThrow(id);

    if (!this.canManage(current, actor)) {
      throw new HttpError(403, "Only the meeting creator or management can modify this meeting");
    }

    assertValidRange(input.horarioInicio ?? formatTimeHHMM(current.horarioInicio), input.horarioFim ?? formatTimeHHMM(current.horarioFim));

    return this.toResponse(await this.meetingsRepository.update(id, input), actor);
  }

  async remove(id: string, actor: Actor) {
    const current = await this.findOrThrow(id);

    if (!this.canManage(current, actor)) {
      throw new HttpError(403, "Only the meeting creator or management can modify this meeting");
    }

    await this.meetingsRepository.remove(id);
  }

  private async findOrThrow(id: string) {
    const meeting = await this.meetingsRepository.findById(id);

    if (!meeting) {
      throw new HttpError(404, "Meeting not found");
    }

    return meeting;
  }

  private canManage(meeting: { criadoPorId: string | null }, actor: Actor) {
    return hasRole(actor, "GESTAO") || (meeting.criadoPorId !== null && meeting.criadoPorId === actor.id);
  }

  private toResponse<T extends { criadoPorId: string | null }>(meeting: T, actor: Actor) {
    const canManage = this.canManage(meeting, actor);
    return { ...meeting, permissoes: { editar: canManage, excluir: canManage } };
  }
}
