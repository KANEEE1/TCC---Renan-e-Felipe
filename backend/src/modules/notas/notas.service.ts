import { HttpError } from "../../shared/http.js";
import type { ClassSummaryQuery, CreateNotaInput } from "./notas.schemas.js";
import type { NotasRepository } from "./notas.repository.js";

export interface ClassPerformanceNota {
  valor: number;
  aluno: { id: string; nome: string };
  simulado: {
    id: string;
    nome: string;
    data: Date;
    disciplinaId: string | null;
    disciplina: { id: string; nome: string } | null;
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const byNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");

interface Acc {
  sum: number;
  count: number;
}

function add(map: Map<string, Acc>, key: string, valor: number) {
  const acc = map.get(key) ?? { sum: 0, count: 0 };
  acc.sum += valor;
  acc.count += 1;
  map.set(key, acc);
}

export function buildClassPerformance(notas: ClassPerformanceNota[], limite: number, turmaId = "") {
  const total = notas.reduce((sum, n) => sum + n.valor, 0);
  const disciplinas = new Map<string, Acc>();
  const disciplinaInfo = new Map<string, { disciplinaId: string | null; nome: string }>();
  const simulados = new Map<string, Acc>();
  const simuladoInfo = new Map<string, ClassPerformanceNota["simulado"]>();
  const alunos = new Map<string, Acc>();
  const alunoNome = new Map<string, string>();

  for (const n of notas) {
    const disciplinaKey = n.simulado.disciplina?.id ?? "";
    disciplinaInfo.set(disciplinaKey, {
      disciplinaId: n.simulado.disciplina?.id ?? null,
      nome: n.simulado.disciplina?.nome ?? "Sem disciplina"
    });
    add(disciplinas, disciplinaKey, n.valor);
    simuladoInfo.set(n.simulado.id, n.simulado);
    add(simulados, n.simulado.id, n.valor);
    alunoNome.set(n.aluno.id, n.aluno.nome);
    add(alunos, n.aluno.id, n.valor);
  }

  const disciplinaRows = Array.from(disciplinas, ([key, acc]) => ({
    ...disciplinaInfo.get(key)!,
    rawMedia: acc.sum / acc.count,
    totalNotas: acc.count
  }));
  disciplinaRows.sort((a, b) => a.rawMedia - b.rawMedia || byNome(a, b));

  const pior = disciplinaRows.find((d) => d.disciplinaId !== null);

  const porSimulado = Array.from(simulados, ([id, acc]) => {
    const s = simuladoInfo.get(id)!;
    return {
      simuladoId: id,
      nome: s.nome,
      data: s.data,
      disciplinaId: s.disciplinaId,
      media: round2(acc.sum / acc.count),
      totalNotas: acc.count
    };
  }).sort((a, b) => b.data.getTime() - a.data.getTime() || byNome(a, b));

  const alunosAbaixoDoLimite = Array.from(alunos, ([alunoId, acc]) => ({
    alunoId,
    nome: alunoNome.get(alunoId)!,
    rawMedia: acc.sum / acc.count
  }))
    .filter((a) => a.rawMedia < limite)
    .sort((a, b) => a.rawMedia - b.rawMedia || byNome(a, b))
    .map((a) => ({ alunoId: a.alunoId, nome: a.nome, media: round2(a.rawMedia) }));

  return {
    turmaId,
    limite,
    totalNotas: notas.length,
    mediaGeral: notas.length === 0 ? null : round2(total / notas.length),
    porDisciplina: disciplinaRows.map((d) => ({
      disciplinaId: d.disciplinaId,
      nome: d.nome,
      media: round2(d.rawMedia),
      totalNotas: d.totalNotas
    })),
    porSimulado,
    alunosAbaixoDoLimite,
    piorDisciplina: pior ? { disciplinaId: pior.disciplinaId, nome: pior.nome, media: round2(pior.rawMedia) } : null
  };
}

export class NotasService {
  constructor(private readonly notasRepository: NotasRepository) {}

  list() {
    return this.notasRepository.list();
  }

  create(input: CreateNotaInput) {
    return this.notasRepository.create(input);
  }

  async classSummary(turmaId: string, query: ClassSummaryQuery) {
    if (!(await this.notasRepository.findTurmaById(turmaId))) {
      throw new HttpError(404, "Class not found");
    }
    const notas = await this.notasRepository.listForClassSummary(turmaId);
    return buildClassPerformance(notas, query.limite, turmaId);
  }
}
