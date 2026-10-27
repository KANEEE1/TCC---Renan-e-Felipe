import { describe, expect, it } from "vitest";
import { allocateTurma } from "../src/modules/grade-horaria/grade-horaria.turma-allocator.js";

const disp = (professorId: string, diaSemana: string, horarioInicio: string, horarioFim: string) => ({
  professorId,
  diaSemana,
  horarioInicio,
  horarioFim
});
const win = (diaSemana: string, horarioInicio: string, horarioFim: string) => ({ diaSemana, horarioInicio, horarioFim });
const pedido = (quantidade: number, professoresElegiveis: string[], duracaoMinutos = 60, disciplinaId = "d1") => ({
  disciplinaId,
  quantidade,
  duracaoMinutos,
  professoresElegiveis
});

const semana = [win("SEGUNDA", "08:00", "12:00"), win("TERCA", "08:00", "12:00"), win("QUARTA", "08:00", "12:00")];

describe("allocateTurma", () => {
  it("prefers a single professor covering all lessons", () => {
    const { propostas, naoAlocados } = allocateTurma(
      [pedido(3, ["a", "b"])],
      semana,
      [disp("a", "SEGUNDA", "08:00", "12:00"), disp("b", "SEGUNDA", "08:00", "12:00"), disp("b", "TERCA", "08:00", "12:00"), disp("b", "QUARTA", "08:00", "12:00")],
      []
    );
    expect(naoAlocados).toEqual([]);
    expect(new Set(propostas.map((p) => p.professorId))).toEqual(new Set(["b"]));
    expect(propostas).toHaveLength(3);
  });

  it("prefers the professor who covers every lesson even if on fewer days", () => {
    // "b" cabe as 3 aulas (duas na segunda); "a" só cabe 2, uma por dia. Contando só uma por dia os dois
    // empatariam e o desempate por id escolheria "a", forçando a divisão; o certo é ficar só com "b".
    const { propostas, naoAlocados } = allocateTurma(
      [pedido(3, ["a", "b"])],
      [win("SEGUNDA", "08:00", "10:00"), win("TERCA", "08:00", "09:00")],
      [disp("b", "SEGUNDA", "08:00", "10:00"), disp("b", "TERCA", "08:00", "09:00"), disp("a", "SEGUNDA", "08:00", "09:00"), disp("a", "TERCA", "08:00", "09:00")],
      []
    );
    expect(naoAlocados).toEqual([]);
    expect(new Set(propostas.map((p) => p.professorId))).toEqual(new Set(["b"]));
  });

  it("uses the last half hour of the day when the window ends at 23:59", () => {
    const { propostas, naoAlocados } = allocateTurma(
      [pedido(1, ["a"], 30)],
      [win("SEXTA", "23:30", "23:59")],
      [disp("a", "SEXTA", "23:30", "23:59")],
      []
    );
    expect(naoAlocados).toEqual([]);
    expect(propostas).toEqual([expect.objectContaining({ diaSemana: "SEXTA", horarioInicio: "23:30", horarioFim: "23:59" })]);
  });

  it("splits between professors when one cannot cover everything", () => {
    const { propostas, naoAlocados } = allocateTurma(
      [pedido(3, ["a", "b"])],
      [win("SEGUNDA", "08:00", "09:00"), win("TERCA", "08:00", "09:00"), win("QUARTA", "08:00", "09:00")],
      [disp("a", "SEGUNDA", "08:00", "09:00"), disp("a", "TERCA", "08:00", "09:00"), disp("b", "QUARTA", "08:00", "09:00")],
      []
    );
    expect(naoAlocados).toEqual([]);
    expect(propostas.map((p) => p.professorId)).toEqual(["a", "a", "b"]);
  });

  it("breaks ties by lower load", () => {
    const { propostas } = allocateTurma(
      [pedido(1, ["a", "b"])],
      semana,
      [disp("a", "SEGUNDA", "08:00", "12:00"), disp("b", "SEGUNDA", "08:00", "12:00")],
      [{ professorId: "a", diaSemana: "TERCA", horarioInicio: "08:00", horarioFim: "09:00" }]
    );
    expect(propostas[0].professorId).toBe("b");
  });

  it("spreads lessons across days and picks the earliest slot", () => {
    const { propostas } = allocateTurma(
      [pedido(2, ["a"])],
      semana,
      [disp("a", "SEGUNDA", "08:00", "12:00"), disp("a", "TERCA", "08:00", "12:00")],
      []
    );
    expect(propostas.map((p) => [p.diaSemana, p.horarioInicio])).toEqual([["SEGUNDA", "08:00"], ["TERCA", "08:00"]]);
  });

  it("uses the same day when needed (second pass)", () => {
    const { propostas } = allocateTurma([pedido(2, ["a"])], semana, [disp("a", "SEGUNDA", "08:00", "12:00")], []);
    expect(propostas.map((p) => p.horarioInicio)).toEqual(["08:00", "09:00"]);
  });

  it("respects class window, availability and professor occupations", () => {
    const { propostas } = allocateTurma(
      [pedido(1, ["a"])],
      [win("SEGUNDA", "09:00", "11:00")],
      [disp("a", "SEGUNDA", "07:00", "12:00")],
      [{ professorId: "a", diaSemana: "SEGUNDA", horarioInicio: "09:00", horarioFim: "10:00" }]
    );
    expect(propostas).toEqual([
      { disciplinaId: "d1", professorId: "a", diaSemana: "SEGUNDA", horarioInicio: "10:00", horarioFim: "11:00" }
    ]);
  });

  it("does not overlap lessons of the same class nor of the same professor", () => {
    const { propostas, naoAlocados } = allocateTurma(
      [pedido(1, ["a"], 60, "d1"), pedido(1, ["b"], 60, "d2")],
      [win("SEGUNDA", "08:00", "09:00")],
      [disp("a", "SEGUNDA", "08:00", "09:00"), disp("b", "SEGUNDA", "08:00", "09:00")],
      []
    );
    expect(propostas).toHaveLength(1);
    expect(naoAlocados[0].motivo).toBe("CONFLITO");
  });

  it("reports SEM_PROFESSOR, SEM_DISPONIBILIDADE and CONFLITO", () => {
    const { naoAlocados } = allocateTurma(
      [pedido(1, [], 60, "d1"), pedido(1, ["a"], 60, "d2"), pedido(1, ["b"], 60, "d3")],
      [win("SEGUNDA", "08:00", "10:00")],
      [disp("a", "TERCA", "08:00", "10:00"), disp("b", "SEGUNDA", "08:00", "10:00")],
      [{ professorId: "b", diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00" }]
    );
    const porDisciplina = Object.fromEntries(naoAlocados.map((n) => [n.disciplinaId, n.motivo]));
    expect(porDisciplina).toEqual({ d1: "SEM_PROFESSOR", d2: "SEM_DISPONIBILIDADE", d3: "CONFLITO" });
  });

  it("reports partial shortfall", () => {
    const { propostas, naoAlocados } = allocateTurma(
      [pedido(3, ["a"])],
      [win("SEGUNDA", "08:00", "09:00")],
      [disp("a", "SEGUNDA", "08:00", "09:00")],
      []
    );
    expect(propostas).toHaveLength(1);
    expect(naoAlocados).toEqual([{ disciplinaId: "d1", faltantes: 2, motivo: "CONFLITO" }]);
  });
});
