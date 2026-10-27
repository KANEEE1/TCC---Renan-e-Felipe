import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, createUser, resetDb, asTeacher, loginAs } from "./helpers.js";

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
    await createUser({ name: "Gestor", email: "gestor@test.com", roles: ["GESTAO"] });
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

  it("lists deactivated teachers after the active ones", async () => {
    const inativo = await request(app).post("/teachers").send({ name: "Ana", email: "ana@test.com", password: "senha1234" });
    const ativo = await request(app).post("/teachers").send({ name: "Bruno", email: "bruno@test.com", password: "senha1234" });
    await request(app).put(`/teachers/${inativo.body.id}`).send({ ativo: false });

    const list = await request(app).get("/teachers");
    expect(list.body.map((t: { id: string }) => t.id)).toEqual([ativo.body.id, inativo.body.id]);
  });

  it("adds availability for a teacher and lists it", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "prof3@test.com", password: "senha1234" });

    const created = await request(app)
      .post(`/teachers/${teacher.body.id}/availability`).set(asTeacher(teacher.body.id))
      .send({ diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00", periodoLetivo: "2026-1" });
    expect(created.status).toBe(201);

    const list = await request(app).get(`/teachers/${teacher.body.id}/availability`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("rejects availability where end time is before start time", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "prof4@test.com", password: "senha1234" });

    const res = await request(app)
      .post(`/teachers/${teacher.body.id}/availability`).set(asTeacher(teacher.body.id))
      .send({ diaSemana: "SEGUNDA", horarioInicio: "10:00", horarioFim: "08:00", periodoLetivo: "2026-1" });

    expect(res.status).toBe(400);
  });

  it("updates an availability slot", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "prof5@test.com", password: "senha1234" });
    const slot = await request(app)
      .post(`/teachers/${teacher.body.id}/availability`).set(asTeacher(teacher.body.id))
      .send({ diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00", periodoLetivo: "2026-1" });

    const res = await request(app)
      .put(`/teachers/${teacher.body.id}/availability/${slot.body.id}`).set(asTeacher(teacher.body.id))
      .send({ diaSemana: "TERCA", horarioFim: "11:00" });

    expect(res.status).toBe(200);
    expect(res.body.diaSemana).toBe("TERCA");
    expect(res.body.horarioFim).toContain("11:00");
  });

  it("rejects an update that makes the end time before the existing start time", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "prof6@test.com", password: "senha1234" });
    const slot = await request(app)
      .post(`/teachers/${teacher.body.id}/availability`).set(asTeacher(teacher.body.id))
      .send({ diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00", periodoLetivo: "2026-1" });

    const res = await request(app)
      .put(`/teachers/${teacher.body.id}/availability/${slot.body.id}`).set(asTeacher(teacher.body.id))
      .send({ horarioFim: "07:00" });

    expect(res.status).toBe(400);
  });

  it("removes an availability slot", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "prof7@test.com", password: "senha1234" });
    const slot = await request(app)
      .post(`/teachers/${teacher.body.id}/availability`).set(asTeacher(teacher.body.id))
      .send({ diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00", periodoLetivo: "2026-1" });

    const res = await request(app).delete(`/teachers/${teacher.body.id}/availability/${slot.body.id}`).set(asTeacher(teacher.body.id));
    expect(res.status).toBe(204);

    const list = await request(app).get(`/teachers/${teacher.body.id}/availability`);
    expect(list.body).toHaveLength(0);
  });

  it("does not let one teacher's route touch another teacher's slot", async () => {
    const owner = await request(app).post("/teachers").send({ name: "Dono", email: "dono@test.com", password: "senha1234" });
    const other = await request(app).post("/teachers").send({ name: "Outro", email: "outro@test.com", password: "senha1234" });
    const slot = await request(app)
      .post(`/teachers/${owner.body.id}/availability`).set(asTeacher(owner.body.id))
      .send({ diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00", periodoLetivo: "2026-1" });

    const res = await request(app).delete(`/teachers/${other.body.id}/availability/${slot.body.id}`).set(asTeacher(other.body.id));
    expect(res.status).toBe(404);

    const list = await request(app).get(`/teachers/${owner.body.id}/availability`);
    expect(list.body).toHaveLength(1);
  });

  it("only the teacher can change their own availability", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "dono@test.com", password: "senha1234" });
    await createUser({ email: "gestao@test.com", roles: ["GESTAO"] });
    const gestao = await loginAs("gestao@test.com");
    const body = { diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00", periodoLetivo: "2026-1" };
    const url = `/teachers/${teacher.body.id}/availability`;

    expect((await request(app).post(url).send(body)).status).toBe(401);
    expect((await request(app).post(url).set({ Authorization: `Bearer ${gestao}` }).send(body)).status).toBe(403);
    expect((await request(app).post("/disponibilidade").set({ Authorization: `Bearer ${gestao}` }).send({ ...body, professorId: teacher.body.id })).status).toBe(403);

    const slot = await request(app).post(url).set(asTeacher(teacher.body.id)).send(body);
    expect(slot.status).toBe(201);
    expect((await request(app).delete(`${url}/${slot.body.id}`).set({ Authorization: `Bearer ${gestao}` })).status).toBe(403);
    expect((await request(app).delete(`/disponibilidade/${slot.body.id}`).set({ Authorization: `Bearer ${gestao}` })).status).toBe(404);
    expect((await request(app).get(url).set({ Authorization: `Bearer ${gestao}` })).body).toHaveLength(1);
  });

  it("returns 409 for a duplicate availability slot", async () => {
    const teacher = await request(app).post("/teachers").send({ name: "Prof", email: "prof8@test.com", password: "senha1234" });
    const body = { diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00", periodoLetivo: "2026-1" };

    await request(app).post(`/teachers/${teacher.body.id}/availability`).set(asTeacher(teacher.body.id)).send(body);
    const dup = await request(app).post(`/teachers/${teacher.body.id}/availability`).set(asTeacher(teacher.body.id)).send(body);

    expect(dup.status).toBe(409);
  });

  it("returns 404 when deleting an unknown availability slot", async () => {
    const res = await request(app).delete("/disponibilidade/nonexistent-id").set(asTeacher("qualquer-professor"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for an unknown teacher", async () => {
    const res = await request(app).get("/teachers/nonexistent-id");
    expect(res.status).toBe(404);
  });
});
