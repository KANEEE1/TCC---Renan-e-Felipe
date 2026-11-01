import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signAuthToken } from "../src/shared/auth.js";
import { prisma } from "../src/shared/prisma.js";
import { app, asGestao, asTeacher, createUser, resetDb } from "./helpers.js";

// America/Sao_Paulo é UTC-3. 2026-10-28 é uma quarta-feira. Aula comum com presença: 08:00-10:00 (SP).
const ANTES = "2026-10-27T12:00:00Z";
const QUARTA_0759 = "2026-10-28T10:59:00Z";
const QUARTA_0830 = "2026-10-28T11:30:00Z";
const QUARTA_1000 = "2026-10-28T13:00:00Z";
const QUARTA_1001 = "2026-10-28T13:01:00Z";
const QUINTA_0830 = "2026-10-29T11:30:00Z";

function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

async function setup() {
  const gestor = await createUser({ email: "gestor@ev.com", roles: ["GESTAO"], name: "Gestor" });
  const prof = await createUser({ email: "prof@ev.com", roles: ["PROFESSOR"], name: "Prof Ev" });
  const outro = await createUser({ email: "outro@ev.com", roles: ["PROFESSOR"], name: "Outro Prof" });
  const disciplina = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
  const turmaA = await prisma.turma.create({ data: { nome: "Turma A", anoLetivo: 2026 } });
  const turmaB = await prisma.turma.create({ data: { nome: "Turma B", anoLetivo: 2026 } });
  const turmaC = await prisma.turma.create({ data: { nome: "Turma C", anoLetivo: 2026 } });
  const matricular = async (nome: string, turmaId: string, dataMatricula = "2026-10-01T12:00:00Z") => {
    const aluno = await prisma.aluno.create({ data: { nome } });
    await prisma.matricula.create({ data: { alunoId: aluno.id, turmaId, dataMatricula: new Date(dataMatricula) } });
    return aluno;
  };
  const a1 = await matricular("Ana", turmaA.id);
  const a2 = await matricular("Bia", turmaA.id);
  const b1 = await matricular("Caio", turmaB.id);
  const c1 = await matricular("Duda", turmaC.id);
  const gestorHeader = { Authorization: `Bearer ${signAuthToken({ sub: gestor.id, roles: ["GESTAO"] })}` };
  return { gestor, gestorHeader, prof, outro, disciplina, turmaA, turmaB, turmaC, a1, a2, b1, c1, matricular };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const payloadDe = (ctx: Ctx, extra: Record<string, unknown> = {}) => ({
  titulo: "Aula extra",
  tipo: "AULA",
  data: "2026-10-28",
  horarioInicio: "08:00",
  horarioFim: "10:00",
  disciplinaId: ctx.disciplina.id,
  participanteIds: [ctx.prof.id],
  turmaIds: [ctx.turmaA.id, ctx.turmaB.id],
  exigePresenca: true,
  ...extra
});

// Direto no banco, para controlar createdAt.
async function criarEvento(ctx: Ctx, extra: { createdAt?: Date; turmaIds?: string[] } = {}) {
  return prisma.reuniao.create({
    data: {
      titulo: "Aula extra",
      tipo: "AULA",
      data: new Date("2026-10-28"),
      horarioInicio: new Date("1970-01-01T08:00:00Z"),
      horarioFim: new Date("1970-01-01T10:00:00Z"),
      disciplinaId: ctx.disciplina.id,
      exigePresenca: true,
      createdAt: extra.createdAt ?? new Date("2026-10-01T12:00:00Z"),
      participacoes: { create: [{ userId: ctx.prof.id }] },
      turmas: { connect: (extra.turmaIds ?? [ctx.turmaA.id, ctx.turmaB.id]).map((id) => ({ id })) }
    }
  });
}

const mark = (token: Record<string, string>, body: object) => request(app).post("/attendance/mark").set(token).send(body);

describe("aula comum com presença", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("criação e edição do evento", () => {
    it("creates without attendance, and with attendance for exactly one professor and at least one class", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const post = (body: object) => request(app).post("/meetings").set(ctx.gestorHeader).send(body);

      const sem = await post(payloadDe(ctx, { exigePresenca: undefined, participanteIds: [], turmaIds: [], semProfessores: true }));
      expect(sem.status).toBe(201);
      expect(sem.body.exigePresenca).toBe(false);

      const ok = await post(payloadDe(ctx));
      expect(ok.status).toBe(201);
      expect(ok.body.exigePresenca).toBe(true);
      expect((await request(app).get(`/meetings/${ok.body.id}`).set(ctx.gestorHeader)).body.exigePresenca).toBe(true);

      expect((await post(payloadDe(ctx, { participanteIds: [] }))).status).toBe(400);
      expect((await post(payloadDe(ctx, { participanteIds: [ctx.prof.id, ctx.outro.id] }))).status).toBe(400);
      expect((await post(payloadDe(ctx, { participanteIds: [ctx.prof.id, ctx.gestor.id] }))).status).toBe(400);
      expect((await post(payloadDe(ctx, { participanteIds: [ctx.gestor.id] }))).status).toBe(400);
      expect((await post(payloadDe(ctx, { turmaIds: [] }))).status).toBe(400);
      expect((await post(payloadDe(ctx, { semProfessores: true }))).status).toBe(400);
      expect((await post(payloadDe(ctx, { tipo: "AULAO" }))).status).toBe(400);
      expect((await post(payloadDe(ctx, { tipo: "REUNIAO", disciplinaId: undefined }))).status).toBe(400);
    });

    it("validates and edits attendance until the class starts", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const { body } = await request(app).post("/meetings").set(ctx.gestorHeader).send(payloadDe(ctx));
      const put = (data: object) => request(app).put(`/meetings/${body.id}`).set(ctx.gestorHeader).send(data);

      expect((await put({ turmaIds: [] })).status).toBe(400);
      expect((await put({ participanteIds: [ctx.prof.id, ctx.outro.id] })).status).toBe(400);
      expect((await put({ tipo: "AULAO" })).status).toBe(400);
      expect((await put({ participanteIds: [ctx.outro.id], turmaIds: [ctx.turmaC.id] })).status).toBe(200);

      const desligada = await put({ exigePresenca: false, participanteIds: [], semProfessores: true });
      expect(desligada.status).toBe(200);
      expect(desligada.body.exigePresenca).toBe(false);
      const religada = await put({ exigePresenca: true, participanteIds: [ctx.prof.id] });
      expect(religada.status).toBe(200);
      expect(religada.body.exigePresenca).toBe(true);
    });

    it("requires an attendance class to start in the future, on create and when rescheduled", async () => {
      const ctx = await setup();
      setNow(QUARTA_0830);
      const past = await request(app).post("/meetings").set(ctx.gestorHeader).send(payloadDe(ctx));
      expect(past.status).toBe(400);
      expect(past.body.message).toBe("Uma aula com presença precisa começar no futuro");
      // Sem presença, o passado continua permitido.
      expect((await request(app).post("/meetings").set(ctx.gestorHeader).send(payloadDe(ctx, { exigePresenca: false }))).status).toBe(201);

      setNow(ANTES);
      const { body } = await request(app).post("/meetings").set(ctx.gestorHeader).send(payloadDe(ctx));
      const put = (data: object) => request(app).put(`/meetings/${body.id}`).set(ctx.gestorHeader).send(data);
      expect((await put({ data: "2026-10-26" })).status).toBe(400);
      expect((await put({ data: "2026-10-27", horarioInicio: "10:00", horarioFim: "11:00" })).status).toBe(200);
      expect((await put({ data: "2026-10-27", horarioInicio: "11:00", horarioFim: "12:00" })).status).toBe(200);
      expect((await put({ horarioInicio: "07:00", horarioFim: "09:00", data: "2026-10-27" })).status).toBe(400);
    });

    it("locks attendance, teacher and classes once the class starts (but accepts an unchanged payload)", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const { body } = await request(app).post("/meetings").set(ctx.gestorHeader).send(payloadDe(ctx));
      const put = (data: object) => request(app).put(`/meetings/${body.id}`).set(ctx.gestorHeader).send(data);

      setNow(QUARTA_0830);
      expect((await put({ exigePresenca: false, participanteIds: [], semProfessores: true })).status).toBe(409);
      expect((await put({ participanteIds: [ctx.outro.id] })).status).toBe(409);
      expect((await put({ turmaIds: [ctx.turmaA.id] })).status).toBe(409);
      expect((await put({ horarioFim: "11:00" })).status).toBe(409);
      expect((await put({ titulo: "Novo título", exigePresenca: true, participanteIds: [ctx.prof.id], turmaIds: [ctx.turmaB.id, ctx.turmaA.id] })).status).toBe(200);
    });

    it("does not turn attendance off when there are records", async () => {
      const ctx = await setup();
      const evento = await criarEvento(ctx);
      await prisma.presenca.create({ data: { alunoId: ctx.a1.id, reuniaoId: evento.id, turmaId: ctx.turmaA.id, data: evento.data, presente: true } });
      setNow(ANTES);
      const res = await request(app).put(`/meetings/${evento.id}`).set(ctx.gestorHeader).send({ exigePresenca: false, participanteIds: [], semProfessores: true });
      expect(res.status).toBe(409);
    });

    it("does not delete an event with records, but deletes one without", async () => {
      const ctx = await setup();
      const comRegistro = await criarEvento(ctx);
      const semRegistro = await criarEvento(ctx);
      await prisma.presenca.create({ data: { alunoId: ctx.a1.id, reuniaoId: comRegistro.id, turmaId: ctx.turmaA.id, data: comRegistro.data, presente: true } });
      setNow(ANTES);
      expect((await request(app).delete(`/meetings/${comRegistro.id}`).set(ctx.gestorHeader)).status).toBe(409);
      expect(await prisma.reuniao.count({ where: { id: comRegistro.id } })).toBe(1);
      expect((await request(app).delete(`/meetings/${semRegistro.id}`).set(ctx.gestorHeader)).status).toBe(204);
    });
  });

  describe("GET /attendance/today", () => {
    it("shows the event only on its day, with status and permissions", async () => {
      const ctx = await setup();
      const evento = await criarEvento(ctx);
      await criarEvento(ctx).then((e) => prisma.reuniao.update({ where: { id: e.id }, data: { exigePresenca: false } }));

      setNow(QUARTA_0759);
      const antes = await request(app).get("/attendance/today").set(asTeacher(ctx.prof.id));
      expect(antes.body).toHaveLength(1);
      expect(antes.body[0]).toMatchObject({
        kind: "EVENTO",
        eventoId: evento.id,
        status: "AGUARDANDO",
        responsavel: true,
        podeRegistrar: false,
        aula: { horarioInicio: "08:00", horarioFim: "10:00", disciplina: { nome: "Química" }, professor: { id: ctx.prof.id } }
      });
      expect(antes.body[0].aula.turmas.map((t: any) => t.nome)).toEqual(["Turma A", "Turma B"]);

      setNow(QUARTA_0830);
      expect((await request(app).get("/attendance/today").set(asTeacher(ctx.prof.id))).body[0]).toMatchObject({ status: "ABERTA", podeRegistrar: true, registrada: false });
      expect((await request(app).get("/attendance/today").set(asGestao())).body[0]).toMatchObject({ responsavel: false, podeRegistrar: false });
      expect((await request(app).get("/attendance/today").set(asTeacher(ctx.outro.id))).body[0]).toMatchObject({ responsavel: false, podeRegistrar: false });

      setNow(QUINTA_0830);
      expect((await request(app).get("/attendance/today").set(asTeacher(ctx.prof.id))).body).toEqual([]);
    });
  });

  describe("POST /attendance/mark com eventoId", () => {
    it("lets only the event's teacher register inside the window, storing the student's class", async () => {
      const ctx = await setup();
      const evento = await criarEvento(ctx);
      setNow(QUARTA_0830);

      const res = await mark(asTeacher(ctx.prof.id), { eventoId: evento.id, entries: [{ alunoId: ctx.a1.id, presente: false }, { alunoId: ctx.b1.id, presente: true }] });
      expect(res.status).toBe(201);
      const rows = await prisma.presenca.findMany({ where: { reuniaoId: evento.id } });
      expect(rows).toHaveLength(3);
      expect(rows.find((r) => r.alunoId === ctx.a1.id)).toMatchObject({ presente: false, automatica: false, turmaId: ctx.turmaA.id, aulaId: null });
      expect(rows.find((r) => r.alunoId === ctx.b1.id)).toMatchObject({ presente: true, turmaId: ctx.turmaB.id });
      expect(rows.find((r) => r.alunoId === ctx.a2.id)).toMatchObject({ presente: true, automatica: false, turmaId: ctx.turmaA.id });

      // Reenviar atualiza (upsert).
      expect((await mark(asTeacher(ctx.prof.id), { eventoId: evento.id, entries: [{ alunoId: ctx.a1.id, presente: true }] })).status).toBe(201);
      expect(await prisma.presenca.count({ where: { reuniaoId: evento.id } })).toBe(3);

      const item = (await request(app).get("/attendance/today").set(asTeacher(ctx.prof.id))).body[0];
      expect(item).toMatchObject({ registrada: true, presentes: 3, total: 3 });
    });

    it("only counts students enrolled on the event date, when validating and when filling the unlisted", async () => {
      const ctx = await setup();
      const evento = await criarEvento(ctx);
      const tardio = await ctx.matricular("Eva tardia", ctx.turmaA.id, "2026-10-30T12:00:00Z");
      setNow(QUARTA_0830);
      const rejeitado = await mark(asTeacher(ctx.prof.id), { eventoId: evento.id, entries: [{ alunoId: tardio.id, presente: true }] });
      expect(rejeitado.status).toBe(400);

      expect((await mark(asTeacher(ctx.prof.id), { eventoId: evento.id, entries: [{ alunoId: ctx.a1.id, presente: false }] })).status).toBe(201);
      const rows = await prisma.presenca.findMany({ where: { reuniaoId: evento.id } });
      expect(rows.map((r) => r.alunoId).sort()).toEqual([ctx.a1.id, ctx.a2.id, ctx.b1.id].sort());
    });

    it("rejects gestao and other teachers with 403", async () => {
      const ctx = await setup();
      const evento = await criarEvento(ctx);
      setNow(QUARTA_0830);
      const body = { eventoId: evento.id, entries: [{ alunoId: ctx.a1.id, presente: true }] };
      expect((await mark(ctx.gestorHeader, body)).status).toBe(403);
      expect((await mark(asTeacher(ctx.outro.id), body)).status).toBe(403);
      expect(await prisma.presenca.count()).toBe(0);
    });

    it("accepts the window boundaries and rejects outside of them with 409", async () => {
      const ctx = await setup();
      const evento = await criarEvento(ctx);
      const send = () => mark(asTeacher(ctx.prof.id), { eventoId: evento.id, entries: [{ alunoId: ctx.a1.id, presente: true }] });
      setNow(QUARTA_0759);
      expect((await send()).status).toBe(409);
      setNow(QUARTA_1000);
      expect((await send()).status).toBe(201);
      setNow(QUARTA_1001);
      expect((await send()).status).toBe(409);
      setNow(QUINTA_0830);
      const outroDia = await send();
      expect(outroDia.status).toBe(409);
      expect(outroDia.body.message).toBe("A aula não é hoje");
    });

    it("rejects students from other classes with 400, and ambiguous or empty targets", async () => {
      const ctx = await setup();
      const evento = await criarEvento(ctx);
      const aula = await prisma.aula.create({
        data: {
          turmaId: ctx.turmaA.id,
          disciplinaId: ctx.disciplina.id,
          professorId: ctx.prof.id,
          diaSemana: "QUARTA",
          horarioInicio: new Date("1970-01-01T08:00:00Z"),
          horarioFim: new Date("1970-01-01T10:00:00Z")
        }
      });
      setNow(QUARTA_0830);
      const fora = await mark(asTeacher(ctx.prof.id), { eventoId: evento.id, entries: [{ alunoId: ctx.c1.id, presente: true }] });
      expect(fora.status).toBe(400);
      expect(await prisma.presenca.count()).toBe(0);
      const entries = [{ alunoId: ctx.a1.id, presente: true }];
      expect((await mark(asTeacher(ctx.prof.id), { eventoId: evento.id, aulaId: aula.id, entries })).status).toBe(400);
      expect((await mark(asTeacher(ctx.prof.id), { entries })).status).toBe(400);
    });
  });

  describe("consolidação e relatórios", () => {
    it("marks every enrolled student of the event's classes present after the window, once", async () => {
      const ctx = await setup();
      const evento = await criarEvento(ctx);
      await ctx.matricular("Eva tardia", ctx.turmaA.id, "2026-10-30T12:00:00Z");

      setNow(QUARTA_1000);
      await request(app).get(`/attendance/report/${ctx.a1.id}`);
      expect(await prisma.presenca.count({ where: { reuniaoId: evento.id } })).toBe(0);

      setNow(QUARTA_1001);
      await request(app).get(`/attendance/report/${ctx.a1.id}`);
      await request(app).get(`/attendance/report/${ctx.a1.id}`);
      const rows = await prisma.presenca.findMany({ where: { reuniaoId: evento.id } });
      expect(rows.map((r) => r.alunoId).sort()).toEqual([ctx.a1.id, ctx.a2.id, ctx.b1.id].sort());
      expect(rows.every((r) => r.automatica && r.presente && r.aulaId === null)).toBe(true);
      expect(rows.find((r) => r.alunoId === ctx.b1.id)?.turmaId).toBe(ctx.turmaB.id);

      const item = (await request(app).get("/attendance/today").set(asTeacher(ctx.prof.id))).body[0];
      expect(item).toMatchObject({ status: "ENCERRADA", registrada: false, automatica: true, presentes: 3, total: 3 });
    });

    it("does not consolidate over a teacher's registration nor an event created after it ended", async () => {
      const ctx = await setup();
      const marcado = await criarEvento(ctx);
      const tardio = await criarEvento(ctx, { createdAt: new Date("2026-10-28T14:00:00Z") });
      setNow(QUARTA_0830);
      await mark(asTeacher(ctx.prof.id), { eventoId: marcado.id, entries: [{ alunoId: ctx.a1.id, presente: false }] });
      setNow("2026-10-28T15:00:00Z");
      await request(app).get(`/attendance/report/${ctx.a1.id}`);
      expect(await prisma.presenca.count({ where: { reuniaoId: marcado.id } })).toBe(3);
      expect(await prisma.presenca.count({ where: { reuniaoId: marcado.id, automatica: true } })).toBe(0);
      expect(await prisma.presenca.count({ where: { reuniaoId: tardio.id } })).toBe(0);
    });

    it("counts event attendance in the class and student reports together with grid lessons", async () => {
      const ctx = await setup();
      const evento = await criarEvento(ctx);
      const aula = await prisma.aula.create({
        data: {
          turmaId: ctx.turmaA.id,
          disciplinaId: ctx.disciplina.id,
          professorId: ctx.prof.id,
          diaSemana: "SEGUNDA",
          horarioInicio: new Date("1970-01-01T08:00:00Z"),
          horarioFim: new Date("1970-01-01T10:00:00Z")
        }
      });
      await prisma.presenca.create({ data: { alunoId: ctx.a1.id, aulaId: aula.id, data: new Date("2026-10-26"), presente: true } });
      setNow(QUARTA_0830);
      await mark(asTeacher(ctx.prof.id), { eventoId: evento.id, entries: [{ alunoId: ctx.a1.id, presente: false }] });

      const report = await request(app).get(`/attendance/report/${ctx.a1.id}`);
      expect(report.body).toMatchObject({ totalClasses: 2, present: 1, absent: 1, percentage: 50 });
      expect(report.body.history.map((h: any) => h.aulaId ?? h.reuniaoId).sort()).toEqual([aula.id, evento.id].sort());

      const byA = await request(app).get(`/attendance/by-class/${ctx.turmaA.id}`);
      expect(byA.body).toHaveLength(3);
      const byB = await request(app).get(`/attendance/by-class/${ctx.turmaB.id}`);
      expect(byB.body.map((p: any) => p.alunoId)).toEqual([ctx.b1.id]);
      expect(byB.body[0].reuniao.titulo).toBe("Aula extra");
      expect((await request(app).get(`/attendance/by-class/${ctx.turmaC.id}`)).body).toEqual([]);

      const summaryA = (await request(app).get(`/attendance/summary?turmaId=${ctx.turmaA.id}`)).body.items;
      expect(summaryA.find((i: any) => i.alunoId === ctx.a1.id)).toMatchObject({ totalRegistros: 2, presencas: 1, faltas: 1 });
      expect(summaryA.find((i: any) => i.alunoId === ctx.a2.id)).toMatchObject({ totalRegistros: 1, presencas: 1 });
      const summaryB = (await request(app).get(`/attendance/summary?turmaId=${ctx.turmaB.id}`)).body.items;
      expect(summaryB).toHaveLength(1);
      expect(summaryB[0]).toMatchObject({ alunoId: ctx.b1.id, totalRegistros: 1, presencas: 1 });
      const summaryC = (await request(app).get(`/attendance/summary?turmaId=${ctx.turmaC.id}`)).body.items;
      expect(summaryC[0]).toMatchObject({ alunoId: ctx.c1.id, semRegistros: true });
    });
  });
});
