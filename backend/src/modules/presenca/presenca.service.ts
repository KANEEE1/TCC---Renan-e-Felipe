import type { Actor } from "../../shared/auth.js";
import { agora } from "../../shared/clock.js";
import { HttpError } from "../../shared/http.js";
import { diaSemanaOfDateOnly, formatTimeHHMM, parseDateOnly, timeOfDayInSaoPaulo, todayInSaoPaulo } from "../../shared/time.js";
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

  // Ocorrências cuja janela já passou sem nenhum registro: todos os matriculados ficam presentes. Idempotente.
  async consolidarPresencasPendentes(turmaIds?: string[]) {
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
      // Só alunos com matrícula vigente na data em que a aula acontece.
      const alunoIds = aula.turma.matriculas
        .filter((m) => todayInSaoPaulo(m.dataMatricula ?? m.createdAt) <= oc.data)
        .map((m) => m.alunoId);
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
    const now = agora();
    const hoje = todayInSaoPaulo(now);

    const aula = await this.presencaRepository.findAulaForMark(input.aulaId);
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
    if (input.entries.some((e) => !matriculados.has(e.alunoId))) {
      throw new HttpError(400, "Há aluno que não está matriculado na turma da aula");
    }

    // Matriculados que o professor não enviou ficam presentes (registro do professor, não automático).
    const enviados = new Set(input.entries.map((e) => e.alunoId));
    const entries = [
      ...input.entries,
      ...Array.from(matriculados).filter((id) => !enviados.has(id)).map((alunoId) => ({ alunoId, presente: true }))
    ];
    return this.presencaRepository.markBulk(aula.id, parseDateOnly(dataOriginal), entries);
  }

  async today(actor: Actor) {
    await this.consolidarPresencasPendentes();
    const now = agora();
    const hoje = todayInSaoPaulo(now);
    const hora = timeOfDayInSaoPaulo(now);

    const { aulas, excecoes } = await this.gradeHorariaRepository.carregarFontesDoDia(hoje);
    const ocorrencias = gerarOcorrencias(aulas, excecoes, hoje, hoje);
    if (ocorrencias.length === 0) return [];

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

    return ocorrencias.map((oc) => {
      const aula = aulaPorId.get(oc.aulaId)!;
      const status = statusDaOcorrencia(oc, hora);
      const rows = presencas.filter((p) => p.aulaId === oc.aulaId && isoDate(p.data) === oc.dataOriginal);
      const manual = rows.some((p) => !p.automatica);
      const responsavel = oc.professorId === actor.id || substituidas.has(chaveOcorrencia(oc.aulaId, oc.dataOriginal));
      return {
        aula: {
          id: aula.id,
          horarioInicio: oc.horarioInicio,
          horarioFim: oc.horarioFim,
          disciplina: aula.disciplina,
          turma: { id: aula.turma.id, nome: aula.turma.nome },
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
