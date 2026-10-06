import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, resetDb } from "./helpers.js";

describe("teachers", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("registers a teacher with subjects and hashes the password", async () => {
    const subject = await request(app).post("/disciplinas").send({ nome: "Matemática" });

    const res = await request(app).post("/teachers").send({
      name: "Ana Silva",
      email: "ana@test.com",
      celular: "(11) 98765-4321",
      password: "senha1234",
      disciplinaIds: [subject.body.id]
    });

    expect(res.status).toBe(201);
    expect(res.body.roles).toEqual(["PROFESSOR"]);
    expect(res.body.disciplinas).toHaveLength(1);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("only lists users with the PROFESSOR role", async () => {
    await request(app).post("/users").send({ name: "Gestor", email: "gestor@test.com", password: "senha1234", roles: ["GESTAO"] });
    await request(app).post("/teachers").send({ name: "Prof", email: "prof@test.com", password: "senha1234" });

    const list = await request(app).get("/teachers");

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].email).toBe("prof@test.com");
  });

  it("deactivates a teacher via PUT", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "prof2@test.com", password: "senha1234" });

    const res = await request(app).put(`/teachers/${teacher.body.id}`).send({ ativo: false });

    expect(res.status).toBe(200);
    expect(res.body.ativo).toBe(false);
  });

  it("adds availability for a teacher and lists it", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "prof3@test.com", password: "senha1234" });

    const created = await request(app)
      .post(`/teachers/${teacher.body.id}/availability`)
      .send({ diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00", periodoLetivo: "2026-1" });
    expect(created.status).toBe(201);

    const list = await request(app).get(`/teachers/${teacher.body.id}/availability`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("rejects availability where end time is before start time", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "prof4@test.com", password: "senha1234" });

    const res = await request(app)
      .post(`/teachers/${teacher.body.id}/availability`)
      .send({ diaSemana: "SEGUNDA", horarioInicio: "10:00", horarioFim: "08:00", periodoLetivo: "2026-1" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown teacher", async () => {
    const res = await request(app).get("/teachers/nonexistent-id");
    expect(res.status).toBe(404);
  });
});
