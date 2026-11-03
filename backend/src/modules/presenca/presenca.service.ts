import type { Actor } from "../../shared/auth.js";
import { agora } from "../../shared/clock.js";
import { HttpError } from "../../shared/http.js";
import { diaSemanaOfDateOnly, formatTimeHHMM, parseDateOnly, timeOfDayInSaoPaulo, todayInSaoPaulo } from "../../shared/time.js";
import { matriculaVigente, turmaPorAluno } from "../matriculas/vigencia.js";
import type { GradeHorariaRepository } from "../grade-horaria/grade-horaria.repository.js";
import { dataNoPeriodo, gerarOcorrencias, isoDate, type Ocorrencia } from "../grade-horaria/ocorrencias.js";
import type { AttendanceSummaryQuery, MarkAttendanceInput } from "./presenca.schemas.js";
import type { PresencaRepository } from "./presenca.repository.js";

export interface SummaryMatricula {
  alunoId: string;
  aluno: { nome: string };
  turma: { id: string; nome: string };
}

export interface SummaryPresenca {
  alunoId: string;
  presente: boolean;
}

export function buildAttendanceSummary(matriculas: SummaryMatricula[], presencas: SummaryPresenca[], limite: number) {
  const counts = new Map<string, { total: number; presencas: number }>();
  for (const p of presencas) {
    const c = counts.get(p.alunoId) ?? { total: 0, presencas: 0 };
    c.total += 1;
    if (p.presente) c.presencas += 1;
    counts.set(p.alunoId, c);
  }

  const alunos = new Map<string, { alunoId: string; nome: string; turmas: { id: string; nome: string }[] }>();
  for (const m of matriculas) {
    const aluno = alunos.get(m.alunoId) ?? { alunoId: m.alunoId, nome: m.aluno.nome, turmas: [] };
    if (!aluno.turmas.some((t) => t.id === m.turma.id)) aluno.turmas.push(m.turma);
    alunos.set(m.alunoId, aluno);
  }

  const items = Array.from(alunos.values()).map((aluno) => {
    const c = counts.get(aluno.alunoId) ?? { total: 0, presencas: 0 };
    const semRegistros = c.total === 0;
    const percentual = semRegistros ? null : Math.round((c.presencas / c.total) * 1000) / 10;
    return {
      ...aluno,
      totalRegistros: c.total,
      presencas: c.presencas,
      faltas: c.total - c.presencas,
      percentual,
      abaixoDoLimite: !semRegistros && c.presencas * 100 < limite * c.total,
      semRegistros
    };
  });

  items.sort((a, b) => {
    if (a.percentual === null && b.percentual === null) return a.nome.localeCompare(b.nome, "pt-BR");
    if (a.percentual === null) return 1;
    if (b.percentual === null) return -1;
    return a.percentual - b.percentual || a.nome.localeCompare(b.nome, "pt-BR");
  });

  return { limite, items };
}

type StatusAula = "AGUARDANDO" | "ABERTA" | "ENCERRADA";

// Status da ocorrência (pelo horário efetivo) em "agora".
function statusDaOcorrencia(ocorrencia: Pick<Ocorrencia, "horarioInicio" | "horarioFim">, hora: string): StatusAula {
  if (hora < ocorrencia.horarioInicio) return "AGUARDANDO";
  if (hora > ocorrencia.horarioFim) return "ENCERRADA";
  return "ABERTA";
}

const chaveOcorrencia = (aulaId: string, dataOriginal: string) => `${aulaId}|${dataOriginal}`;

export class PresencaService {
  constructor(
    private readonly presencaRepository: PresencaRepository,
    private readonly gradeHorariaRepository: GradeHorariaRepository
  ) {}

  // Ocorrências (aulas da grade e eventos com presença) cuja janela já passou sem nenhum registro: todos os matriculados ficam presentes. Idempotente.
  async consolidarPresencasPendentes(turmaIds?: string[]) {
    await this.consolidarAulas(turmaIds);
    await this.consolidarEventos(turmaIds);
  }

  private async consolidarEventos(turmaIds?: string[]) {
    const now = agora();
    const hoje = todayInSaoPaulo(now);
    const hora = timeOfDayInSaoPaulo(now);
    // Só eventos sem nenhum registro dos últimos 60 dias (o que ficou para trás disso não é mais consolidado).
    const de = new Date(parseDateOnly(hoje).getTime() - 60 * 24 * 60 * 60 * 1000);
    const eventos = await this.presencaRepository.listEventosForConsolidation(de, parseDateOnly(hoje), turmaIds);
    if (eventos.length === 0) return;

    const rows: Parameters<PresencaRepository["createManyPresencas"]>[0] = [];
    for (const evento of eventos) {
      const data = isoDate(evento.data);
      const fim = formatTimeHHMM(evento.horarioFim);
      if (data === hoje && hora <= fim) continue;
      // Evento criado depois do fim da janela: ninguém chegou a poder registrar, então não consolida.
      const criada = todayInSaoPaulo(evento.createdAt);
      if (criada > data || (criada === data && timeOfDayInSaoPaulo(evento.createdAt) >= fim)) continue;
      // Só alunos com matrícula vigente na data.
      for (const [alunoId, turmaId] of turmaPorAluno(evento.turmas, data)) {
        rows.push({ alunoId, reuniaoId: evento.id, turmaId, data: evento.data, presente: true, automatica: true });
      }
    }
    if (rows.length > 0) await this.presencaRepository.createManyPresencas(rows);
  }

  private async consolidarAulas(turmaIds?: string[]) {
    const now = agora();
    const hoje = todayInSaoPaulo(now);
    const hora = timeOfDayInSaoPaulo(now);
    const aulas = (await this.presencaRepository.listAulasForConsolidation(turmaIds)).filter((aula) => aula.turma.matriculas.length > 0);
    if (aulas.length === 0) return;

    // Cada aula só gera ocorrências a partir da criação (ou do início da grade, se posterior).
    const inicioDaAula = new Map(
      aulas.map((aula) => {
        const criada = todayInSaoPaulo(aula.createdAt);
        const gradeInicio = aula.turma.gradeInicio ? isoDate(aula.turma.gradeInicio) : null;
        return [aula.id, gradeInicio && gradeInicio > criada ? gradeInicio : criada] as const;
      })
    );
    const de = Array.from(inicioDaAula.values()).reduce((min, d) => (d < min ? d : min));
    const excecoes = await this.gradeHorariaRepository.carregarExcecoesDasAulas(aulas.map((a) => a.id), de, hoje);
    const porAula = new Map(aulas.map((aula) => [aula.id, aula]));

    const candidatas: { aulaId: string; data: string; alunoIds: string[] }[] = [];
    for (const oc of gerarOcorrencias(aulas, excecoes, de, hoje)) {
      const aula = porAula.get(oc.aulaId)!;
      if (oc.dataOriginal < inicioDaAula.get(aula.id)!) continue;
      if (oc.data === hoje && hora <= oc.horarioFim) continue;
      // Aula criada no próprio dia depois do fim da janela: esse dia não consolida.
      if (oc.dataOriginal === todayInSaoPaulo(aula.createdAt) && timeOfDayInSaoPaulo(aula.createdAt) >= oc.horarioFim) continue;
      // Só alunos com matrícula vigente na data em que a aula acontece (removidos ficam de fora a partir da remoção).
      const alunoIds = aula.turma.matriculas.filter((m) => matriculaVigente(m, oc.data)).map((m) => m.alunoId);
      // O registro de presença usa a data original da ocorrência como chave.
      if (alunoIds.length > 0) candidatas.push({ aulaId: aula.id, data: oc.dataOriginal, alunoIds });
    }
    if (candidatas.length === 0) return;

    const minData = candidatas.reduce((min, c) => (c.data < min ? c.data : min), candidatas[0].data);
    const existentes = await this.presencaRepository.listExistingPairs(
      Array.from(new Set(candidatas.map((c) => c.aulaId))),
      parseDateOnly(minData)
    );
    const chaves = new Set(existentes.map((p) => `${p.aulaId}|${isoDate(p.data)}`));

    const rows = candidatas
      .filter((c) => !chaves.has(`${c.aulaId}|${c.data}`))
      .flatMap((c) =>
        c.alunoIds.map((alunoId) => ({ alunoId, aulaId: c.aulaId, data: parseDateOnly(c.data), presente: true, automatica: true }))
      );
    if (rows.length > 0) await this.presencaRepository.createManyPresencas(rows);
  }

  async list() {
    await this.consolidarPresencasPendentes();
    return this.presencaRepository.list();
  }

  async listByTurma(turmaId: string) {
    await this.consolidarPresencasPendentes([turmaId]);
    return this.presencaRepository.listByTurma(turmaId);
  }

  async markBulk(actor: Actor, input: MarkAttendanceInput) {
    if (input.eventoId) return this.markEvento(actor, input, input.eventoId);

    const now = agora();
    const hoje = todayInSaoPaulo(now);

    const aula = await this.presencaRepository.findAulaForMark(input.aulaId!);
    if (!aula) throw new HttpError(404, "Aula não encontrada");

    // A ocorrência que acontece hoje (pode ter sido movida/alterada); a presença é gravada na data original dela.
    const { excecoes } = await this.gradeHorariaRepository.carregarFontesDoDia(hoje);
    const doAula = excecoes.filter((e) => e.aulaId === aula.id);
    const ocorrencia = gerarOcorrencias([aula], doAula, hoje, hoje)[0];
    const dataOriginal = ocorrencia?.dataOriginal ?? hoje;

    const responsavel =
      (ocorrencia?.professorId ?? aula.professorId) === actor.id ||
      (await this.presencaRepository.hasAcceptedSubstitution(aula.id, actor.id, parseDateOnly(dataOriginal)));
    if (!responsavel) throw new HttpError(403, "Somente o professor responsável pela aula pode registrar a presença");

    if (input.data && input.data !== hoje) throw new HttpError(400, "A presença só pode ser registrada para a data de hoje");

    if (!ocorrencia) {
      if (doAula.some((e) => e.cancelada && isoDate(e.dataOriginal) === hoje)) throw new HttpError(409, "Aula cancelada nesta data");
      if (diaSemanaOfDateOnly(hoje) === aula.diaSemana && !dataNoPeriodo(aula.turma, hoje)) throw new HttpError(409, "Fora do período da grade");
      throw new HttpError(409, "A aula não é hoje");
    }
    if (statusDaOcorrencia(ocorrencia, timeOfDayInSaoPaulo(now)) !== "ABERTA") throw new HttpError(409, "Fora do horário da aula");

    const matriculados = new Set(aula.turma.matriculas.map((m) => m.alunoId));
    const enviadas = await this.semRemovidos(input.entries);
    if (enviadas.some((e) => !matriculados.has(e.alunoId))) {
      throw new HttpError(400, "Há aluno que não está matriculado na turma da aula");
    }

    // Matriculados que o professor não enviou ficam presentes (registro do professor, não automático).
    const enviados = new Set(enviadas.map((e) => e.alunoId));
    const entries = [
      ...enviadas,
      ...Array.from(matriculados).filter((id) => !enviados.has(id)).map((alunoId) => ({ alunoId, presente: true }))
    ];
    return this.presencaRepository.markBulk(aula.id, parseDateOnly(dataOriginal), entries);
  }

  // Aula comum com presença: mesmas regras da aula da grade (janela de hoje, só o professor, só matriculados).
  private async markEvento(actor: Actor, input: MarkAttendanceInput, eventoId: string) {
    const now = agora();
    const hoje = todayInSaoPaulo(now);

    const evento = await this.presencaRepository.findEventoForMark(eventoId);
    if (!evento) throw new HttpError(404, "Aula não encontrada");
    if (!evento.exigePresenca) throw new HttpError(409, "Este evento não exige presença");
    if (!evento.participacoes.some((p) => p.userId === actor.id)) {
      throw new HttpError(403, "Somente o professor responsável pela aula pode registrar a presença");
    }
    if (input.data && input.data !== hoje) throw new HttpError(400, "A presença só pode ser registrada para a data de hoje");

    if (isoDate(evento.data) !== hoje) throw new HttpError(409, "A aula não é hoje");
    const ocorrencia = { horarioInicio: formatTimeHHMM(evento.horarioInicio), horarioFim: formatTimeHHMM(evento.horarioFim) };
    if (statusDaOcorrencia(ocorrencia, timeOfDayInSaoPaulo(now)) !== "ABERTA") throw new HttpError(409, "Fora do horário da aula");

    const turmaDoAluno = turmaPorAluno(evento.turmas, hoje);
    const enviadas = await this.semRemovidos(input.entries);
    if (enviadas.some((e) => !turmaDoAluno.has(e.alunoId))) {
      throw new HttpError(400, "Há aluno que não está matriculado nas turmas da aula");
    }

    // Matriculados que o professor não enviou ficam presentes (registro do professor, não automático).
    const enviados = new Set(enviadas.map((e) => e.alunoId));
    const entries = [
      ...enviadas,
      ...Array.from(turmaDoAluno.keys()).filter((id) => !enviados.has(id)).map((alunoId) => ({ alunoId, presente: true }))
    ].map((e) => ({ ...e, turmaId: turmaDoAluno.get(e.alunoId)! }));
    return this.presencaRepository.markEventoBulk(evento.id, evento.data, entries);
  }

  // Aluno removido com a lista já aberta no professor: a entrada dele é ignorada, sem perder o resto do registro.
  private async semRemovidos<T extends { alunoId: string }>(entries: T[]) {
    const removidos = await this.presencaRepository.listAlunoIdsRemovidos(entries.map((e) => e.alunoId));
    return entries.filter((e) => !removidos.has(e.alunoId));
  }

  // Aulas comuns com presença do dia, no mesmo formato das aulas da grade (kind "EVENTO", id do evento em eventoId).
  private async eventosDeHoje(actor: Actor, hoje: string, hora: string) {
    const eventos = await this.presencaRepository.listEventosDoDia(parseDateOnly(hoje));
    return eventos.flatMap((evento) => {
      const professor = evento.participacoes[0]?.user;
      if (!professor) return [];
      const horarioInicio = formatTimeHHMM(evento.horarioInicio);
      const horarioFim = formatTimeHHMM(evento.horarioFim);
      const status = statusDaOcorrencia({ horarioInicio, horarioFim }, hora);
      const manual = evento.presencas.some((p) => !p.automatica);
      const responsavel = professor.id === actor.id;
      return [
        {
          kind: "EVENTO" as const,
          eventoId: evento.id,
          titulo: evento.titulo,
          aula: {
            id: evento.id,
            horarioInicio,
            horarioFim,
            disciplina: evento.disciplina,
            turmas: evento.turmas,
            professor
          },
          data: hoje,
          dataOriginal: hoje,
          alterada: false,
          status,
          registrada: manual,
          automatica: status === "ENCERRADA" && evento.presencas.length > 0 && !manual,
          responsavel,
          podeRegistrar: responsavel && status === "ABERTA",
          presentes: evento.presencas.filter((p) => p.presente).length,
          total: evento.presencas.length
        }
      ];
    });
  }

  async today(actor: Actor) {
    await this.consolidarPresencasPendentes();
    const now = agora();
    const hoje = todayInSaoPaulo(now);
    const hora = timeOfDayInSaoPaulo(now);

    const { aulas, excecoes } = await this.gradeHorariaRepository.carregarFontesDoDia(hoje);
    const ocorrencias = gerarOcorrencias(aulas, excecoes, hoje, hoje);
    const eventos = await this.eventosDeHoje(actor, hoje, hora);
    if (ocorrencias.length === 0) return eventos;

    const pares = ocorrencias.map((oc) => ({ aulaId: oc.aulaId, dataOriginal: parseDateOnly(oc.dataOriginal) }));
    const [presencas, substituidas] = await Promise.all([
      this.presencaRepository.listPresencasDasOcorrencias(pares),
      this.presencaRepository.listAcceptedSubstitutionKeys(actor.id, pares)
    ]);
    const aulaPorId = new Map(aulas.map((aula) => [aula.id, aula]));
    const professores = new Map([
      ...aulas.map((aula) => [aula.professor.id, aula.professor] as const),
      ...excecoes.flatMap((e) => (e.professor ? [[e.professor.id, e.professor] as const] : []))
    ]);

    const daGrade = ocorrencias.map((oc) => {
      const aula = aulaPorId.get(oc.aulaId)!;
      const status = statusDaOcorrencia(oc, hora);
      const rows = presencas.filter((p) => p.aulaId === oc.aulaId && isoDate(p.data) === oc.dataOriginal);
      const manual = rows.some((p) => !p.automatica);
      const responsavel = oc.professorId === actor.id || substituidas.has(chaveOcorrencia(oc.aulaId, oc.dataOriginal));
      return {
        kind: "AULA" as const,
        aula: {
          id: aula.id,
          horarioInicio: oc.horarioInicio,
          horarioFim: oc.horarioFim,
          disciplina: aula.disciplina,
          turma: { id: aula.turma.id, nome: aula.turma.nome },
          turmas: [{ id: aula.turma.id, nome: aula.turma.nome }],
          professor: professores.get(oc.professorId) ?? aula.professor
        },
        data: oc.data,
        dataOriginal: oc.dataOriginal,
        alterada: oc.alterada,
        status,
        registrada: manual,
        automatica: status === "ENCERRADA" && rows.length > 0 && !manual,
        responsavel,
        podeRegistrar: responsavel && status === "ABERTA",
        presentes: rows.filter((p) => p.presente).length,
        total: rows.length
      };
    });
    return [...daGrade, ...eventos].sort((a, b) => a.aula.horarioInicio.localeCompare(b.aula.horarioInicio));
  }

  async summary(query: AttendanceSummaryQuery) {
    await this.consolidarPresencasPendentes(query.turmaId ? [query.turmaId] : undefined);
    const turmaIds = query.turmaId ? [query.turmaId] : undefined;
    const [matriculas, presencas] = await Promise.all([
      this.presencaRepository.listMatriculasForSummary(turmaIds),
      this.presencaRepository.listPresencasForSummary(turmaIds)
    ]);
    return buildAttendanceSummary(matriculas, presencas, query.limite);
  }

  // Frequência média (%) por turma: presenças / total de registros. Turma sem registros fica fora do mapa.
  async frequenciaPorTurma() {
    await this.consolidarPresencasPendentes();
    const counts = new Map<string, { total: number; presentes: number }>();
    for (const p of await this.presencaRepository.listPresencasComTurma()) {
      const turmaId = p.aula?.turmaId ?? p.turmaId;
      if (!turmaId) continue;
      const c = counts.get(turmaId) ?? { total: 0, presentes: 0 };
      c.total += 1;
      if (p.presente) c.presentes += 1;
      counts.set(turmaId, c);
    }
    return new Map(Array.from(counts, ([id, c]) => [id, Math.round((c.presentes / c.total) * 1000) / 10] as const));
  }

  // Frequência (%) de cada aluno ativo, igual à do report: presenças / registros dele. Sem registros fica fora do mapa.
  async frequenciaPorAluno() {
    await this.consolidarPresencasPendentes();
    const counts = new Map<string, { total: number; presentes: number }>();
    for (const p of await this.presencaRepository.listPresencasDosAlunosAtivos()) {
      const c = counts.get(p.alunoId) ?? { total: 0, presentes: 0 };
      c.total += 1;
      if (p.presente) c.presentes += 1;
      counts.set(p.alunoId, c);
    }
    return new Map(Array.from(counts, ([id, c]) => [id, Math.round((c.presentes / c.total) * 100)] as const));
  }

  async report(alunoId: string) {
    await this.consolidarPresencasPendentes(await this.presencaRepository.listTurmaIdsOfAluno(alunoId));
    const presencas = await this.presencaRepository.listByAluno(alunoId);
    const totalClasses = presencas.length;
    const present = presencas.filter((p) => p.presente).length;
    const absent = totalClasses - present;
    const percentage = totalClasses === 0 ? 0 : Math.round((present / totalClasses) * 100);

    return { totalClasses, present, absent, percentage, history: presencas };
  }
}
