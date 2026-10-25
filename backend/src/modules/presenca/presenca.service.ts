import type { AttendanceSummaryQuery, CreatePresencaInput, MarkAttendanceInput } from "./presenca.schemas.js";
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

export class PresencaService {
  constructor(private readonly presencaRepository: PresencaRepository) {}

  list() {
    return this.presencaRepository.list();
  }

  listByTurma(turmaId: string) {
    return this.presencaRepository.listByTurma(turmaId);
  }

  create(input: CreatePresencaInput) {
    return this.presencaRepository.create(input);
  }

  markBulk(input: MarkAttendanceInput) {
    return this.presencaRepository.markBulk(input);
  }

  async summary(query: AttendanceSummaryQuery) {
    const turmaIds = query.turmaId ? [query.turmaId] : undefined;
    const [matriculas, presencas] = await Promise.all([
      this.presencaRepository.listMatriculasForSummary(turmaIds),
      this.presencaRepository.listPresencasForSummary(turmaIds)
    ]);
    return buildAttendanceSummary(matriculas, presencas, query.limite);
  }

  async report(alunoId: string) {
    const presencas = await this.presencaRepository.listByAluno(alunoId);
    const totalClasses = presencas.length;
    const present = presencas.filter((p) => p.presente).length;
    const absent = totalClasses - present;
    const percentage = totalClasses === 0 ? 0 : Math.round((present / totalClasses) * 100);

    return { totalClasses, present, absent, percentage, history: presencas };
  }
}
