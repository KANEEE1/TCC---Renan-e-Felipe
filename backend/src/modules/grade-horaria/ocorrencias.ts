import { diaSemanaOfDateOnly, formatTimeHHMM, parseDateOnly } from "../../shared/time.js";

// Núcleo puro das ocorrências de aulas. Uma Aula é semanal (série); uma AulaExcecao altera ou cancela uma única
// ocorrência, identificada pela data original (o dia da série). Datas são "YYYY-MM-DD" e horários "HH:MM".

export interface AulaOcorrivel {
  id: string;
  turmaId: string;
  disciplinaId: string;
  professorId: string;
  diaSemana: string;
  horarioInicio: Date;
  horarioFim: Date;
  createdAt?: Date;
  turma: { gradeInicio: Date | null; gradeFim: Date | null };
}

export interface ExcecaoOcorrencia {
  aulaId: string;
  dataOriginal: Date;
  cancelada: boolean;
  data: Date | null;
  horarioInicio: Date | null;
  horarioFim: Date | null;
  professorId: string | null;
}

export interface Ocorrencia {
  aulaId: string;
  dataOriginal: string;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  professorId: string;
  turmaId: string;
  disciplinaId: string;
  alterada: boolean;
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
  const d = parseDateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

// Datas (YYYY-MM-DD) com o dia da semana dado em [from, to], inclusive.
export function datesWithWeekday(diaSemana: string, from: string, to: string) {
  const out: string[] = [];
  let d = from;
  while (d <= to && diaSemanaOfDateOnly(d) !== diaSemana) d = addDays(d, 1);
  for (; d <= to; d = addDays(d, 7)) out.push(d);
  return out;
}

// A aula só acontece dentro do período da grade da turma; turma sem período não restringe.
export function dataNoPeriodo(turma: { gradeInicio: Date | null; gradeFim: Date | null }, data: string) {
  return (!turma.gradeInicio || data >= isoDate(turma.gradeInicio)) && (!turma.gradeFim || data <= isoDate(turma.gradeFim));
}

// A data é um dia da série (dia da semana da aula, dentro do período da grade)?
export function dataDaSerie(aula: Pick<AulaOcorrivel, "diaSemana" | "turma">, data: string) {
  return diaSemanaOfDateOnly(data) === aula.diaSemana && dataNoPeriodo(aula.turma, data);
}

// Ocorrência efetiva de uma data da série, aplicando a exceção (se houver). Cancelada => null.
export function resolverOcorrencia(aula: AulaOcorrivel, excecao: ExcecaoOcorrencia | undefined, dataOriginal: string): Ocorrencia | null {
  if (excecao?.cancelada) return null;
  return {
    aulaId: aula.id,
    dataOriginal,
    data: excecao?.data ? isoDate(excecao.data) : dataOriginal,
    horarioInicio: formatTimeHHMM(excecao?.horarioInicio ?? aula.horarioInicio),
    horarioFim: formatTimeHHMM(excecao?.horarioFim ?? aula.horarioFim),
    professorId: excecao?.professorId ?? aula.professorId,
    turmaId: aula.turmaId,
    disciplinaId: aula.disciplinaId,
    alterada: excecao !== undefined
  };
}

// Ocorrências efetivas com data efetiva em [de, ate] (inclusive). Pula canceladas; a ocorrência movida aparece na
// data efetiva; o período da grade é verificado na data original. Ordenadas por data e horário de início.
export function gerarOcorrencias(aulas: AulaOcorrivel[], excecoes: ExcecaoOcorrencia[], de: string, ate: string): Ocorrencia[] {
  const excecoesDaAula = new Map<string, Map<string, ExcecaoOcorrencia>>();
  for (const excecao of excecoes) {
    const porData = excecoesDaAula.get(excecao.aulaId) ?? new Map<string, ExcecaoOcorrencia>();
    porData.set(isoDate(excecao.dataOriginal), excecao);
    excecoesDaAula.set(excecao.aulaId, porData);
  }

  const out: Ocorrencia[] = [];
  for (const aula of aulas) {
    const porData = excecoesDaAula.get(aula.id) ?? new Map<string, ExcecaoOcorrencia>();
    // Dias da série dentro da janela + dias com exceção (a ocorrência movida pode ter origem fora da janela).
    const datas = new Set([...datesWithWeekday(aula.diaSemana, de, ate), ...porData.keys()]);
    for (const dataOriginal of datas) {
      if (!dataNoPeriodo(aula.turma, dataOriginal)) continue;
      const ocorrencia = resolverOcorrencia(aula, porData.get(dataOriginal), dataOriginal);
      if (ocorrencia && ocorrencia.data >= de && ocorrencia.data <= ate) out.push(ocorrencia);
    }
  }

  return out.sort((a, b) => a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio));
}

// Valores efetivos (data, horário, professor) de uma ocorrência a partir da aula-base e da exceção, quando só se
// precisa dos valores e não de uma aula completa (ex.: uma falta registrada). `cancelada` indica ocorrência cancelada.
export function valoresEfetivos(
  base: { professorId: string; horarioInicio: Date; horarioFim: Date },
  excecoes: Pick<ExcecaoOcorrencia, "dataOriginal" | "cancelada" | "data" | "horarioInicio" | "horarioFim" | "professorId">[],
  dataOriginal: Date
) {
  const excecao = excecoes.find((e) => e.dataOriginal.getTime() === dataOriginal.getTime());
  return {
    cancelada: excecao?.cancelada ?? false,
    professorId: excecao?.professorId ?? base.professorId,
    horarioInicio: excecao?.horarioInicio ?? base.horarioInicio,
    horarioFim: excecao?.horarioFim ?? base.horarioFim,
    data: excecao?.data ?? dataOriginal
  };
}
