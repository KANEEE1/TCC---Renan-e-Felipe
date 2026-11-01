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
    await this.assertPresenca(input.tipo, input.exigePresenca ?? false, convidadoIds, turmas, input.semProfessores);
    if (input.exigePresenca) this.assertComecaNoFuturo(isoDate(input.data), input.horarioInicio);
    const semProfessores = await this.resolveSemProfessores(convidadoIds, input.semProfessores ?? false);

    return this.toResponse(await this.meetingsRepository.create({ ...fields, semProfessores }, actor.id, convidadoIds, turmas), actor);
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

    const participantesFinais = syncedIds ?? current.participacoes.map((participacao) => participacao.userId);
    const turmasFinais = turmas ?? current.turmas.map((turma) => turma.id);
    const exigePresenca = input.exigePresenca ?? current.exigePresenca;
    await this.assertPresenca(input.tipo ?? current.tipo, exigePresenca, participantesFinais, turmasFinais, input.semProfessores);
    await this.assertPresencaEditavel(current, input, participantesFinais, turmasFinais);
    // Ligar a presença ou remarcar uma aula com presença: o início tem de ser futuro (editar outros campos não revalida).
    const remarcadaAgora =
      (input.data !== undefined && isoDate(input.data) !== isoDate(current.data)) ||
      (input.horarioInicio !== undefined && input.horarioInicio !== formatTimeHHMM(current.horarioInicio));
    if (exigePresenca && (!current.exigePresenca || remarcadaAgora)) {
      this.assertComecaNoFuturo(input.data ? isoDate(input.data) : isoDate(current.data), input.horarioInicio ?? formatTimeHHMM(current.horarioInicio));
    }
    fields.semProfessores = await this.resolveSemProfessores(participantesFinais, input.semProfessores ?? current.semProfessores);

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

    if (current.exigePresenca && (await this.meetingsRepository.countPresencas(id)) > 0) {
      throw new HttpError(409, "Este evento já tem presença registrada e não pode ser excluído");
    }

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

  // Evento precisa de ao menos um professor, a menos que a gestão marque que não precisa. Retorna o valor a gravar.
  private async resolveSemProfessores(participanteIds: string[], semProfessores: boolean) {
    const temProfessor = participanteIds.length > 0 && (await this.meetingsRepository.findProfessorIds(participanteIds)).length > 0;

    if (temProfessor) return false;
    if (!semProfessores) {
      throw new HttpError(400, "Inclua pelo menos um professor ou marque que o evento não precisa de professores");
    }
    return true;
  }

  // Aula comum com presença: só no tipo AULA, com exatamente 1 participante (professor) e ao menos 1 turma.
  private async assertPresenca(
    tipo: CreateMeetingInput["tipo"],
    exigePresenca: boolean,
    participanteIds: string[],
    turmaIds: string[],
    semProfessores: boolean | undefined
  ) {
    if (!exigePresenca) return;
    if (tipo !== "AULA") throw new HttpError(400, "Só a aula comum pode exigir presença");
    if (semProfessores) throw new HttpError(400, "Uma aula com presença precisa de professor");
    if (participanteIds.length !== 1 || (await this.meetingsRepository.findProfessorIds(participanteIds)).length !== 1) {
      throw new HttpError(400, "Uma aula com presença precisa de exatamente um professor, e ninguém mais como participante");
    }
    if (turmaIds.length === 0) throw new HttpError(400, "Uma aula com presença precisa de ao menos uma turma");
  }

  private assertComecaNoFuturo(data: string, horarioInicio: string) {
    if (jaComecou({ data, horarioInicio }, agora())) throw new HttpError(400, "Uma aula com presença precisa começar no futuro");
  }

  // Presença, professor, turmas (e data/horário, dos quais a janela depende) ficam travados quando a aula começa.
  private async assertPresencaEditavel(
    current: MeetingWithParticipants,
    input: UpdateMeetingInput,
    participantesFinais: string[],
    turmasFinais: string[]
  ) {
    const mesmoConjunto = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));
    const desligando = current.exigePresenca && input.exigePresenca === false;
    if (desligando && (await this.meetingsRepository.countPresencas(current.id)) > 0) {
      throw new HttpError(409, "Esta aula já tem presença registrada; não é possível desligar a presença");
    }

    if (!jaComecou({ data: isoDate(current.data), horarioInicio: formatTimeHHMM(current.horarioInicio) }, agora())) return;

    const mudouPresenca = input.exigePresenca !== undefined && input.exigePresenca !== current.exigePresenca;
    const exigePresenca = input.exigePresenca ?? current.exigePresenca;
    const mudouParticipantes = !mesmoConjunto(participantesFinais, current.participacoes.map((participacao) => participacao.userId));
    const mudouTurmas = !mesmoConjunto(turmasFinais, current.turmas.map((turma) => turma.id));
    if (mudouPresenca || (exigePresenca && (mudouParticipantes || mudouTurmas))) {
      throw new HttpError(409, "A aula já começou: não é possível mudar a presença, o professor ou as turmas");
    }

    const mudouQuando =
      (input.data !== undefined && isoDate(input.data) !== isoDate(current.data)) ||
      (input.horarioInicio !== undefined && input.horarioInicio !== formatTimeHHMM(current.horarioInicio)) ||
      (input.horarioFim !== undefined && input.horarioFim !== formatTimeHHMM(current.horarioFim));
    if (current.exigePresenca && mudouQuando) {
      throw new HttpError(409, "A aula já começou: não é possível mudar a data nem o horário de uma aula com presença");
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
