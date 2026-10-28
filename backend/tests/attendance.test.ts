import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { app, asGestao, asTeacher, createUser, resetDb } from "./helpers.js";

// America/Sao_Paulo é UTC-3. 2026-10-28 é uma quarta-feira. Aula: QUARTA 08:00-10:00 (SP).
const QUARTA_0830 = "2026-10-28T11:30:00Z";
const QUARTA_0759 = "2026-10-28T10:59:00Z";
const QUARTA_1000 = "2026-10-28T13:00:00Z";
const QUARTA_1001 = "2026-10-28T13:01:00Z";
const QUINTA_0830 = "2026-10-29T11:30:00Z";

function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

async function setup(opts: { gradeInicio?: string; gradeFim?: string; diaSemana?: string; alunos?: number } = {}) {
  const turma = await prisma.turma.create({
    data: {
      nome: "Turma Att",
      anoLetivo: 2026,
      gradeInicio: opts.gradeInicio ? new Date(opts.gradeInicio) : null,
      gradeFim: opts.gradeFim ? new Date(opts.gradeFim) : null
    }
  });
  const disciplina = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
  const prof = await createUser({ email: "prof@att.com", roles: ["PROFESSOR"], name: "Prof Att" });
  const aula = await prisma.aula.create({
    data: {
      turmaId: turma.id,
      disciplinaId: disciplina.id,
      professorId: prof.id,
      diaSemana: opts.diaSemana ?? "QUARTA",
      horarioInicio: new Date("1970-01-01T08:00:00Z"),
      horarioFim: new Date("1970-01-01T10:00:00Z"),
      createdAt: new Date("2026-10-01T12:00:00Z")
    }
  });
  const alunos = [];
  for (let i = 0; i < (opts.alunos ?? 2); i++) {
    const aluno = await prisma.aluno.create({ data: { nome: `Aluno ${i + 1}` } });
    await prisma.matricula.create({ data: { alunoId: aluno.id, turmaId: turma.id, dataMatricula: new Date("2026-10-01T12:00:00Z") } });
    alunos.push(aluno);
  }
  return { turma, aula, prof, alunos };
}

const entriesOf = (alunos: { id: string }[], presente = true) => alunos.map((a) => ({ alunoId: a.id, presente }));
const countPresencas = (aulaId: string) => prisma.presenca.count({ where: { aulaId } });

describe("attendance", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("POST /attendance/mark", () => {
    it("lets the owner register inside the window and re-submit (upsert)", async () => {
      const { aula, prof, alunos } = await setup();
      setNow(QUARTA_0830);

      const res = await request(app).post("/attendance/mark").set(asTeacher(prof.id)).send({ aulaId: aula.id, entries: entriesOf(alunos) });
      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(2);

      const again = await request(app)
        .post("/attendance/mark")
        .set(asTeacher(prof.id))
        .send({ aulaId: aula.id, data: "2026-10-28", entries: [{ alunoId: alunos[0].id, presente: false }] });
      expect(again.status).toBe(201);
      expect(await countPresencas(aula.id)).toBe(2);
      const row = await prisma.presenca.findFirstOrThrow({ where: { alunoId: alunos[0].id } });
      expect(row.presente).toBe(false);
    });

    it("fills unsent enrolled students as present in the same registration", async () => {
      const { aula, prof, alunos } = await setup();
      setNow(QUARTA_0830);
      const res = await request(app)
        .post("/attendance/mark")
        .set(asTeacher(prof.id))
        .send({ aulaId: aula.id, entries: [{ alunoId: alunos[0].id, presente: false }] });
      expect(res.status).toBe(201);
      const rows = await prisma.presenca.findMany({ where: { aulaId: aula.id } });
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.alunoId === alunos[1].id)).toMatchObject({ presente: true, automatica: false });
    });

    it("requires authentication", async () => {
      const { aula, alunos } = await setup();
      setNow(QUARTA_0830);
      const res = await request(app).post("/attendance/mark").send({ aulaId: aula.id, entries: entriesOf(alunos) });
      expect(res.status).toBe(401);
    });

    it("accepts the window boundaries and rejects outside of them with 409", async () => {
      const { aula, prof, alunos } = await setup();
      const send = () => request(app).post("/attendance/mark").set(asTeacher(prof.id)).send({ aulaId: aula.id, entries: entriesOf(alunos) });

      setNow(QUARTA_0759);
      expect((await send()).status).toBe(409);
      setNow(QUARTA_1000);
      expect((await send()).status).toBe(201);
      setNow(QUARTA_1001);
      const late = await send();
      expect(late.status).toBe(409);
      expect(late.body.message).toBe("Fora do horário da aula");
    });

    it("rejects another weekday with 409", async () => {
      const { aula, prof, alunos } = await setup();
      setNow(QUINTA_0830);
      const res = await request(app).post("/attendance/mark").set(asTeacher(prof.id)).send({ aulaId: aula.id, entries: entriesOf(alunos) });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("A aula não é hoje");
    });

    it("rejects dates outside the class grid period with 409", async () => {
      const { aula, prof, alunos } = await setup({ gradeInicio: "2026-11-01", gradeFim: "2026-12-01" });
      setNow(QUARTA_0830);
      const res = await request(app).post("/attendance/mark").set(asTeacher(prof.id)).send({ aulaId: aula.id, entries: entriesOf(alunos) });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Fora do período da grade");
    });

    it("rejects gestao and other teachers with 403", async () => {
      const { aula, alunos } = await setup();
      const other = await createUser({ email: "outro@att.com", roles: ["PROFESSOR"] });
      setNow(QUARTA_0830);
      const body = { aulaId: aula.id, entries: entriesOf(alunos) };
      expect((await request(app).post("/attendance/mark").set(asGestao()).send(body)).status).toBe(403);
      expect((await request(app).post("/attendance/mark").set(asTeacher(other.id)).send(body)).status).toBe(403);
    });

    async function substitution(aulaId: string, substitutoId: string, status: "ACEITA" | "PENDENTE", data = "2026-10-28") {
      const ausencia = await prisma.ausenciaAula.create({
        data: { aulaId, data: new Date(data), registradoPorId: substitutoId }
      });
      await prisma.substituicao.create({ data: { ausenciaId: ausencia.id, substitutoId, status } });
    }

    it("lets an accepted substitute register that day, but not a pending one", async () => {
      const { aula, alunos } = await setup();
      const sub = await createUser({ email: "sub@att.com", roles: ["PROFESSOR"] });
      await substitution(aula.id, sub.id, "PENDENTE");
      setNow(QUARTA_0830);
      const body = { aulaId: aula.id, entries: entriesOf(alunos) };
      expect((await request(app).post("/attendance/mark").set(asTeacher(sub.id)).send(body)).status).toBe(403);

      await prisma.substituicao.updateMany({ data: { status: "ACEITA" } });
      expect((await request(app).post("/attendance/mark").set(asTeacher(sub.id)).send(body)).status).toBe(201);
    });

    it("does not let a substitute of another date register today", async () => {
      const { aula, alunos } = await setup();
      const sub = await createUser({ email: "sub2@att.com", roles: ["PROFESSOR"] });
      await substitution(aula.id, sub.id, "ACEITA", "2026-10-21");
      setNow(QUARTA_0830);
      const res = await request(app).post("/attendance/mark").set(asTeacher(sub.id)).send({ aulaId: aula.id, entries: entriesOf(alunos) });
      expect(res.status).toBe(403);
    });

    it("rejects a body date different from today with 400", async () => {
      const { aula, prof, alunos } = await setup();
      setNow(QUARTA_0830);
      const res = await request(app)
        .post("/attendance/mark")
        .set(asTeacher(prof.id))
        .send({ aulaId: aula.id, data: "2026-10-21", entries: entriesOf(alunos) });
      expect(res.status).toBe(400);
    });

    it("rejects students not enrolled in the class with 400", async () => {
      const { aula, prof } = await setup();
      const stranger = await prisma.aluno.create({ data: { nome: "Forasteiro" } });
      setNow(QUARTA_0830);
      const res = await request(app)
        .post("/attendance/mark")
        .set(asTeacher(prof.id))
        .send({ aulaId: aula.id, entries: [{ alunoId: stranger.id, presente: true }] });
      expect(res.status).toBe(400);
    });
  });

  describe("consolidation", () => {
    it("marks everyone present for a past lesson without records", async () => {
      const { aula, alunos } = await setup();
      setNow("2026-10-29T15:00:00Z"); // quinta; quarta 28/10 e 21/10 e 14/10 ... desde a criação (01/10)

      const res = await request(app).get("/attendance");
      expect(res.status).toBe(200);
      // quartas desde 01/10: 7, 14, 21, 28
      expect(res.body).toHaveLength(4 * alunos.length);
      expect(res.body.every((p: { presente: boolean }) => p.presente)).toBe(true);
      expect(await countPresencas(aula.id)).toBe(8);
    });

    it("does not alter a date that already has records and is idempotent", async () => {
      const { aula, alunos } = await setup();
      await prisma.presenca.create({ data: { alunoId: alunos[0].id, aulaId: aula.id, data: new Date("2026-10-21"), presente: false } });
      setNow("2026-10-29T15:00:00Z");

      await request(app).get("/attendance");
      await request(app).get("/attendance/summary");
      expect(await countPresencas(aula.id)).toBe(1 + 3 * 2);
      const kept = await prisma.presenca.findFirstOrThrow({ where: { alunoId: alunos[0].id, data: new Date("2026-10-21") } });
      expect(kept.presente).toBe(false);
      expect(await prisma.presenca.count({ where: { data: new Date("2026-10-21") } })).toBe(1);
    });

    it("respects the class grid period", async () => {
      const { aula } = await setup({ gradeInicio: "2026-10-14", gradeFim: "2026-10-21" });
      setNow("2026-10-29T15:00:00Z");
      await request(app).get("/attendance");
      const dates = (await prisma.presenca.findMany({ where: { aulaId: aula.id }, distinct: ["data"] })).map((p) => p.data.toISOString().slice(0, 10)).sort();
      expect(dates).toEqual(["2026-10-14", "2026-10-21"]);
    });

    it("does not consolidate today before the end, and does after it (closing the window)", async () => {
      const { aula, prof, alunos } = await setup();
      await prisma.presenca.createMany({
        data: ["2026-10-07", "2026-10-14", "2026-10-21"].map((d) => ({ alunoId: alunos[0].id, aulaId: aula.id, data: new Date(d), presente: true }))
      });

      setNow(QUARTA_1000);
      await request(app).get("/attendance");
      expect(await prisma.presenca.count({ where: { data: new Date("2026-10-28") } })).toBe(0);

      setNow(QUARTA_1001);
      await request(app).get("/attendance");
      expect(await prisma.presenca.count({ where: { data: new Date("2026-10-28"), presente: true } })).toBe(2);

      const mark = await request(app).post("/attendance/mark").set(asTeacher(prof.id)).send({ aulaId: aula.id, entries: entriesOf(alunos) });
      expect(mark.status).toBe(409);
    });

    it("does not give attendance on past dates to students enrolled later", async () => {
      const { turma, aula, alunos } = await setup({ gradeInicio: "2026-10-14", gradeFim: "2026-10-28" });
      const tardio = await prisma.aluno.create({ data: { nome: "Tardio" } });
      await prisma.matricula.create({ data: { alunoId: tardio.id, turmaId: turma.id, dataMatricula: new Date("2026-10-20T12:00:00Z") } });
      setNow(QUARTA_1001);
      await request(app).get("/attendance");
      const datas = (await prisma.presenca.findMany({ where: { alunoId: tardio.id } })).map((p) => p.data.toISOString().slice(0, 10)).sort();
      expect(datas).toEqual(["2026-10-21", "2026-10-28"]);
      expect(await prisma.presenca.count({ where: { alunoId: alunos[0].id, aulaId: aula.id } })).toBe(3);
    });

    it("does not consolidate the day a lesson was created after its end time", async () => {
      const { aula } = await setup({ gradeInicio: "2026-10-28", gradeFim: "2026-10-28" });
      await prisma.aula.update({ where: { id: aula.id }, data: { createdAt: new Date("2026-10-28T14:00:00Z") } }); // 11:00 SP
      setNow("2026-10-28T20:00:00Z");
      await request(app).get("/attendance");
      expect(await countPresencas(aula.id)).toBe(0);
    });

    it("also consolidates on a day the teacher was absent", async () => {
      const { aula, prof, alunos } = await setup({ gradeInicio: "2026-10-21", gradeFim: "2026-10-21" });
      await prisma.ausenciaAula.create({ data: { aulaId: aula.id, data: new Date("2026-10-21"), registradoPorId: prof.id } });
      setNow(QUARTA_0830);
      await request(app).get("/attendance/report/" + alunos[0].id);
      expect(await prisma.presenca.count({ where: { aulaId: aula.id, data: new Date("2026-10-21"), presente: true } })).toBe(2);
    });
  });

  describe("GET /attendance/today", () => {
    it("requires authentication", async () => {
      expect((await request(app).get("/attendance/today")).status).toBe(401);
    });

    it("reports status and permissions for owner, gestao and substitute", async () => {
      const { aula, prof, alunos } = await setup();
      const sub = await createUser({ email: "sub3@att.com", roles: ["PROFESSOR"] });
      const ausencia = await prisma.ausenciaAula.create({ data: { aulaId: aula.id, data: new Date("2026-10-28"), registradoPorId: prof.id } });
      await prisma.substituicao.create({ data: { ausenciaId: ausencia.id, substitutoId: sub.id, status: "ACEITA" } });
      await prisma.presenca.createMany({
        data: ["2026-10-07", "2026-10-14", "2026-10-21"].map((d) => ({ alunoId: alunos[0].id, aulaId: aula.id, data: new Date(d), presente: true }))
      });

      setNow(QUARTA_0759);
      const before = await request(app).get("/attendance/today").set(asTeacher(prof.id));
      expect(before.body).toHaveLength(1);
      expect(before.body[0]).toMatchObject({
        aula: { id: aula.id, horarioInicio: "08:00", horarioFim: "10:00", turma: { nome: "Turma Att" }, professor: { id: prof.id } },
        status: "AGUARDANDO",
        responsavel: true,
        podeRegistrar: false
      });

      setNow(QUARTA_0830);
      const owner = (await request(app).get("/attendance/today").set(asTeacher(prof.id))).body[0];
      expect(owner).toMatchObject({ status: "ABERTA", responsavel: true, podeRegistrar: true, registrada: false, total: 0 });
      const gestao = (await request(app).get("/attendance/today").set(asGestao())).body[0];
      expect(gestao).toMatchObject({ status: "ABERTA", responsavel: false, podeRegistrar: false });
      const substitute = (await request(app).get("/attendance/today").set(asTeacher(sub.id))).body[0];
      expect(substitute).toMatchObject({ status: "ABERTA", responsavel: true, podeRegistrar: true });

      await request(app).post("/attendance/mark").set(asTeacher(prof.id)).send({ aulaId: aula.id, entries: [{ alunoId: alunos[0].id, presente: true }, { alunoId: alunos[1].id, presente: false }] });
      setNow("2026-10-28T12:00:00Z");
      const during = (await request(app).get("/attendance/today").set(asTeacher(prof.id))).body[0];
      expect(during).toMatchObject({ registrada: true, presentes: 1, total: 2 });

      setNow(QUARTA_1001);
      const closed = (await request(app).get("/attendance/today").set(asTeacher(prof.id))).body[0];
      expect(closed).toMatchObject({ status: "ENCERRADA", registrada: true, automatica: false, podeRegistrar: false, presentes: 1, total: 2 });
    });

    it("flags automatic attendance when the window closed without a registration", async () => {
      const { aula, prof, alunos } = await setup();
      await prisma.presenca.createMany({
        data: ["2026-10-07", "2026-10-14", "2026-10-21"].map((d) => ({ alunoId: alunos[0].id, aulaId: aula.id, data: new Date(d), presente: true }))
      });
      setNow(QUARTA_1001);
      const item = (await request(app).get("/attendance/today").set(asTeacher(prof.id))).body[0];
      expect(item).toMatchObject({ status: "ENCERRADA", registrada: false, automatica: true, presentes: 2, total: 2 });
    });

    it("omits lessons of other weekdays and outside the grid period", async () => {
      await setup({ gradeInicio: "2026-11-01" });
      setNow(QUARTA_0830);
      expect((await request(app).get("/attendance/today").set(asGestao())).body).toEqual([]);
    });
  });

  describe("reports", () => {
    it("computes a report with the correct percentage", async () => {
      const { aula, alunos } = await setup({ gradeInicio: "2026-10-07", gradeFim: "2026-10-14" });
      await prisma.presenca.create({ data: { alunoId: alunos[0].id, aulaId: aula.id, data: new Date("2026-10-07"), presente: true } });
      await prisma.presenca.create({ data: { alunoId: alunos[0].id, aulaId: aula.id, data: new Date("2026-10-14"), presente: false } });
      setNow(QUARTA_0830);

      const res = await request(app).get(`/attendance/report/${alunos[0].id}`);
      expect(res.body).toMatchObject({ totalClasses: 2, present: 1, absent: 1, percentage: 50 });
    });

    it("returns a zeroed report for a student with no attendance history", async () => {
      const student = await prisma.aluno.create({ data: { nome: "Sem Historico" } });
      const res = await request(app).get(`/attendance/report/${student.id}`);
      expect(res.body).toEqual({ totalClasses: 0, present: 0, absent: 0, percentage: 0, history: [] });
    });
  });
});
