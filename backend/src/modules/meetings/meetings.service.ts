import { agora } from "../../shared/clock.js";
import { formatTimeHHMM, todayInSaoPaulo } from "../../shared/time.js";
import { hasRole, type Actor } from "../../shared/auth.js";
import { HttpError } from "../../shared/http.js";
import { isoDate, jaComecou } from "../grade-horaria/ocorrencias.js";
import type { SimuladosService } from "../simulados/simulados.service.js";
import type { CreateMeetingInput, RsvpInput, UpdateMeetingInput } from "./meetings.schemas.js";
import type { MeetingsRepository, UpdateMeetingFields } from "./meetings.repository.js";

function assertValidRange(horarioInicio: string, horarioFim: string) {
  if (horarioFim <= horarioInicio) {
    throw new HttpError(400, "Meeting end time must be after start time");
  }
}

type MeetingWithParticipants = Awaited<ReturnType<MeetingsRepository["findById"]>> & {};

// Tipos de evento que acontecem como aula e exigem a matéria.
const TIPOS_COM_MATERIA = new Set<string>(["AULA", "AULAO"]);

const mesmoConjunto = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

// Configuração final de um simulado (o que veio na requisição, ou o valor atual).
interface ConfigSimulado {
  data: Date;
  turmaIds: string[];
  corretorIds: string[];
  // Corretores que ainda não estavam no simulado (só esses precisam ser professores ativos agora).
  novosCorretorIds: string[];
  prazoCorrecao: Date | null | undefined;
  pontuacaoMaxima: number | null | undefined;
  // O prazo foi definido ou mudou nesta requisição (aí não pode estar no passado).
  prazoNovo: boolean;
}

const informouCamposDeSimulado = (input: UpdateMeetingInput) =>
  (input.corretorIds?.length ?? 0) > 0 || input.prazoCorrecao !== undefined || input.pontuacaoMaxima !== undefined;

export class MeetingsService {
  constructor(
    private readonly meetingsRepository: MeetingsRepository,
    private readonly simuladosService: Pick<SimuladosService, "consolidarPrazos">
  ) {}

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

    const { participanteIds, turmaIds, corretorIds, ...fields } = input;
    const convidadoIds = [...new Set(participanteIds ?? [])];
    const turmas = [...new Set(turmaIds ?? [])];
    const corretores = [...new Set(corretorIds ?? [])];
    await this.assertActiveUsers(convidadoIds);
    await this.assertTurmas(turmas);
    if (input.tipo === "SIMULADO") {
      await this.assertSimuladoCompleto({
        data: input.data,
        turmaIds: turmas,
        corretorIds: corretores,
        novosCorretorIds: corretores,
        prazoCorrecao: input.prazoCorrecao,
        pontuacaoMaxima: input.pontuacaoMaxima,
        prazoNovo: true
      });
    } else if (informouCamposDeSimulado(input)) {
      throw new HttpError(400, "Só o simulado tem corretores, prazo da correção e pontuação máxima");
    }
    await this.assertPresenca(input.tipo, input.exigePresenca ?? false, convidadoIds, turmas, input.semProfessores);
    if (input.exigePresenca) this.assertComecaNoFuturo(isoDate(input.data), input.horarioInicio);
    const semProfessores = await this.resolveSemProfessores(convidadoIds, input.semProfessores ?? false);

    return this.toResponse(await this.meetingsRepository.create({ ...fields, semProfessores }, actor.id, convidadoIds, turmas, corretores), actor);
  }

  async update(id: string, input: UpdateMeetingInput, actor: Actor) {
    let current = await this.findOrThrow(id);
    // Simulado com prazo vencido ainda não consolidado: encerra antes, para a edição não reabrir a correção.
    if (current.tipo === "SIMULADO") {
      await this.simuladosService.consolidarPrazos();
      current = await this.findOrThrow(id);
    }

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

    const { participanteIds, turmaIds, corretorIds, ...rest } = input;
    const fields: UpdateMeetingFields = rest;
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
    const corretoresFinais = await this.resolveSimulado(current, input, fields, turmasFinais, corretorIds);

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
      await this.meetingsRepository.update(id, fields, actor.id, syncedIds, turmas, remarcarIds, retiradosIds, corretoresFinais),
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
    if (current.tipo === "SIMULADO" && (await this.meetingsRepository.countNotasSimulado(id)) > 0) {
      throw new HttpError(409, "Este simulado já tem notas e não pode ser excluído");
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

  // Simulado (inclusive um antigo, sem configuração, ou um evento que vira simulado): a edição exige a configuração completa.
  // Deixar de ser simulado limpa os campos dele. Devolve os corretores a gravar (undefined = não mudam).
  private async resolveSimulado(
    current: MeetingWithParticipants,
    input: UpdateMeetingInput,
    fields: UpdateMeetingFields,
    turmasFinais: string[],
    corretorIds: string[] | undefined
  ) {
    const tipo = input.tipo ?? current.tipo;
    const notas = current.tipo === "SIMULADO" ? await this.meetingsRepository.countNotasSimulado(current.id) : 0;

    if (tipo !== "SIMULADO") {
      if (informouCamposDeSimulado(input)) throw new HttpError(400, "Só o simulado tem corretores, prazo da correção e pontuação máxima");
      if (current.tipo !== "SIMULADO") return undefined;
      if (notas > 0) throw new HttpError(409, "Este simulado já tem notas: não é possível mudar o tipo do evento");
      Object.assign(fields, {
        pontuacaoMaxima: null,
        prazoCorrecao: null,
        correcaoEnviadaEm: null,
        correcaoEnviadaPorId: null,
        correcaoEncerradaEm: null,
        correcaoEncerradaCienteEm: null
      });
      return [];
    }

    const atuais = current.corretores.map((corretor) => corretor.id);
    const corretores = corretorIds ? [...new Set(corretorIds)] : atuais;
    const config: ConfigSimulado = {
      data: input.data ?? current.data,
      turmaIds: turmasFinais,
      corretorIds: corretores,
      novosCorretorIds: corretores.filter((userId) => !atuais.includes(userId)),
      prazoCorrecao: input.prazoCorrecao ?? current.prazoCorrecao,
      pontuacaoMaxima: input.pontuacaoMaxima ?? current.pontuacaoMaxima,
      prazoNovo: input.prazoCorrecao !== undefined && (!current.prazoCorrecao || isoDate(input.prazoCorrecao) !== isoDate(current.prazoCorrecao))
    };
    await this.assertSimuladoCompleto(config);

    // Com notas lançadas, o que define a correção (escala, alunos e quando ela abre) fica travado.
    const mudouQuando =
      isoDate(config.data) !== isoDate(current.data) ||
      (input.horarioInicio !== undefined && input.horarioInicio !== formatTimeHHMM(current.horarioInicio)) ||
      (input.horarioFim !== undefined && input.horarioFim !== formatTimeHHMM(current.horarioFim));
    const mudouTurmas = !mesmoConjunto(turmasFinais, current.turmas.map((turma) => turma.id));
    if (notas > 0 && (config.pontuacaoMaxima !== current.pontuacaoMaxima || mudouTurmas || mudouQuando)) {
      throw new HttpError(409, "Este simulado já tem notas: não é possível mudar a pontuação máxima, as turmas, a data nem o horário");
    }

    const mudouPrazo = !current.prazoCorrecao || isoDate(config.prazoCorrecao!) !== isoDate(current.prazoCorrecao);
    if ((current.correcaoEnviadaEm || current.correcaoEncerradaEm) && (mudouPrazo || !mesmoConjunto(corretores, atuais))) {
      throw new HttpError(409, "A correção deste simulado já foi enviada ou encerrada: não é possível mudar os corretores nem o prazo");
    }

    return corretorIds ? corretores : undefined;
  }

  // Simulado exige turmas, corretores (professores ativos), prazo da correção (não antes da data) e pontuação máxima.
  private async assertSimuladoCompleto(config: ConfigSimulado) {
    if (config.turmaIds.length === 0) throw new HttpError(400, "Um simulado precisa de ao menos uma turma");
    if (config.corretorIds.length === 0) throw new HttpError(400, "Escolha ao menos um corretor para o simulado");
    if (
      config.novosCorretorIds.length > 0 &&
      (await this.meetingsRepository.findActiveProfessorIds(config.novosCorretorIds)).length !== config.novosCorretorIds.length
    ) {
      throw new HttpError(400, "Os corretores precisam ser professores ativos");
    }
    if (!config.prazoCorrecao) throw new HttpError(400, "Informe o prazo da correção do simulado");
    if (isoDate(config.prazoCorrecao) < isoDate(config.data)) {
      throw new HttpError(400, "O prazo da correção não pode ser antes da data do simulado");
    }
    if (config.prazoNovo && isoDate(config.prazoCorrecao) < todayInSaoPaulo(agora())) {
      throw new HttpError(400, "O prazo da correção não pode estar no passado");
    }
    if (config.pontuacaoMaxima === null || config.pontuacaoMaxima === undefined) {
      throw new HttpError(400, "Informe a pontuação máxima do simulado");
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
    const { participacoes, corretores, ...rest } = meeting;
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
      corretores: corretores.map((corretor) => ({ userId: corretor.id, name: corretor.name })),
      meuStatus: minha?.status ?? null,
      meuRemarcado: minha?.remarcado ?? false,
      permissoes: { editar: canManage, excluir: canManage, responder: !!minha }
    };
  }
}
