import { describe, expect, it } from "vitest";
import { gerarOcorrencias, type AulaOcorrivel, type ExcecaoOcorrencia } from "../src/modules/grade-horaria/ocorrencias.js";

// 2026-10-28 é quarta-feira.
const aula = (over: Partial<AulaOcorrivel> = {}): AulaOcorrivel => ({
  id: "a1",
  turmaId: "t1",
  disciplinaId: "d1",
  professorId: "p1",
  diaSemana: "QUARTA",
  horarioInicio: new Date("1970-01-01T08:00:00Z"),
  horarioFim: new Date("1970-01-01T10:00:00Z"),
  turma: { gradeInicio: null, gradeFim: null },
  ...over
});

const excecao = (over: Partial<ExcecaoOcorrencia> = {}): ExcecaoOcorrencia => ({
  aulaId: "a1",
  dataOriginal: new Date("2026-10-28"),
  cancelada: false,
  data: new Date("2026-10-28"),
  horarioInicio: new Date("1970-01-01T08:00:00Z"),
  horarioFim: new Date("1970-01-01T10:00:00Z"),
  professorId: "p1",
  ...over
});

describe("gerarOcorrencias", () => {
  it("generates the weekly series inside the window", () => {
    const res = gerarOcorrencias([aula()], [], "2026-10-26", "2026-11-09");
    expect(res.map((o) => o.data)).toEqual(["2026-10-28", "2026-11-04"]);
    expect(res[0]).toMatchObject({ aulaId: "a1", dataOriginal: "2026-10-28", horarioInicio: "08:00", horarioFim: "10:00", alterada: false });
  });

  it("moves an occurrence to its effective date, time and teacher", () => {
    const moved = excecao({
      data: new Date("2026-10-30"),
      horarioInicio: new Date("1970-01-01T14:00:00Z"),
      horarioFim: new Date("1970-01-01T15:00:00Z"),
      professorId: "p2"
    });
    const semana = gerarOcorrencias([aula()], [moved], "2026-10-26", "2026-10-31");
    expect(semana).toEqual([
      {
        aulaId: "a1",
        dataOriginal: "2026-10-28",
        data: "2026-10-30",
        horarioInicio: "14:00",
        horarioFim: "15:00",
        professorId: "p2",
        turmaId: "t1",
        disciplinaId: "d1",
        alterada: true
      }
    ]);
    // Janela que contém só a data original: a ocorrência não está mais lá.
    expect(gerarOcorrencias([aula()], [moved], "2026-10-28", "2026-10-29")).toEqual([]);
  });

  it("includes a moved occurrence whose original date is outside the window", () => {
    const moved = excecao({ data: new Date("2026-11-02") });
    expect(gerarOcorrencias([aula()], [moved], "2026-11-02", "2026-11-02").map((o) => o.dataOriginal)).toEqual(["2026-10-28"]);
  });

  it("skips cancelled occurrences", () => {
    const cancelada = excecao({ cancelada: true, data: null, horarioInicio: null, horarioFim: null, professorId: null });
    expect(gerarOcorrencias([aula()], [cancelada], "2026-10-26", "2026-11-09").map((o) => o.data)).toEqual(["2026-11-04"]);
  });

  it("keeps the snapshot when the series changes afterwards", () => {
    const snapshot = excecao({ horarioInicio: new Date("1970-01-01T08:00:00Z"), horarioFim: new Date("1970-01-01T10:00:00Z") });
    const editada = aula({
      horarioInicio: new Date("1970-01-01T13:00:00Z"),
      horarioFim: new Date("1970-01-01T14:00:00Z"),
      professorId: "p9"
    });
    const [primeira, segunda] = gerarOcorrencias([editada], [snapshot], "2026-10-26", "2026-11-09");
    expect(primeira).toMatchObject({ dataOriginal: "2026-10-28", horarioInicio: "08:00", professorId: "p1", alterada: true });
    expect(segunda).toMatchObject({ dataOriginal: "2026-11-04", horarioInicio: "13:00", professorId: "p9", alterada: false });
  });

  it("respects the grade period using the original date", () => {
    const turma = { gradeInicio: new Date("2026-10-28"), gradeFim: new Date("2026-11-04") };
    const dias = gerarOcorrencias([aula({ turma })], [], "2026-10-01", "2026-12-31").map((o) => o.data);
    expect(dias).toEqual(["2026-10-28", "2026-11-04"]);

    // Ocorrência de fora do período não aparece nem movida para dentro dele.
    const fora = excecao({ dataOriginal: new Date("2026-10-21"), data: new Date("2026-10-29") });
    expect(gerarOcorrencias([aula({ turma })], [fora], "2026-10-29", "2026-10-29")).toEqual([]);
  });
});
