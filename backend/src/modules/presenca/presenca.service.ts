import type { Actor } from "../../shared/auth.js";
import { agora } from "../../shared/clock.js";
import { HttpError } from "../../shared/http.js";
import { diaSemanaOfDateOnly, formatTimeHHMM, parseDateOnly, timeOfDayInSaoPaulo, todayInSaoPaulo } from "../../shared/time.js";
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

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function addDays(date: string, days: number) {
  const d = parseDateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

// Datas (YYYY-MM-DD) com o dia da semana da aula em [from, to], inclusive.
function datesWithWeekday(diaSemana: string, from: string, to: string) {
  const out: string[] = [];
  let d = from;
  while (d <= to && diaSemanaOfDateOnly(d) !== diaSemana) d = addDays(d, 1);
  for (; d <= to; d = addDays(d, 7)) out.push(d);
  return out;
}

interface AulaJanela {
  diaSemana: string;
  horarioInicio: Date;
  horarioFim: Date;
  turma: { gradeInicio: Date | null; gradeFim: Date | null };
}

type StatusAula = "AGUARDANDO" | "ABERTA" | "ENCERRADA";

// Valida dia, período da grade e horário; devolve o status da aula em "agora".
function statusDaAula(aula: AulaJanela, hoje: string, hora: string): StatusAula | "OUTRO_DIA" | "FORA_PERIODO" {
  if (aula.diaSemana !== diaSemanaOfDateOnly(hoje)) return "OUTRO_DIA";
  const { gradeInicio, gradeFim } = aula.turma;
  if ((gradeInicio && hoje < isoDate(gradeInicio)) || (gradeFim && hoje > isoDate(gradeFim))) return "FORA_PERIODO";
  if (hora < formatTimeHHMM(aula.horarioInicio)) return "AGUARDANDO";
  if (hora > formatTimeHHMM(aula.horarioFim)) return "ENCERRADA";
  return "ABERTA";
}

export class PresencaService {
  constructor(private readonly presencaRepository: PresencaRepository) {}

  // Aulas cuja janela já passou sem nenhum registro: todos os matriculados ficam presentes. Idempotente.
  async consolidarPresencasPendentes(turmaIds?: string[]) {
    const now = agora();
    const hoje = todayInSaoPaulo(now);
    const hora = timeOfDayInSaoPaulo(now);
    const aulas = await this.presencaRepository.listAulasForConsolidation(turmaIds);

    const candidatas: { aulaId: string; data: string; alunoIds: string[] }[] = [];
    for (const aula of aulas) {
      if (aula.turma.matriculas.length === 0) continue;
      const matriculas = aula.turma.matriculas.map((m) => ({ alunoId: m.alunoId, desde: todayInSaoPaulo(m.dataMatricula ?? m.createdAt) }));
      const criada = todayInSaoPaulo(aula.createdAt);
      const inicio = aula.turma.gradeInicio && isoDate(aula.turma.gradeInicio) > criada ? isoDate(aula.turma.gradeInicio) : criada;
      const gradeFim = aula.turma.gradeFim ? isoDate(aula.turma.gradeFim) : null;
      const fim = gradeFim && gradeFim < hoje ? gradeFim : hoje;
      const horarioFim = formatTimeHHMM(aula.horarioFim);
      const encerraHoje = hora > horarioFim;
      // Aula criada no próprio dia depois do fim da janela: esse dia não consolida.
      const criadaTarde = timeOfDayInSaoPaulo(aula.createdAt) >= horarioFim;
      for (const data of datesWithWeekday(aula.diaSemana, inicio, fim)) {
        if (data === hoje && !encerraHoje) continue;
        if (data === criada && criadaTarde) continue;
        // Só alunos com matrícula vigente na data.
        const alunoIds = matriculas.filter((m) => m.desde <= data).map((m) => m.alunoId);
        if (alunoIds.length > 0) candidatas.push({ aulaId: aula.id, data, alunoIds });
      }
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
    const now = agora();
    const hoje = todayInSaoPaulo(now);
    const hojeDate = parseDateOnly(hoje);

    const aula = await this.presencaRepository.findAulaForMark(input.aulaId);
    if (!aula) throw new HttpError(404, "Aula não encontrada");

    const responsavel =
      aula.professorId === actor.id || (await this.presencaRepository.hasAcceptedSubstitution(aula.id, actor.id, hojeDate));
    if (!responsavel) throw new HttpError(403, "Somente o professor responsável pela aula pode registrar a presença");

    if (input.data && input.data !== hoje) throw new HttpError(400, "A presença só pode ser registrada para a data de hoje");

    const status = statusDaAula(aula, hoje, timeOfDayInSaoPaulo(now));
    if (status === "OUTRO_DIA") throw new HttpError(409, "A aula não é hoje");
    if (status === "FORA_PERIODO") throw new HttpError(409, "Fora do período da grade");
    if (status !== "ABERTA") throw new HttpError(409, "Fora do horário da aula");

    const matriculados = new Set(aula.turma.matriculas.map((m) => m.alunoId));
    if (input.entries.some((e) => !matriculados.has(e.alunoId))) {
      throw new HttpError(400, "Há aluno que não está matriculado na turma da aula");
    }

    // Matriculados que o professor não enviou ficam presentes (registro do professor, não automático).
    const enviados = new Set(input.entries.map((e) => e.alunoId));
    const entries = [
      ...input.entries,
      ...Array.from(matriculados).filter((id) => !enviados.has(id)).map((alunoId) => ({ alunoId, presente: true }))
    ];
    return this.presencaRepository.markBulk(aula.id, hojeDate, entries);
  }

  async today(actor: Actor) {
    await this.consolidarPresencasPendentes();
    const now = agora();
    const hoje = todayInSaoPaulo(now);
    const hora = timeOfDayInSaoPaulo(now);
    const hojeDate = parseDateOnly(hoje);

    const aulas = await this.presencaRepository.listAulasDoDia(diaSemanaOfDateOnly(hoje));
    const noPeriodo = aulas.filter((a) => {
      const s = statusDaAula(a, hoje, hora);
      return s !== "OUTRO_DIA" && s !== "FORA_PERIODO";
    });
    if (noPeriodo.length === 0) return [];

    const [presencas, substituidas] = await Promise.all([
      this.presencaRepository.listPresencasDoDia(noPeriodo.map((a) => a.id), hojeDate),
      this.presencaRepository.listAcceptedSubstitutionAulaIds(actor.id, hojeDate)
    ]);

    return noPeriodo.map((aula) => {
      const status = statusDaAula(aula, hoje, hora) as StatusAula;
      const rows = presencas.filter((p) => p.aulaId === aula.id);
      const manual = rows.some((p) => !p.automatica);
      const responsavel = aula.professorId === actor.id || substituidas.has(aula.id);
      return {
        aula: {
          id: aula.id,
          horarioInicio: formatTimeHHMM(aula.horarioInicio),
          horarioFim: formatTimeHHMM(aula.horarioFim),
          disciplina: aula.disciplina,
          turma: { id: aula.turma.id, nome: aula.turma.nome },
          professor: aula.professor
        },
        status,
        registrada: manual,
        automatica: status === "ENCERRADA" && rows.length > 0 && !manual,
        responsavel,
        podeRegistrar: responsavel && status === "ABERTA",
        presentes: rows.filter((p) => p.presente).length,
        total: rows.length
      };
    });
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
