import { todayInSaoPaulo } from "../../shared/time.js";

// Regras de vigência de matrícula usadas por presença, turmas e simulados. Datas são "YYYY-MM-DD" (SP).

// Filtro (Prisma) das listas atuais: aluno não removido (exclusão lógica). Como a remoção usa "agora",
// para o dia de hoje equivale a `matriculaVigente`.
export const alunoAtivo = { removidoEm: null } as const;

export interface MatriculaComData {
  alunoId: string;
  dataMatricula: Date | null;
  createdAt: Date;
  aluno: { removidoEm: Date | null };
}

// Matrícula vigente na data: a data de matrícula (ou de criação) não é posterior a ela e o aluno não foi removido
// até ela (a remoção vale a partir do dia em que foi feita, em SP).
export const matriculaVigente = (m: Pick<MatriculaComData, "dataMatricula" | "createdAt" | "aluno">, data: string) =>
  todayInSaoPaulo(m.dataMatricula ?? m.createdAt) <= data && (!m.aluno.removidoEm || data < todayInSaoPaulo(m.aluno.removidoEm));

// Select das matrículas com o que `matriculaVigente` precisa.
export const matriculaVigenciaSelect = {
  alunoId: true,
  dataMatricula: true,
  createdAt: true,
  aluno: { select: { removidoEm: true } }
} as const;

// Aluno matriculado em mais de uma turma do evento: conta uma vez, atribuído à primeira turma por nome (critério determinístico).
// As turmas devem vir ordenadas por nome. Devolve alunoId -> turmaId.
export function turmaPorAluno(turmas: { id: string; matriculas: MatriculaComData[] }[], data: string) {
  const turmaDoAluno = new Map<string, string>();
  for (const turma of turmas) {
    for (const m of turma.matriculas) {
      if (matriculaVigente(m, data) && !turmaDoAluno.has(m.alunoId)) turmaDoAluno.set(m.alunoId, turma.id);
    }
  }
  return turmaDoAluno;
}
