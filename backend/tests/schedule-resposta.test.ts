import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signAuthToken } from "../src/shared/auth.js";
import { prisma } from "../src/shared/prisma.js";
import { app, asTeacher, createUser, resetDb } from "./helpers.js";

// America/Sao_Paulo é UTC-3. 2026-10-28 é quarta; aula semanal QUARTA 08:00-10:00 do Prof A.
const ANTES = "2026-10-20T12:00:00Z";
const QUARTA_0830 = "2026-10-28T11:30:00Z";

function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const day = (iso: string) => new Date(iso);
const asGestor = (id: string) => ({ Authorization: `Bearer ${signAuthToken({ sub: id, roles: ["GESTAO"] })}` });
const resposta = (aulaId: string, dataOriginal = "2026-10-28") => `/schedule/${aulaId}/ocorrencias/${dataOriginal}/resposta`;

async function setup() {
  const turma = await prisma.turma.create({
    data: { nome: "Turma Resp", anoLetivo: 2026, gradeInicio: day("2026-10-01"), gradeFim: day("2026-12-31") }
  });
  const disciplina = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
  const gestor = await createUser({ email: "g@resp.com", roles: ["GESTAO"], name: "Gestor" });
  const profA = await createUser({ email: "a@resp.com", roles: ["PROFESSOR"], name: "Prof A" });
  const profB = await createUser({ email: "b@resp.com", roles: ["PROFESSOR"], name: "Prof B" });
  const aula = await prisma.aula.create({
    data: {
      turmaId: turma.id,
      disciplinaId: disciplina.id,
      professorId: profA.id,
      diaSemana: "QUARTA",
      horarioInicio: time("08:00"),
      horarioFim: time("10:00"),
      createdAt: new Date("2026-10-01T12:00:00Z")
    }
  });
  return { gestor, profA, profB, aula };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const responder = (ctx: Ctx, userId: string, status: string, dataOriginal = "2026-10-28") =>
  request(app).put(resposta(ctx.aula.id, dataOriginal)).set(asTeacher(userId)).send({ status });
const avisosAula = async (ctx: Ctx) =>
  ((await request(app).get("/notices").set(asGestor(ctx.gestor.id))).body as any[]).filter((a) => a.tipo === "AULA");
const avancar = (ms = 60_000) => vi.setSystemTime(new Date(Date.now() + ms));

describe("PUT /schedule/:id/ocorrencias/:dataOriginal/resposta (Vou / Não vou)", () => {
  beforeEach(async () => {
    await resetDb();
    setNow(ANTES);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Não vou avisa a gestão, Vou desfaz e Não vou de novo reaparece", async () => {
    const ctx = await setup();

    let res = await responder(ctx, ctx.profA.id, "RECUSADO");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "RECUSADO" });
    expect(await avisosAula(ctx)).toHaveLength(1);
    expect((await request(app).get("/schedule/weekly")).body[0].indisponibilidades).toEqual([
      { dataOriginal: "2026-10-28", professorId: ctx.profA.id }
    ]);

    res = await responder(ctx, ctx.profA.id, "CONFIRMADO");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "CONFIRMADO" });
    expect(await prisma.indisponibilidadeAula.count()).toBe(0);
    expect(await avisosAula(ctx)).toEqual([]);
    expect((await request(app).get("/schedule/weekly")).body[0].indisponibilidades).toEqual([]);

    expect((await responder(ctx, ctx.profA.id, "RECUSADO")).status).toBe(200);
    expect(await avisosAula(ctx)).toHaveLength(1);
  });

  it("com convocação pendente, responder pelo endpoint atualiza a convocação", async () => {
    const ctx = await setup();
    const editar = await request(app)
      .put(`/schedule/${ctx.aula.id}/ocorrencias/2026-10-28`)
      .set(asGestor(ctx.gestor.id))
      .send({ professorId: ctx.profB.id });
    expect(editar.status).toBe(200);
    avancar();

    expect((await responder(ctx, ctx.profB.id, "RECUSADO")).status).toBe(200);
    expect((await prisma.convocacaoAula.findFirst())?.status).toBe("RECUSADO");
    expect(await avisosAula(ctx)).toHaveLength(1);

    expect((await responder(ctx, ctx.profB.id, "CONFIRMADO")).status).toBe(200);
    expect((await prisma.convocacaoAula.findFirst())?.status).toBe("CONFIRMADO");
    expect(await avisosAula(ctx)).toEqual([]);
  });

  it("confirmar pela convocação apaga a indisponibilidade da ocorrência", async () => {
    const ctx = await setup();
    await request(app)
      .put(`/schedule/${ctx.aula.id}/ocorrencias/2026-10-28`)
      .set(asGestor(ctx.gestor.id))
      .send({ professorId: ctx.profB.id });
    avancar();
    const convocacao = await prisma.convocacaoAula.findFirstOrThrow();
    // O professor já avisou que não vai e, com a convocação ainda pendente, resolve confirmar por ela.
    await prisma.indisponibilidadeAula.create({ data: { aulaId: ctx.aula.id, dataOriginal: day("2026-10-28"), professorId: ctx.profB.id } });

    const res = await request(app).put(`/notices/mine/convocacoes/${convocacao.id}`).set(asTeacher(ctx.profB.id)).send({ status: "CONFIRMADO" });
    expect(res.status).toBe(200);
    expect(await prisma.indisponibilidadeAula.count()).toBe(0);
  });

  it("rejeita outro professor, não autenticado e status inválido", async () => {
    const ctx = await setup();
    expect((await responder(ctx, ctx.profB.id, "RECUSADO")).status).toBe(403);
    expect((await request(app).put(resposta(ctx.aula.id)).send({ status: "RECUSADO" })).status).toBe(401);
    expect((await responder(ctx, ctx.profA.id, "PENDENTE")).status).toBe(400);
    expect(await prisma.indisponibilidadeAula.count()).toBe(0);
  });

  it("rejeita ocorrência que já começou (409) e cancelada (409)", async () => {
    const ctx = await setup();
    await prisma.aulaExcecao.create({ data: { aulaId: ctx.aula.id, dataOriginal: day("2026-11-04"), cancelada: true } });
    expect((await responder(ctx, ctx.profA.id, "RECUSADO", "2026-11-04")).status).toBe(409);
    expect((await responder(ctx, ctx.profA.id, "RECUSADO", "2026-10-29")).status).toBe(400);

    setNow(QUARTA_0830);
    expect((await responder(ctx, ctx.profA.id, "RECUSADO")).status).toBe(409);
    expect((await responder(ctx, ctx.profA.id, "CONFIRMADO")).status).toBe(409);
  });
});
