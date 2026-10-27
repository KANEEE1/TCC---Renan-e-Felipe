import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, resetDb } from "./helpers.js";

describe("classes", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates and lists a class", async () => {
    const created = await request(app).post("/classes").send({ nome: "Extensivo - Manhã", anoLetivo: 2026 });
    expect(created.status).toBe(201);

    const list = await request(app).get("/classes");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("saves and returns the grade period as YYYY-MM-DD", async () => {
    const base = { nome: "Turma P", anoLetivo: 2026 };
    const created = await request(app).post("/classes").send({ ...base, gradeInicio: "2026-08-03", gradeFim: "2026-12-18" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ gradeInicio: "2026-08-03", gradeFim: "2026-12-18" });

    const got = await request(app).get(`/classes/${created.body.id}`);
    expect(got.body).toMatchObject({ gradeInicio: "2026-08-03", gradeFim: "2026-12-18" });
    const list = await request(app).get("/classes");
    expect(list.body[0]).toMatchObject({ gradeInicio: "2026-08-03", gradeFim: "2026-12-18" });

    const upd = await request(app).put(`/classes/${created.body.id}`).send({ gradeFim: "2026-12-20" });
    expect(upd.status).toBe(200);
    expect(upd.body).toMatchObject({ gradeInicio: "2026-08-03", gradeFim: "2026-12-20" });

    const none = await request(app).post("/classes").send({ nome: "Sem período", anoLetivo: 2026 });
    expect(none.body).toMatchObject({ gradeInicio: null, gradeFim: null });
  });

  it("a PUT with only the period keeps the shift and the curriculum matrix", async () => {
    const created = await request(app)
      .post("/classes")
      .send({ nome: "Turma M", anoLetivo: 2026, turno: "Manhã", disciplinas: [{ nome: "Física", aulasPorSemana: 2, duracaoMinutos: 90 }] });
    expect(created.status).toBe(201);

    const upd = await request(app).put(`/classes/${created.body.id}`).send({ gradeInicio: "2026-02-02", gradeFim: "2026-06-30" });
    expect(upd.status).toBe(200);
    expect(upd.body).toMatchObject({ turno: "Manhã", gradeInicio: "2026-02-02", gradeFim: "2026-06-30" });
    expect(upd.body.cargas).toEqual([expect.objectContaining({ aulasPorSemana: 2, duracaoMinutos: 90 })]);
  });

  it("validates the grade period", async () => {
    const base = { nome: "Turma V", anoLetivo: 2026 };
    const post = (extra: object) => request(app).post("/classes").send({ ...base, ...extra });
    expect((await post({ gradeInicio: "2026-08-03" })).status).toBe(400);
    expect((await post({ gradeFim: "2026-08-03" })).status).toBe(400);
    expect((await post({ gradeInicio: "2026-12-18", gradeFim: "2026-08-03" })).status).toBe(400);
    expect((await post({ gradeInicio: "2026-02-30", gradeFim: "2026-08-03" })).status).toBe(400);
    expect((await post({ gradeInicio: "abc", gradeFim: "2026-08-03" })).status).toBe(400);
    expect(await request(app).get("/classes").then((r) => r.body)).toHaveLength(0);

    const ok = await post({ gradeInicio: "2026-08-03", gradeFim: "2026-12-18" });
    const bad = await request(app).put(`/classes/${ok.body.id}`).send({ gradeFim: "2026-01-01" });
    expect(bad.status).toBe(400);
  });

  it("rejects a duplicate nome+anoLetivo combination", async () => {
    await request(app).post("/classes").send({ nome: "Turma A", anoLetivo: 2026 });
    const dup = await request(app).post("/classes").send({ nome: "Turma A", anoLetivo: 2026 });

    expect(dup.status).toBe(409);
  });

  it("updates a class", async () => {
    const created = await request(app).post("/classes").send({ nome: "Turma B", anoLetivo: 2026 });

    const res = await request(app).put(`/classes/${created.body.id}`).send({ sala: "201", capacidade: 50 });

    expect(res.status).toBe(200);
    expect(res.body.sala).toBe("201");
    expect(res.body.capacidade).toBe(50);
  });

  it("returns 404 when assigning students to an unknown class", async () => {
    const student = await request(app).post("/students").send({ nome: "Aluno Teste" });

    const res = await request(app)
      .post("/classes/nonexistent-id/students")
      .send({ studentIds: [student.body.id] });

    expect(res.status).toBe(404);
  });

  it("assigns students to a class and is idempotent on repeat", async () => {
    const turma = await request(app).post("/classes").send({ nome: "Turma C", anoLetivo: 2026 });
    const aluno = await request(app).post("/students").send({ nome: "Aluno Assign" });

    const first = await request(app)
      .post(`/classes/${turma.body.id}/students`)
      .send({ studentIds: [aluno.body.id] });
    expect(first.status).toBe(201);
    expect(first.body).toHaveLength(1);

    const second = await request(app)
      .post(`/classes/${turma.body.id}/students`)
      .send({ studentIds: [aluno.body.id] });
    expect(second.status).toBe(201);
    expect(second.body).toHaveLength(1);

    const classWithRoster = await request(app).get(`/classes/${turma.body.id}`);
    expect(classWithRoster.body.matriculas).toHaveLength(1);
  });
});
