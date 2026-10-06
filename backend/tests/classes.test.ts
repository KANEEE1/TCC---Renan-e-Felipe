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

  it("rejects a duplicate nome+anoLetivo combination", async () => {
    await request(app).post("/classes").send({ nome: "Turma A", anoLetivo: 2026 });
    const dup = await request(app).post("/classes").send({ nome: "Turma A", anoLetivo: 2026 });

    expect(dup.status).toBe(500);
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
