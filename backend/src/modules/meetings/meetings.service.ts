import { formatTimeHHMM } from "../../shared/time.js";
import { hasRole, type Actor } from "../../shared/auth.js";
import { HttpError } from "../../shared/http.js";
import type { CreateMeetingInput, RsvpInput, UpdateMeetingInput } from "./meetings.schemas.js";
import type { MeetingsRepository } from "./meetings.repository.js";

function assertValidRange(horarioInicio: string, horarioFim: string) {
  if (horarioFim <= horarioInicio) {
    throw new HttpError(400, "Meeting end time must be after start time");
  }
}

type MeetingWithParticipants = Awaited<ReturnType<MeetingsRepository["findById"]>> & {};

export class MeetingsService {
  constructor(private readonly meetingsRepository: MeetingsRepository) {}

  listParticipantOptions() {
    return this.meetingsRepository.listParticipantOptions();
  }

  async list(actor: Actor) {
    const meetings = await this.meetingsRepository.list();
    return meetings.map((meeting) => this.toResponse(meeting, actor));
  }

  async getById(id: string, actor: Actor) {
    return this.toResponse(await this.findOrThrow(id), actor);
  }

  async create(input: CreateMeetingInput, actor: Actor) {
    assertValidRange(input.horarioInicio, input.horarioFim);

    const { participanteIds, ...fields } = input;
    const convidadoIds = [...new Set(participanteIds ?? [])].filter((id) => id !== actor.id);
    await this.assertActiveUsers(convidadoIds);

    return this.toResponse(await this.meetingsRepository.create(fields, actor.id, convidadoIds), actor);
  }

  async update(id: string, input: UpdateMeetingInput, actor: Actor) {
    const current = await this.findOrThrow(id);

    if (!this.canManage(current, actor)) {
      throw new HttpError(403, "Only the meeting creator or management can modify this meeting");
    }

    assertValidRange(input.horarioInicio ?? formatTimeHHMM(current.horarioInicio), input.horarioFim ?? formatTimeHHMM(current.horarioFim));

    const { participanteIds, ...fields } = input;
    let syncedIds: string[] | undefined;

    if (participanteIds) {
      syncedIds = [...new Set(participanteIds)];
      if (current.criadoPorId && !syncedIds.includes(current.criadoPorId)) {
        syncedIds.push(current.criadoPorId);
      }
      const atuais = new Set(current.participacoes.map((participacao) => participacao.userId));
      await this.assertActiveUsers(syncedIds.filter((userId) => !atuais.has(userId)));
    }

    return this.toResponse(await this.meetingsRepository.update(id, fields, syncedIds), actor);
  }

  async respond(id: string, input: RsvpInput, actor: Actor) {
    const current = await this.findOrThrow(id);

    if (!current.participacoes.some((participacao) => participacao.userId === actor.id)) {
      throw new HttpError(403, "Only meeting participants can respond to this meeting");
    }

    await this.meetingsRepository.updateParticipacaoStatus(id, actor.id, input.status);

    return this.toResponse(await this.findOrThrow(id), actor);
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

  private async assertActiveUsers(ids: string[]) {
    if (ids.length === 0) return;

    const active = await this.meetingsRepository.findActiveUserIds(ids);

    if (active.length !== ids.length) {
      throw new HttpError(400, "One or more participants do not exist or are inactive");
    }
  }

  private canManage(meeting: { criadoPorId: string | null }, actor: Actor) {
    return hasRole(actor, "GESTAO") || (meeting.criadoPorId !== null && meeting.criadoPorId === actor.id);
  }

  private toResponse(meeting: MeetingWithParticipants, actor: Actor) {
    const { participacoes, ...rest } = meeting;
    const canManage = this.canManage(meeting, actor);
    const minha = participacoes.find((participacao) => participacao.userId === actor.id);

    const participantes = participacoes
      .map((participacao) => ({ userId: participacao.userId, name: participacao.user.name, status: participacao.status }))
      .sort((a, b) => {
        if (a.userId === meeting.criadoPorId) return -1;
        if (b.userId === meeting.criadoPorId) return 1;
        return a.name.localeCompare(b.name, "pt-BR");
      });

    return {
      ...rest,
      participantes,
      meuStatus: minha?.status ?? null,
      permissoes: { editar: canManage, excluir: canManage, responder: !!minha }
    };
  }
}
