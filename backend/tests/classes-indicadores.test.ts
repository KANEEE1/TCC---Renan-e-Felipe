import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { app, asGestao, createUser, resetDb } from "./helpers.js";

// Relógio antes de qualquer ocorrência, para a consolidação automática não criar presenças.
const AGORA = "2026-10-01T12:00:00Z";

async function setup() {
  const prof = await createUser({ email: "prof@ind.com", roles: ["PROFESSOR"], name: "Prof" });
  const disciplina = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
  const turmaA = await prisma.turma.create({ data: { nome: "Turma A", anoLetivo: 2026 } });
  const turmaB = await prisma.turma.create({ data: { nome: "Turma B", anoLetivo: 2026 } });
  const aluno = async (nome: string, turmaId: string) => {
    const a = await prisma.aluno.create({ data: { nome } });
    await prisma.matricula.create({ data: { alunoId: a.id, turmaId, dataMatricula: new Date("2026-09-01T12:00:00Z") } });
    return a;
  };
  return { prof, disciplina, turmaA, turmaB, a1: await aluno("Ana", turmaA.id), a2: await aluno("Bia", turmaA.id) };
}

const indicadores = async () => (await request(app).get("/classes/indicadores").set(asGestao())).body as {
  turmaId: string; alunos: number; frequenciaPercentual: number | null; mediaSimuladosPercentual: number | null;
}[];

describe("classes indicators", () => {
  beforeEach(async () => {
    await resetDb();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(AGORA));
  });
  afterEach(() => vi.useRealTimers());

  it("requires a token", async () => {
    expect((await request(app).get("/classes/indicadores")).status).toBe(401);
  });

  it("counts students and returns null without attendance or simulados", async () => {
    const ctx = await setup();
    const rows = await indicadores();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.turmaId === ctx.turmaA.id)).toEqual({ turmaId: ctx.turmaA.id, alunos: 2, frequenciaPercentual: null, mediaSimuladosPercentual: null });
    expect(rows.find((r) => r.turmaId === ctx.turmaB.id)).toMatchObject({ alunos: 0, frequenciaPercentual: null });
  });

  it("averages attendance of grid classes and events", async () => {
    const ctx = await setup();
    const aula = await prisma.aula.create({
      data: {
        turmaId: ctx.turmaA.id, disciplinaId: ctx.disciplina.id, professorId: ctx.prof.id, diaSemana: "QUARTA",
        horarioInicio: new Date("1970-01-01T08:00:00Z"), horarioFim: new Date("1970-01-01T10:00:00Z"), createdAt: new Date(AGORA)
      }
    });
    const evento = await prisma.reuniao.create({
      data: {
        titulo: "Aula extra", tipo: "AULA", data: new Date("2026-10-28"), horarioInicio: new Date("1970-01-01T08:00:00Z"),
        horarioFim: new Date("1970-01-01T10:00:00Z"), disciplinaId: ctx.disciplina.id, exigePresenca: true,
        participacoes: { create: [{ userId: ctx.prof.id }] }, turmas: { connect: [{ id: ctx.turmaA.id }] }
      }
    });
    // Grade: 1 presente + 1 falta; evento (turmaId gravado): 2 presentes -> 3/4 = 75%.
    await prisma.presenca.createMany({
      data: [
        { alunoId: ctx.a1.id, aulaId: aula.id, data: new Date("2026-09-30"), presente: true },
        { alunoId: ctx.a2.id, aulaId: aula.id, data: new Date("2026-09-30"), presente: false },
        { alunoId: ctx.a1.id, reuniaoId: evento.id, turmaId: ctx.turmaA.id, data: new Date("2026-10-28"), presente: true },
        { alunoId: ctx.a2.id, reuniaoId: evento.id, turmaId: ctx.turmaA.id, data: new Date("2026-10-28"), presente: true }
      ]
    });
    const rows = await indicadores();
    expect(rows.find((r) => r.turmaId === ctx.turmaA.id)?.frequenciaPercentual).toBe(75);
    expect(rows.find((r) => r.turmaId === ctx.turmaB.id)?.frequenciaPercentual).toBeNull();
  });

  it("simulados average equals the one from /simulados/turma/:id", async () => {
    const ctx = await setup();
    const sim = await prisma.reuniao.create({
      data: {
        titulo: "Simulado 1", tipo: "SIMULADO", data: new Date("2026-09-20"), horarioInicio: new Date("1970-01-01T08:00:00Z"),
        horarioFim: new Date("1970-01-01T12:00:00Z"), pontuacaoMaxima: 100, prazoCorrecao: new Date("2026-09-30"),
        correcaoEnviadaEm: new Date("2026-09-25T12:00:00Z"), participacoes: { create: [{ userId: ctx.prof.id }] },
        turmas: { connect: [{ id: ctx.turmaA.id }] }
      }
    });
    await prisma.notaSimulado.createMany({
      data: [
        { reuniaoId: sim.id, alunoId: ctx.a1.id, turmaId: ctx.turmaA.id, valor: 80 },
        { reuniaoId: sim.id, alunoId: ctx.a2.id, turmaId: ctx.turmaA.id, valor: 41 }
      ]
    });
    const detalhe = await request(app).get(`/simulados/turma/${ctx.turmaA.id}`).set(asGestao());
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.media).toBe(60.5);
    const rows = await indicadores();
    expect(rows.find((r) => r.turmaId === ctx.turmaA.id)?.mediaSimuladosPercentual).toBe(detalhe.body.media);
    expect(rows.find((r) => r.turmaId === ctx.turmaB.id)?.mediaSimuladosPercentual).toBeNull();
  });
});
