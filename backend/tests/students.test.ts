import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, resetDb, asGestao, asTeacher } from "./helpers.js";

describe("students", () => {
  let turmaId: string;

  beforeEach(async () => {
    await resetDb();
    turmaId = (await request(app).post("/classes").set(asGestao()).send({ nome: "Extensivo", anoLetivo: 2026, turmaId })).body.id;
  });

  it("creates and lists a student", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Ana Beatriz Santos", numero: "01", turmaId });
    expect(created.status).toBe(201);

    const list = await request(app).get("/students");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].nome).toBe("Ana Beatriz Santos");
  });

  it("rejects duplicate email", async () => {
    await request(app).post("/students").set(asGestao()).send({ nome: "Aluno 1", email: "aluno@test.com", turmaId });
    const dup = await request(app).post("/students").set(asGestao()).send({ nome: "Aluno 2", email: "aluno@test.com", turmaId });

    expect(dup.status).toBe(409);
  });

  it("fetches a student by id", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Bruno Costa", turmaId });

    const res = await request(app).get(`/students/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe("Bruno Costa");
  });

  it("returns 404 for an unknown student id", async () => {
    const res = await request(app).get("/students/nonexistent-id");
    expect(res.status).toBe(404);
  });

  it("updates a student", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Carla Silva", turmaId });

    const res = await request(app).put(`/students/${created.body.id}`).set(asGestao()).send({ telefone: "(11) 99999-0000" });

    expect(res.status).toBe(200);
    expect(res.body.telefone).toBe("(11) 99999-0000");
  });

  it("rejects creating a student without a name", async () => {
    const res = await request(app).post("/students").set(asGestao()).send({ turmaId });
    expect(res.status).toBe(400);
  });

  it("creates the student already enrolled in the class, and requires an existing class", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Dora Lima" });
    expect(created.status).toBe(400);
    const missing = await request(app).post("/students").set(asGestao()).send({ nome: "Dora Lima", turmaId: "inexistente" });
    expect(missing.status).toBe(400);
    expect((await request(app).get("/students")).body).toHaveLength(0);

    const ok = await request(app).post("/students").set(asGestao()).send({ nome: "Dora Lima", turmaId });
    expect(ok.status).toBe(201);
    const aluno = await request(app).get(`/students/${ok.body.id}`);
    expect(aluno.body.matriculas.map((m: { turma: { id: string } }) => m.turma.id)).toEqual([turmaId]);
  });

  it("only GESTAO creates or edits students", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Aluno Teste", turmaId });
    expect(created.status).toBe(201);
    const professor = asTeacher("professor-qualquer");

    expect((await request(app).post("/students").send({ nome: "Sem login", turmaId })).status).toBe(401);
    expect((await request(app).post("/students").set(professor).send({ nome: "Professor", turmaId })).status).toBe(403);
    expect((await request(app).put(`/students/${created.body.id}`).set(professor).send({ nome: "Outro" })).status).toBe(403);
    expect((await request(app).get(`/students/${created.body.id}`)).status).toBe(200);
  });
});
