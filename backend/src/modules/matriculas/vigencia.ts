import { todayInSaoPaulo } from "../../shared/time.js";

// Regras de vigência de matrícula usadas por presença de evento e simulados. Datas são "YYYY-MM-DD" (SP).

export interface MatriculaComData {
  alunoId: string;
  dataMatricula: Date | null;
  createdAt: Date;
}

// Matrícula vigente na data: a data de matrícula (ou de criação) não é posterior a ela.
export const matriculaVigente = (m: Pick<MatriculaComData, "dataMatricula" | "createdAt">, data: string) =>
  todayInSaoPaulo(m.dataMatricula ?? m.createdAt) <= data;

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
