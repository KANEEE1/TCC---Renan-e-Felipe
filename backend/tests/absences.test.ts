import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, createUser, loginAs, resetDb } from "./helpers.js";

const DIAS = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// Retorna a proxima data (>= hoje + minDias) cujo dia da semana e `dia`, como YYYY-MM-DD.
function nextDate(dia: string, minDias = 3) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDias);
  while (DIAS[d.getUTCDay()] !== dia) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function setup() {
  const p1 = await createUser({ email: "p1@test.com", roles: ["PROFESSOR"], name: "Prof Um" });
  await createUser({ email: "p2@test.com", roles: ["PROFESSOR"], name: "Prof Dois" });
  await createUser({ email: "gestor@test.com", roles: ["GESTAO"], name: "Gestor" });
  const tokens = {
    p1: await loginAs("p1@test.com"),
    p2: await loginAs("p2@test.com"),
    gestor: await loginAs("gestor@test.com")
  };
  const turma = await request(app).post("/classes").send({ nome: "Turma Aus", anoLetivo: 2026 });
  const disciplina = await request(app).post("/disciplinas").send({ nome: "Química" });
  const aula = await request(app).post("/schedule").send({
    turmaId: turma.body.id,
    disciplinaId: disciplina.body.id,
    professorId: p1.id,
    diaSemana: "QUARTA",
    horarioInicio: "08:00",
    horarioFim: "10:00"
  });
  expect(aula.status).toBe(201);
  return { p1, tokens, aulaId: aula.body.id as string, data: nextDate("QUARTA") };
}

describe("absences", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("requires a token", async () => {
    expect((await request(app).get("/absences")).status).toBe(401);
    expect((await request(app).post("/absences").send({})).status).toBe(401);
  });

  it("lets the lesson's teacher register an absence", async () => {
    const { p1, tokens, aulaId, data } = await setup();
    const res = await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId, data, motivo: "Consulta" });
    expect(res.status).toBe(201);
    expect(res.body.registradoPorId).toBe(p1.id);
  });

  it("forbids another teacher", async () => {
    const { tokens, aulaId, data } = await setup();
    expect((await request(app).post("/absences").set(auth(tokens.p2)).send({ aulaId, data })).status).toBe(403);
  });

  it("returns 404 for an unknown lesson", async () => {
    const { tokens, data } = await setup();
    expect((await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId: "nao-existe", data })).status).toBe(404);
  });

  it("rejects past dates and wrong weekday", async () => {
    const { tokens, aulaId, data } = await setup();
    const past = new Date();
    past.setUTCDate(past.getUTCDate() - 14);
    while (DIAS[past.getUTCDay()] !== "QUARTA") past.setUTCDate(past.getUTCDate() - 1);
    const pastRes = await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId, data: past.toISOString().slice(0, 10) });
    expect(pastRes.status).toBe(400);

    const wrong = await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId, data: nextDate("QUINTA") });
    expect(wrong.status).toBe(400);
    expect(data).toBeTruthy();
  });

  it("rejects a nonexistent calendar date", async () => {
    const { tokens, aulaId } = await setup();
    const res = await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId, data: "2099-02-30" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate absence", async () => {
    const { tokens, aulaId, data } = await setup();
    await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId, data });
    expect((await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId, data })).status).toBe(409);
  });

  it("lists only own absences for teachers, all for GESTAO, without emails", async () => {
    const { tokens, aulaId, data } = await setup();
    await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId, data });

    const mine = await request(app).get("/absences").set(auth(tokens.p1));
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    const other = await request(app).get("/absences").set(auth(tokens.p2));
    expect(other.body).toHaveLength(0);
    const all = await request(app).get("/absences").set(auth(tokens.gestor));
    expect(all.body).toHaveLength(1);
    expect(JSON.stringify(all.body)).not.toContain("@test.com");
    expect(JSON.stringify(all.body)).not.toContain("email");
  });

  it("filters by de/ate and rejects de > ate", async () => {
    const { tokens, aulaId, data } = await setup();
    await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId, data });

    const inside = await request(app).get(`/absences?de=${data}&ate=${data}`).set(auth(tokens.p1));
    expect(inside.body).toHaveLength(1);
    const outside = await request(app).get(`/absences?de=${nextDate("QUINTA", 60)}`).set(auth(tokens.p1));
    expect(outside.body).toHaveLength(0);
    expect((await request(app).get(`/absences?de=2030-02-01&ate=2030-01-01`).set(auth(tokens.p1))).status).toBe(400);
  });

  it("deletes by the registrant and by GESTAO, but hides from other teachers", async () => {
    const { tokens, aulaId } = await setup();
    const mk = async (data: string) =>
      (await request(app).post("/absences").set(auth(tokens.p1)).send({ aulaId, data })).body.id as string;
    const a = await mk(nextDate("QUARTA"));
    const b = await mk(nextDate("QUARTA", 12));

    expect((await request(app).delete(`/absences/${a}`).set(auth(tokens.p2))).status).toBe(404);
    expect((await request(app).delete(`/absences/${a}`).set(auth(tokens.p1))).status).toBe(204);
    expect((await request(app).delete(`/absences/${b}`).set(auth(tokens.gestor))).status).toBe(204);
  });
});
