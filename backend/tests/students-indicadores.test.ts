import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { app, asGestao, createUser, resetDb } from "./helpers.js";

// Relógio antes de qualquer ocorrência, para a consolidação automática não criar presenças.
const AGORA = "2026-10-01T12:00:00Z";

type Ind = { alunoId: string; frequenciaPercentual: number | null; mediaSimuladosPercentual: number | null };
const indicadores = async () => (await request(app).get("/students/indicadores").set(asGestao())).body as Ind[];

async function setup() {
  const prof = await createUser({ email: "prof@sind.com", roles: ["PROFESSOR"], name: "Prof" });
  const disciplina = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
  const turma = await prisma.turma.create({ data: { nome: "Turma A", anoLetivo: 2026 } });
  const aluno = async (nome: string) => {
    const a = await prisma.aluno.create({ data: { nome } });
    await prisma.matricula.create({ data: { alunoId: a.id, turmaId: turma.id, dataMatricula: new Date("2026-09-01T12:00:00Z") } });
    return a;
  };
  return { prof, disciplina, turma, a1: await aluno("Ana"), a2: await aluno("Bia"), a3: await aluno("Caio") };
}

const simulado = (ctx: Awaited<ReturnType<typeof setup>>, titulo: string, maxima: number, data: string) =>
  prisma.reuniao.create({
    data: {
      titulo, tipo: "SIMULADO", data: new Date(data), horarioInicio: new Date("1970-01-01T08:00:00Z"),
      horarioFim: new Date("1970-01-01T12:00:00Z"), pontuacaoMaxima: maxima, prazoCorrecao: new Date("2026-09-30"),
      correcaoEnviadaEm: new Date("2026-09-25T12:00:00Z"), participacoes: { create: [{ userId: ctx.prof.id }] },
      turmas: { connect: [{ id: ctx.turma.id }] }
    }
  });

describe("students indicators", () => {
  beforeEach(async () => {
    await resetDb();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(AGORA));
  });
  afterEach(() => vi.useRealTimers());

  it("requires a token", async () => {
    expect((await request(app).get("/students/indicadores")).status).toBe(401);
  });

  it("returns null without attendance or simulados", async () => {
    const ctx = await setup();
    const rows = await indicadores();
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.alunoId === ctx.a1.id)).toEqual({ alunoId: ctx.a1.id, frequenciaPercentual: null, mediaSimuladosPercentual: null });
  });

  it("attendance equals the one from /attendance/report/:id", async () => {
    const ctx = await setup();
    const aula = await prisma.aula.create({
      data: {
        turmaId: ctx.turma.id, disciplinaId: ctx.disciplina.id, professorId: ctx.prof.id, diaSemana: "QUARTA",
        horarioInicio: new Date("1970-01-01T08:00:00Z"), horarioFim: new Date("1970-01-01T10:00:00Z"), createdAt: new Date(AGORA)
      }
    });
    // Ana: 2 de 3 (67%); Bia: 0 de 1 (0%); Caio sem registros.
    await prisma.presenca.createMany({
      data: [
        { alunoId: ctx.a1.id, aulaId: aula.id, data: new Date("2026-09-02"), presente: true },
        { alunoId: ctx.a1.id, aulaId: aula.id, data: new Date("2026-09-09"), presente: true },
        { alunoId: ctx.a1.id, aulaId: aula.id, data: new Date("2026-09-16"), presente: false },
        { alunoId: ctx.a2.id, aulaId: aula.id, data: new Date("2026-09-02"), presente: false }
      ]
    });
    const rows = await indicadores();
    for (const a of [ctx.a1, ctx.a2]) {
      const report = await request(app).get(`/attendance/report/${a.id}`).set(asGestao());
      expect(rows.find((r) => r.alunoId === a.id)?.frequenciaPercentual).toBe(report.body.percentage);
    }
    expect(rows.find((r) => r.alunoId === ctx.a1.id)?.frequenciaPercentual).toBe(67);
    expect(rows.find((r) => r.alunoId === ctx.a3.id)?.frequenciaPercentual).toBeNull();
  });

  it("simulados average equals the one from /simulados/aluno/:id", async () => {
    const ctx = await setup();
    const s1 = await simulado(ctx, "Simulado 1", 100, "2026-09-20");
    const s2 = await simulado(ctx, "Simulado 2", 50, "2026-09-22");
    await prisma.notaSimulado.createMany({
      data: [
        { reuniaoId: s1.id, alunoId: ctx.a1.id, turmaId: ctx.turma.id, valor: 80 },
        { reuniaoId: s2.id, alunoId: ctx.a1.id, turmaId: ctx.turma.id, valor: 20 },
        { reuniaoId: s1.id, alunoId: ctx.a2.id, turmaId: ctx.turma.id, valor: 55 },
        { reuniaoId: s2.id, alunoId: ctx.a2.id, turmaId: ctx.turma.id, valor: null, ausente: true },
        { reuniaoId: s1.id, alunoId: ctx.a3.id, turmaId: ctx.turma.id, valor: null, ausente: true }
      ]
    });
    const rows = await indicadores();
    // Ana: (80 + 40) / 2 = 60; Bia: só o s1 (ausente fora) = 55; Caio: só ausente = null.
    expect(rows.find((r) => r.alunoId === ctx.a1.id)?.mediaSimuladosPercentual).toBe(60);
    for (const a of [ctx.a1, ctx.a2, ctx.a3]) {
      const detalhe = await request(app).get(`/simulados/aluno/${a.id}`).set(asGestao());
      expect(rows.find((r) => r.alunoId === a.id)?.mediaSimuladosPercentual).toBe(detalhe.body.media);
    }
    expect(rows.find((r) => r.alunoId === ctx.a3.id)?.mediaSimuladosPercentual).toBeNull();
  });

  it("leaves removed students out", async () => {
    const ctx = await setup();
    await prisma.aluno.update({ where: { id: ctx.a2.id }, data: { removidoEm: new Date(AGORA) } });
    const rows = await indicadores();
    expect(rows.map((r) => r.alunoId).sort()).toEqual([ctx.a1.id, ctx.a3.id].sort());
  });
});
