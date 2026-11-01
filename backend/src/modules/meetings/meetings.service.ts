import { agora } from "../../shared/clock.js";
import { formatTimeHHMM } from "../../shared/time.js";
import { hasRole, type Actor } from "../../shared/auth.js";
import { HttpError } from "../../shared/http.js";
import { isoDate, jaComecou } from "../grade-horaria/ocorrencias.js";
import type { CreateMeetingInput, RsvpInput, UpdateMeetingInput } from "./meetings.schemas.js";
import type { MeetingsRepository } from "./meetings.repository.js";

function assertValidRange(horarioInicio: string, horarioFim: string) {
  if (horarioFim <= horarioInicio) {
    throw new HttpError(400, "Meeting end time must be after start time");
  }
}

type MeetingWithParticipants = Awaited<ReturnType<MeetingsRepository["findById"]>> & {};

// Tipos de evento que acontecem como aula e exigem a matéria.
const TIPOS_COM_MATERIA = new Set<string>(["AULA", "AULAO"]);

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
    await this.assertMateria(input.tipo, input.disciplinaId);

    const { participanteIds, turmaIds, ...fields } = input;
    const convidadoIds = [...new Set(participanteIds ?? [])];
    const turmas = [...new Set(turmaIds ?? [])];
    await this.assertActiveUsers(convidadoIds);
    await this.assertTurmas(turmas);

    return this.toResponse(await this.meetingsRepository.create(fields, actor.id, convidadoIds, turmas), actor);
  }

  async update(id: string, input: UpdateMeetingInput, actor: Actor) {
    const current = await this.findOrThrow(id);

    assertValidRange(input.horarioInicio ?? formatTimeHHMM(current.horarioInicio), input.horarioFim ?? formatTimeHHMM(current.horarioFim));

    // A matéria é imutável: o tipo só muda dentro do mesmo grupo (Aula comum ↔ Aulão, Reunião ↔ Simulado).
    if (input.tipo !== undefined && TIPOS_COM_MATERIA.has(input.tipo) !== TIPOS_COM_MATERIA.has(current.tipo)) {
      throw new HttpError(
        400,
        TIPOS_COM_MATERIA.has(input.tipo)
          ? "Para virar aula ou aulão, crie um novo evento com a matéria"
          : "Aula e aulão só podem mudar entre si (a matéria não pode ser removida)"
      );
    }

    const { participanteIds, turmaIds, ...fields } = input;
    let syncedIds: string[] | undefined;

    if (participanteIds) {
      syncedIds = [...new Set(participanteIds)];
      const atuais = new Set(current.participacoes.map((participacao) => participacao.userId));
      await this.assertActiveUsers(syncedIds.filter((userId) => !atuais.has(userId)));
    }

    const turmas = turmaIds ? [...new Set(turmaIds)] : undefined;
    if (turmas) await this.assertTurmas(turmas);

    // Mudou a data ou o horário: é uma remarcação. Quem já participava precisa confirmar de novo.
    const remarcado =
      (fields.data !== undefined && fields.data.toISOString().slice(0, 10) !== current.data.toISOString().slice(0, 10)) ||
      (fields.horarioInicio !== undefined && fields.horarioInicio !== formatTimeHHMM(current.horarioInicio)) ||
      (fields.horarioFim !== undefined && fields.horarioFim !== formatTimeHHMM(current.horarioFim));
    const remarcarIds = remarcado ? current.participacoes.map((participacao) => participacao.userId) : [];

    // Quem saiu da lista de participantes de um evento que ainda não começou recebe um aviso de retirada (menos o editor).
    const dataFinal = fields.data ? isoDate(fields.data) : isoDate(current.data);
    const inicioFinal = fields.horarioInicio ?? formatTimeHHMM(current.horarioInicio);
    const retiradosIds =
      syncedIds && !jaComecou({ data: dataFinal, horarioInicio: inicioFinal }, agora())
        ? current.participacoes
            .map((participacao) => participacao.userId)
            .filter((userId) => userId !== actor.id && !syncedIds.includes(userId))
        : [];

    return this.toResponse(
      await this.meetingsRepository.update(id, fields, actor.id, syncedIds, turmas, remarcarIds, retiradosIds),
      actor
    );
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

    // Evento que ainda não começou: todos os participantes (qualquer status), menos quem excluiu, são avisados do cancelamento.
    const avisos = jaComecou({ data: isoDate(current.data), horarioInicio: formatTimeHHMM(current.horarioInicio) }, agora())
      ? []
      : current.participacoes
          .filter((participacao) => participacao.userId !== actor.id)
          .map((participacao) => ({
            userId: participacao.userId,
            titulo: current.titulo,
            turma: current.turmas.length > 0 ? current.turmas.map((turma) => turma.nome).join(", ") : null,
            data: current.data,
            horarioInicio: current.horarioInicio,
            horarioFim: current.horarioFim
          }));

    await this.meetingsRepository.remove(id, avisos);
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

  private async assertTurmas(ids: string[]) {
    if (ids.length === 0) return;

    if ((await this.meetingsRepository.countTurmas(ids)) !== ids.length) {
      throw new HttpError(400, "One or more classes do not exist");
    }
  }

  private async assertMateria(tipo: CreateMeetingInput["tipo"], disciplinaId: string | undefined) {
    if (!TIPOS_COM_MATERIA.has(tipo)) {
      if (disciplinaId !== undefined) throw new HttpError(400, "Só aula e aulão têm matéria");
      return;
    }

    if (!disciplinaId) throw new HttpError(400, "Informe a matéria da aula");
    if (!(await this.meetingsRepository.disciplinaExiste(disciplinaId))) {
      throw new HttpError(400, "Matéria não encontrada");
    }
  }

  private toResponse(meeting: MeetingWithParticipants, actor: Actor) {
    const { participacoes, ...rest } = meeting;
    const canManage = hasRole(actor, "GESTAO");
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
      meuRemarcado: minha?.remarcado ?? false,
      permissoes: { editar: canManage, excluir: canManage, responder: !!minha }
    };
  }
}
