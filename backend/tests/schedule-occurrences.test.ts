import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { app, asGestao, asTeacher, createUser, loginAs, resetDb } from "./helpers.js";

// America/Sao_Paulo é UTC-3. 2026-10-28 é quarta; aula semanal QUARTA 08:00-10:00 do Prof A.
const QUARTA_0830 = "2026-10-28T11:30:00Z";
const QUARTA_1030 = "2026-10-28T13:30:00Z";
const QUINTA_1500 = "2026-10-29T18:00:00Z"; // dentro de 14:00-16:00
const QUINTA_1601 = "2026-10-29T19:01:00Z";
const QUINTA_1700 = "2026-10-29T20:00:00Z";

function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const day = (iso: string) => new Date(iso);
const url = (aulaId: string, dataOriginal: string) => `/schedule/${aulaId}/ocorrencias/${dataOriginal}`;

async function setup() {
  const turma = await prisma.turma.create({
    data: { nome: "Turma Oc", anoLetivo: 2026, gradeInicio: day("2026-10-01"), gradeFim: day("2026-12-31") }
  });
  const disciplina = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
  const profA = await createUser({ email: "a@oc.com", roles: ["PROFESSOR"], name: "Prof A" });
  const profB = await createUser({ email: "b@oc.com", roles: ["PROFESSOR"], name: "Prof B" });
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
  const alunos = [];
  for (let i = 0; i < 2; i++) {
    const aluno = await prisma.aluno.create({ data: { nome: `Aluno ${i + 1}` } });
    await prisma.matricula.create({ data: { alunoId: aluno.id, turmaId: turma.id, dataMatricula: new Date("2026-10-01T12:00:00Z") } });
    alunos.push(aluno);
  }
  return { turma, disciplina, profA, profB, aula, alunos };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

// Move a ocorrência de 28/10 para quinta 29/10, 14:00-16:00, com o Prof B.
const moverParaQuinta = (ctx: Ctx) =>
  prisma.aulaExcecao.create({
    data: {
      aulaId: ctx.aula.id,
      dataOriginal: day("2026-10-28"),
      data: day("2026-10-29"),
      horarioInicio: time("14:00"),
      horarioFim: time("16:00"),
      professorId: ctx.profB.id
    }
  });

const cancelar = (ctx: Ctx, dataOriginal = "2026-10-28") =>
  prisma.aulaExcecao.create({ data: { aulaId: ctx.aula.id, dataOriginal: day(dataOriginal), cancelada: true } });

describe("single-occurrence edits", () => {
  beforeEach(async () => {
    await resetDb();
    setNow("2026-10-20T12:00:00Z"); // antes de todas as ocorrências usadas abaixo
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("PUT /schedule/:id/ocorrencias/:dataOriginal", () => {
    it("requires authentication and the GESTAO role", async () => {
      const ctx = await setup();
      const body = { horarioInicio: "09:00", horarioFim: "11:00" };
      expect((await request(app).put(url(ctx.aula.id, "2026-10-28")).send(body)).status).toBe(401);
      expect((await request(app).put(url(ctx.aula.id, "2026-10-28")).set(asTeacher(ctx.profA.id)).send(body)).status).toBe(403);
    });

    it("moves one occurrence and exposes it in the weekly listing", async () => {
      const ctx = await setup();
      const res = await request(app)
        .put(url(ctx.aula.id, "2026-10-28"))
        .set(asGestao())
        .send({ data: "2026-10-29", horarioInicio: "14:00", horarioFim: "16:00", professorId: ctx.profB.id });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        aulaId: ctx.aula.id,
        dataOriginal: "2026-10-28",
        data: "2026-10-29",
        horarioInicio: "14:00",
        horarioFim: "16:00",
        professor: { id: ctx.profB.id, name: "Prof B" }
      });

      const weekly = await request(app).get("/schedule/weekly");
      expect(weekly.body[0].excecoes).toEqual([
        {
          dataOriginal: "2026-10-28",
          cancelada: false,
          data: "2026-10-29",
          horarioInicio: "14:00",
          horarioFim: "16:00",
          professor: { id: ctx.profB.id, name: "Prof B" }
        }
      ]);
      // A série não muda.
      expect(weekly.body[0]).toMatchObject({ diaSemana: "QUARTA", professor: { id: ctx.profA.id } });
    });

    it("inherits omitted fields from the current occurrence and stores a full snapshot", async () => {
      const ctx = await setup();
      const res = await request(app).put(url(ctx.aula.id, "2026-10-28")).set(asGestao()).send({ horarioInicio: "09:00", horarioFim: "11:00" });
      expect(res.status).toBe(200);
      const row = await prisma.aulaExcecao.findFirstOrThrow({ where: { aulaId: ctx.aula.id } });
      expect(row).toMatchObject({ cancelada: false, professorId: ctx.profA.id });
      expect(row.data?.toISOString().slice(0, 10)).toBe("2026-10-28");
    });

    it("rejects invalid requests with 400/404", async () => {
      const ctx = await setup();
      const put = (dataOriginal: string, body: object, id = ctx.aula.id) => request(app).put(url(id, dataOriginal)).set(asGestao()).send(body);
      const gestor = await createUser({ email: "g@oc.com", roles: ["GESTAO"] });

      expect((await put("2026-10-29", { horarioInicio: "09:00", horarioFim: "11:00" })).status).toBe(400); // quinta: fora da série
      expect((await put("2027-01-06", { horarioInicio: "09:00", horarioFim: "11:00" })).status).toBe(400); // quarta fora do período
      expect((await put("2026-13-45", { horarioInicio: "09:00", horarioFim: "11:00" })).status).toBe(400);
      expect((await put("2026-10-28", { horarioInicio: "11:00", horarioFim: "09:00" })).status).toBe(400);
      expect((await put("2026-10-28", { data: "2027-02-03" })).status).toBe(400); // data efetiva fora do período
      expect((await put("2026-10-28", { professorId: gestor.id })).status).toBe(400); // não é professor
      await prisma.user.update({ where: { id: ctx.profB.id }, data: { ativo: false } });
      expect((await put("2026-10-28", { professorId: ctx.profB.id })).status).toBe(400); // inativo
      expect((await put("2026-10-28", { horarioInicio: "09:00", horarioFim: "11:00" }, "naoexiste")).status).toBe(404);
      expect(await prisma.aulaExcecao.count()).toBe(0);
    });

    it("rejects conflicts with the teacher's or the class's effective occurrences (409)", async () => {
      const ctx = await setup();
      const outraTurma = await prisma.turma.create({ data: { nome: "Outra", anoLetivo: 2026 } });
      // Prof A também dá aula na outra turma às quintas 09:00-11:00; a turma original tem aula de Prof B às quintas 13:00-14:00.
      await prisma.aula.create({
        data: { turmaId: outraTurma.id, disciplinaId: ctx.disciplina.id, professorId: ctx.profA.id, diaSemana: "QUINTA", horarioInicio: time("09:00"), horarioFim: time("11:00") }
      });
      await prisma.aula.create({
        data: { turmaId: ctx.turma.id, disciplinaId: ctx.disciplina.id, professorId: ctx.profB.id, diaSemana: "QUINTA", horarioInicio: time("13:00"), horarioFim: time("14:00") }
      });
      const put = (body: object) => request(app).put(url(ctx.aula.id, "2026-10-28")).set(asGestao()).send(body);

      const prof = await put({ data: "2026-10-29", horarioInicio: "08:00", horarioFim: "10:00" });
      expect(prof.status).toBe(409);
      expect(prof.body.conflitos[0].recurso).toBe("PROFESSOR");
      const turma = await put({ data: "2026-10-29", horarioInicio: "13:30", horarioFim: "15:00", professorId: ctx.profB.id });
      expect(turma.status).toBe(409);
      expect(turma.body.conflitos.map((c: { recurso: string }) => c.recurso)).toContain("TURMA");

      // Horário vizinho, sem sobreposição: ok.
      expect((await put({ data: "2026-10-29", horarioInicio: "11:00", horarioFim: "13:00" })).status).toBe(200);
    });

    it("counts other moved occurrences when checking conflicts", async () => {
      const ctx = await setup();
      await moverParaQuinta(ctx); // 28/10 -> quinta 29/10 14:00-16:00 com Prof B
      const outra = await prisma.aula.create({
        data: { turmaId: ctx.turma.id, disciplinaId: ctx.disciplina.id, professorId: ctx.profA.id, diaSemana: "SEXTA", horarioInicio: time("15:00"), horarioFim: time("16:00") }
      });
      // Mover a sexta 30/10 para quinta 29/10 15:00: a turma já está na aula movida (14:00-16:00).
      const res = await request(app).put(url(outra.id, "2026-10-30")).set(asGestao()).send({ data: "2026-10-29" });
      expect(res.status).toBe(409);
    });

    it("refuses to change an occurrence that already started (409)", async () => {
      const ctx = await setup();
      const put = () => request(app).put(url(ctx.aula.id, "2026-10-28")).set(asGestao()).send({ horarioInicio: "09:00", horarioFim: "11:00" });
      setNow(QUARTA_0830);
      const res = await put();
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Não é possível alterar uma aula que já aconteceu");
      setNow("2026-10-28T10:59:00Z"); // 07:59 SP, ainda não começou
      expect((await put()).status).toBe(200);
    });

    it("refuses to change an occurrence that already has attendance or an absence (409)", async () => {
      const ctx = await setup();
      const put = (data: string) => request(app).put(url(ctx.aula.id, data)).set(asGestao()).send({ horarioInicio: "09:00", horarioFim: "11:00" });
      await prisma.presenca.create({ data: { alunoId: ctx.alunos[0].id, aulaId: ctx.aula.id, data: day("2026-11-04"), presente: true, automatica: true } });
      expect((await put("2026-11-04")).status).toBe(409);
      await prisma.ausenciaAula.create({ data: { aulaId: ctx.aula.id, data: day("2026-11-11"), registradoPorId: ctx.profA.id } });
      const res = await put("2026-11-11");
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/falta/);
      expect((await put("2026-11-18")).status).toBe(200);
    });

    it("rejects editing a cancelled occurrence", async () => {
      const ctx = await setup();
      await cancelar(ctx);
      const res = await request(app).put(url(ctx.aula.id, "2026-10-28")).set(asGestao()).send({ horarioInicio: "09:00" });
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /schedule/:id/ocorrencias/:dataOriginal", () => {
    it("requires authentication and the GESTAO role", async () => {
      const ctx = await setup();
      expect((await request(app).delete(url(ctx.aula.id, "2026-10-28"))).status).toBe(401);
      expect((await request(app).delete(url(ctx.aula.id, "2026-10-28")).set(asTeacher(ctx.profA.id))).status).toBe(403);
    });

    it("cancels only that date and drops automatic attendance", async () => {
      const ctx = await setup();
      await prisma.presenca.create({ data: { alunoId: ctx.alunos[0].id, aulaId: ctx.aula.id, data: day("2026-10-28"), presente: true, automatica: true } });
      const res = await request(app).delete(url(ctx.aula.id, "2026-10-28")).set(asGestao());
      expect(res.status).toBe(204);
      expect(await prisma.presenca.count()).toBe(0);

      const weekly = await request(app).get("/schedule/weekly");
      expect(weekly.body[0].excecoes).toEqual([{ dataOriginal: "2026-10-28", cancelada: true, data: null, horarioInicio: null, horarioFim: null, professor: null }]);
      expect(await prisma.aula.count()).toBe(1);
    });

    it("refuses with 409 when the teacher already registered attendance", async () => {
      const ctx = await setup();
      await prisma.presenca.create({ data: { alunoId: ctx.alunos[0].id, aulaId: ctx.aula.id, data: day("2026-10-28"), presente: true, automatica: false } });
      const res = await request(app).delete(url(ctx.aula.id, "2026-10-28")).set(asGestao());
      expect(res.status).toBe(409);
      expect(await prisma.aulaExcecao.count()).toBe(0);
    });

    it("refuses to cancel an occurrence that already started (409)", async () => {
      const ctx = await setup();
      setNow(QUARTA_0830);
      const res = await request(app).delete(url(ctx.aula.id, "2026-10-28")).set(asGestao());
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Não é possível alterar uma aula que já aconteceu");
    });

    it("refuses with 409 when a substitute is confirmed, and removes pending ones with the absence", async () => {
      const ctx = await setup();
      const sub = await createUser({ email: "s2@oc.com", roles: ["PROFESSOR"] });
      const ausencia = (data: string) => prisma.ausenciaAula.create({ data: { aulaId: ctx.aula.id, data: day(data), registradoPorId: ctx.profA.id } });
      const aceita = await ausencia("2026-11-04");
      await prisma.substituicao.create({ data: { ausenciaId: aceita.id, substitutoId: sub.id, status: "ACEITA" } });
      const res = await request(app).delete(url(ctx.aula.id, "2026-11-04")).set(asGestao());
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Há um substituto confirmado para esta aula; cancele a substituição antes");
      expect(await prisma.ausenciaAula.count({ where: { id: aceita.id } })).toBe(1);

      const pendente = await ausencia("2026-11-11");
      await prisma.substituicao.create({ data: { ausenciaId: pendente.id, substitutoId: sub.id, status: "PENDENTE" } });
      expect((await request(app).delete(url(ctx.aula.id, "2026-11-11")).set(asGestao())).status).toBe(204);
      expect(await prisma.ausenciaAula.count({ where: { id: pendente.id } })).toBe(0);
      expect(await prisma.substituicao.count({ where: { ausenciaId: pendente.id } })).toBe(0);
    });

    it("rejects a date that is not part of the series with 400", async () => {
      const ctx = await setup();
      expect((await request(app).delete(url(ctx.aula.id, "2026-10-29")).set(asGestao())).status).toBe(400);
    });
  });

  describe("series edits", () => {
    it("keep the individually edited occurrence", async () => {
      const ctx = await setup();
      await request(app).put(url(ctx.aula.id, "2026-10-28")).set(asGestao()).send({ data: "2026-10-29", horarioInicio: "14:00", horarioFim: "16:00" });
      const serie = await request(app).put(`/schedule/${ctx.aula.id}`).send({ horarioInicio: "13:00", horarioFim: "14:30" });
      expect(serie.status).toBe(200);

      setNow(QUINTA_1500);
      const hoje = await request(app).get("/attendance/today").set(asTeacher(ctx.profA.id));
      expect(hoje.body).toHaveLength(1);
      expect(hoje.body[0].aula).toMatchObject({ horarioInicio: "14:00", horarioFim: "16:00" });

      setNow("2026-11-04T16:00:00Z"); // próxima quarta, 13:00 SP: série nova
      const proxima = await request(app).get("/attendance/today").set(asTeacher(ctx.profA.id));
      expect(proxima.body[0]).toMatchObject({ aula: { horarioInicio: "13:00", horarioFim: "14:30" }, alterada: false });
    });

    it("conflict with a moved occurrence of another lesson of the same teacher or class (409)", async () => {
      const ctx = await setup();
      const outraTurma = await prisma.turma.create({ data: { nome: "Outra", anoLetivo: 2026 } });
      // Aula do Prof B às sextas 08:00-09:00 (outra turma); a de 06/11 vai para quinta 12/11? Não: vai para quarta 04/11 14:00-15:00.
      const sexta = await prisma.aula.create({
        data: { turmaId: outraTurma.id, disciplinaId: ctx.disciplina.id, professorId: ctx.profB.id, diaSemana: "SEXTA", horarioInicio: time("08:00"), horarioFim: time("09:00") }
      });
      await prisma.aulaExcecao.create({
        data: { aulaId: sexta.id, dataOriginal: day("2026-11-06"), data: day("2026-11-04"), horarioInicio: time("14:00"), horarioFim: time("15:00"), professorId: ctx.profB.id }
      });
      const put = (body: object) => request(app).put(`/schedule/${ctx.aula.id}`).send(body);

      // Série (quartas) com o Prof B às 14:30 bateria com a ocorrência movida de 04/11.
      const res = await put({ professorId: ctx.profB.id, horarioInicio: "14:30", horarioFim: "15:30" });
      expect(res.status).toBe(409);
      expect(res.body.conflitos[0]).toMatchObject({ recurso: "PROFESSOR", data: "2026-11-04", origem: "OCORRENCIA_MOVIDA" });
      // Mesma turma: ocorrência movida de uma aula da turma da série.
      const mesmaTurma = await prisma.aula.create({
        data: { turmaId: ctx.turma.id, disciplinaId: ctx.disciplina.id, professorId: ctx.profB.id, diaSemana: "SEXTA", horarioInicio: time("10:00"), horarioFim: time("11:00") }
      });
      await prisma.aulaExcecao.create({
        data: { aulaId: mesmaTurma.id, dataOriginal: day("2026-11-06"), data: day("2026-11-11"), horarioInicio: time("16:00"), horarioFim: time("17:00"), professorId: ctx.profB.id }
      });
      const turma = await put({ horarioInicio: "16:30", horarioFim: "17:30" });
      expect(turma.status).toBe(409);
      expect(turma.body.conflitos.map((c: { recurso: string }) => c.recurso)).toContain("TURMA");
      // Horário livre: ok.
      expect((await put({ professorId: ctx.profB.id, horarioInicio: "12:00", horarioFim: "13:00" })).status).toBe(200);
    });

    it("removing the series removes its exceptions", async () => {
      const ctx = await setup();
      await moverParaQuinta(ctx);
      expect((await request(app).delete(`/schedule/${ctx.aula.id}`)).status).toBe(204);
      expect(await prisma.aulaExcecao.count()).toBe(0);
    });
  });

  describe("attendance on a moved occurrence", () => {
    it("shows it on the effective date, registers with the effective teacher and stores the original date", async () => {
      const ctx = await setup();
      await moverParaQuinta(ctx);
      const mark = (profId: string) =>
        request(app).post("/attendance/mark").set(asTeacher(profId)).send({ aulaId: ctx.aula.id, entries: ctx.alunos.map((a) => ({ alunoId: a.id, presente: false })) });

      // Na data original não há aula nem para o professor da série.
      setNow(QUARTA_0830);
      expect((await request(app).get("/attendance/today").set(asTeacher(ctx.profA.id))).body).toEqual([]);
      expect((await mark(ctx.profA.id)).status).toBe(409); // a aula não é hoje

      setNow(QUINTA_1500);
      const prof = (await request(app).get("/attendance/today").set(asTeacher(ctx.profB.id))).body;
      expect(prof).toHaveLength(1);
      expect(prof[0]).toMatchObject({
        aula: { id: ctx.aula.id, horarioInicio: "14:00", horarioFim: "16:00", professor: { id: ctx.profB.id, name: "Prof B" } },
        data: "2026-10-29",
        dataOriginal: "2026-10-28",
        alterada: true,
        status: "ABERTA",
        responsavel: true,
        podeRegistrar: true
      });
      const serie = (await request(app).get("/attendance/today").set(asTeacher(ctx.profA.id))).body[0];
      expect(serie).toMatchObject({ responsavel: false, podeRegistrar: false });

      expect((await mark(ctx.profA.id)).status).toBe(403);
      expect((await mark(ctx.profB.id)).status).toBe(201);
      const rows = await prisma.presenca.findMany({ where: { aulaId: ctx.aula.id, automatica: false } });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.data.toISOString().slice(0, 10) === "2026-10-28")).toBe(true);

      setNow(QUINTA_1700);
      expect((await mark(ctx.profB.id)).status).toBe(409);
    });

    it("lets the accepted substitute of the original date register on the effective date", async () => {
      const ctx = await setup();
      await moverParaQuinta(ctx);
      const sub = await createUser({ email: "s@oc.com", roles: ["PROFESSOR"] });
      const ausencia = await prisma.ausenciaAula.create({ data: { aulaId: ctx.aula.id, data: day("2026-10-28"), registradoPorId: ctx.profB.id } });
      await prisma.substituicao.create({ data: { ausenciaId: ausencia.id, substitutoId: sub.id, status: "ACEITA" } });
      setNow(QUINTA_1500);
      const res = await request(app).get("/attendance/today").set(asTeacher(sub.id));
      expect(res.body[0]).toMatchObject({ responsavel: true, podeRegistrar: true });
    });

    it("consolidates at the effective time, not at the original one", async () => {
      const ctx = await setup();
      await moverParaQuinta(ctx);
      const original = () => prisma.presenca.count({ where: { aulaId: ctx.aula.id, data: day("2026-10-28") } });

      setNow(QUARTA_1030); // depois do horário original, a ocorrência foi movida
      await request(app).get("/attendance");
      expect(await original()).toBe(0);

      setNow(QUINTA_1500); // dentro da janela efetiva
      await request(app).get("/attendance");
      expect(await original()).toBe(0);

      setNow(QUINTA_1601);
      await request(app).get("/attendance");
      expect(await original()).toBe(2);
      expect(await prisma.presenca.count({ where: { aulaId: ctx.aula.id, data: day("2026-10-29") } })).toBe(0);
    });

    it("appears in the dashboard on the effective date with the effective teacher", async () => {
      const ctx = await setup();
      await moverParaQuinta(ctx);
      setNow(QUARTA_0830);
      expect((await request(app).get("/dashboard/summary")).body.todayActivities).toEqual([]);
      setNow(QUINTA_1500);
      const { todayActivities, stats } = (await request(app).get("/dashboard/summary")).body;
      expect(stats.aulasHoje).toBe(1);
      expect(todayActivities[0]).toMatchObject({ teacher: "Prof B", time: "1970-01-01T14:00:00.000Z", endTime: "1970-01-01T16:00:00.000Z" });
    });
  });

  describe("cancelled occurrence", () => {
    it("is not consolidated and disappears from today's lessons and the dashboard", async () => {
      const ctx = await setup();
      await cancelar(ctx);

      setNow(QUARTA_0830);
      expect((await request(app).get("/attendance/today").set(asTeacher(ctx.profA.id))).body).toEqual([]);
      expect((await request(app).get("/dashboard/summary")).body.todayActivities).toEqual([]);
      const mark = await request(app)
        .post("/attendance/mark")
        .set(asTeacher(ctx.profA.id))
        .send({ aulaId: ctx.aula.id, entries: [{ alunoId: ctx.alunos[0].id, presente: true }] });
      expect(mark.status).toBe(409);
      expect(mark.body.message).toBe("Aula cancelada nesta data");

      setNow(QUINTA_1700);
      await request(app).get("/attendance");
      const datas = (await prisma.presenca.findMany({ where: { aulaId: ctx.aula.id }, distinct: ["data"] })).map((p) => p.data.toISOString().slice(0, 10)).sort();
      expect(datas).toEqual(["2026-10-07", "2026-10-14", "2026-10-21"]);
    });
  });

  describe("absences and substitutions on altered occurrences", () => {
    it("requires the effective teacher and refuses a cancelled occurrence", async () => {
      const ctx = await setup();
      await moverParaQuinta(ctx);
      await cancelar(ctx, "2026-11-04");
      setNow("2026-10-20T12:00:00Z");
      const post = (profId: string, data: string) => request(app).post("/absences").set(asTeacher(profId)).send({ aulaId: ctx.aula.id, data });

      expect((await post(ctx.profA.id, "2026-10-28")).status).toBe(403);
      expect((await post(ctx.profB.id, "2026-10-28")).status).toBe(201);
      expect((await post(ctx.profA.id, "2026-11-04")).status).toBe(409);
      expect((await post(ctx.profA.id, "2026-11-11")).status).toBe(201);
    });

    it("checks substitute conflicts against the effective schedule of that date", async () => {
      const ctx = await setup();
      const outraTurma = await prisma.turma.create({ data: { nome: "Outra", anoLetivo: 2026 } });
      const sub = await createUser({ email: "sub@oc.com", roles: ["PROFESSOR"] });
      // Substituto dá aula às quartas 15:00-16:00; só em 04/11 ela foi para 08:30-09:30 (choca com a aula de 08:00-10:00).
      const aulaSub = await prisma.aula.create({
        data: { turmaId: outraTurma.id, disciplinaId: ctx.disciplina.id, professorId: sub.id, diaSemana: "QUARTA", horarioInicio: time("15:00"), horarioFim: time("16:00") }
      });
      await prisma.aulaExcecao.create({
        data: { aulaId: aulaSub.id, dataOriginal: day("2026-11-04"), data: day("2026-11-04"), horarioInicio: time("08:30"), horarioFim: time("09:30"), professorId: sub.id }
      });
      setNow("2026-10-20T12:00:00Z");
      const ausenciaDe = (data: string) => prisma.ausenciaAula.create({ data: { aulaId: ctx.aula.id, data: day(data), registradoPorId: ctx.profA.id } });
      const conflito = await ausenciaDe("2026-11-04");
      const livre = await ausenciaDe("2026-11-11");

      const ids = async (ausenciaId: string) => ((await request(app).get(`/substitutions/candidates?ausenciaId=${ausenciaId}`).set(asGestao())).body as { id: string }[]).map((c) => c.id);
      expect(await ids(conflito.id)).not.toContain(sub.id);
      expect(await ids(livre.id)).toContain(sub.id);
      // O designador precisa existir (FK), então usa um gestor real em vez do token avulso.
      await createUser({ email: "gestor@oc.com", roles: ["GESTAO"] });
      const gestor = { Authorization: `Bearer ${await loginAs("gestor@oc.com")}` };
      const post = (ausenciaId: string) => request(app).post("/substitutions").set(gestor).send({ ausenciaId, substitutoId: sub.id });
      expect((await post(conflito.id)).status).toBe(409);
      expect((await post(livre.id)).status).toBe(201);
    });
  });
});
