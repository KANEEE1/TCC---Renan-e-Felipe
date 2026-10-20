import { describe, expect, it } from "vitest";
import { allocate, overlaps } from "../src/modules/grade-horaria/grade-horaria.allocator.js";

const janela = (professorId: string, diaSemana: string, horarioInicio: string, horarioFim: string) => ({
  professorId,
  diaSemana,
  horarioInicio,
  horarioFim
});

describe("overlaps", () => {
  it("does not conflict when intervals are adjacent", () => {
    expect(overlaps("08:00", "10:00", "10:00", "12:00")).toBe(false);
    expect(overlaps("10:00", "12:00", "08:00", "10:00")).toBe(false);
  });

  it("conflicts on partial overlap", () => {
    expect(overlaps("08:00", "10:00", "09:00", "11:00")).toBe(true);
    expect(overlaps("09:00", "11:00", "08:00", "10:00")).toBe(true);
  });
});

describe("allocate", () => {
  const pedido = { professorId: "p1", turmaId: "t1", quantidade: 1 };

  it("yields 1 lesson from a 3h window", () => {
    const { propostas } = allocate([pedido], [janela("p1", "SEGUNDA", "08:00", "11:00")], []);
    expect(propostas).toHaveLength(1);
    expect(propostas[0]).toMatchObject({ diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00" });
  });

  it("yields 2 lessons from a 4h window", () => {
    const { propostas, naoAlocados } = allocate(
      [{ ...pedido, quantidade: 2 }],
      [janela("p1", "SEGUNDA", "08:00", "12:00")],
      []
    );
    expect(propostas.map((p) => p.horarioInicio)).toEqual(["08:00", "10:00"]);
    expect(naoAlocados).toHaveLength(0);
  });

  it("reports SEM_DISPONIBILIDADE when teacher has no availability", () => {
    const { propostas, naoAlocados } = allocate([pedido], [janela("outro", "SEGUNDA", "08:00", "12:00")], []);
    expect(propostas).toHaveLength(0);
    expect(naoAlocados).toEqual([{ pedidoIndex: 0, faltantes: 1, motivo: "SEM_DISPONIBILIDADE" }]);
  });

  it("reports JANELA_INSUFICIENTE when window is shorter than a lesson", () => {
    const { naoAlocados } = allocate([pedido], [janela("p1", "SEGUNDA", "08:00", "09:00")], []);
    expect(naoAlocados[0].motivo).toBe("JANELA_INSUFICIENTE");
  });

  it("avoids an existing lesson of the same teacher", () => {
    const { propostas } = allocate(
      [pedido],
      [janela("p1", "SEGUNDA", "08:00", "12:00")],
      [{ professorId: "p1", turmaId: "outra", diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00" }]
    );
    expect(propostas[0].horarioInicio).toBe("10:00");
  });

  it("avoids an existing lesson of the same class", () => {
    const { propostas } = allocate(
      [pedido],
      [janela("p1", "SEGUNDA", "08:00", "12:00")],
      [{ professorId: "outro", turmaId: "t1", diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00" }]
    );
    expect(propostas[0].horarioInicio).toBe("10:00");
  });

  it("reports CONFLITO when every slot is taken", () => {
    const { propostas, naoAlocados } = allocate(
      [pedido],
      [janela("p1", "SEGUNDA", "08:00", "10:00")],
      [{ professorId: "p1", turmaId: "x", diaSemana: "SEGUNDA", horarioInicio: "09:00", horarioFim: "11:00" }]
    );
    expect(propostas).toHaveLength(0);
    expect(naoAlocados[0]).toMatchObject({ faltantes: 1, motivo: "CONFLITO" });
  });

  it("does not collide two requests of the same teacher", () => {
    const { propostas } = allocate(
      [pedido, { professorId: "p1", turmaId: "t2", quantidade: 1 }],
      [janela("p1", "SEGUNDA", "08:00", "12:00")],
      []
    );
    expect(propostas).toHaveLength(2);
    expect(propostas[0].horarioInicio).not.toBe(propostas[1].horarioInicio);
  });

  it("returns leftovers in naoAlocados when quantity exceeds capacity", () => {
    const { propostas, naoAlocados } = allocate(
      [{ ...pedido, quantidade: 3 }],
      [janela("p1", "SEGUNDA", "08:00", "12:00")],
      []
    );
    expect(propostas).toHaveLength(2);
    expect(naoAlocados).toEqual([{ pedidoIndex: 0, faltantes: 1, motivo: "CONFLITO" }]);
  });

  it("is deterministic", () => {
    const pedidos = [
      { professorId: "p1", turmaId: "t1", quantidade: 3 },
      { professorId: "p2", turmaId: "t1", quantidade: 2 }
    ];
    const janelas = [
      janela("p1", "QUARTA", "08:00", "12:00"),
      janela("p1", "SEGUNDA", "08:00", "12:00"),
      janela("p2", "SEGUNDA", "08:00", "14:00")
    ];
    expect(allocate(pedidos, janelas, [])).toEqual(allocate(pedidos, [...janelas].reverse(), []));
  });
});
