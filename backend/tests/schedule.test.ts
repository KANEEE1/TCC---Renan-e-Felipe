import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, resetDb } from "./helpers.js";

async function setupLessonDeps() {
  const turma = await request(app).post("/classes").send({ nome: "Turma Sched", anoLetivo: 2026 });
  const disciplina = await request(app).post("/disciplinas").send({ nome: "Física" });
  const teacher = await request(app).post("/teachers").send({ name: "Prof Sched", email: "prof.sched@test.com", password: "senha1234" });

  return { turmaId: turma.body.id, disciplinaId: disciplina.body.id, professorId: teacher.body.id };
}

describe("schedule", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates a lesson and lists it in weekly and by-class views", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();

    const created = await request(app).post("/schedule").send({
      turmaId,
      disciplinaId,
      professorId,
      diaSemana: "SEGUNDA",
      horarioInicio: "08:00",
      horarioFim: "10:00"
    });
    expect(created.status).toBe(201);

    const weekly = await request(app).get("/schedule/weekly");
    expect(weekly.body).toHaveLength(1);

    const byClass = await request(app).get(`/schedule/by-class/${turmaId}`);
    expect(byClass.body).toHaveLength(1);
  });

  it("rejects a lesson where end time is before start time", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();

    const res = await request(app).post("/schedule").send({
      turmaId,
      disciplinaId,
      professorId,
      diaSemana: "SEGUNDA",
      horarioInicio: "10:00",
      horarioFim: "08:00"
    });

    expect(res.status).toBe(400);
  });

  it("rejects double-booking the same class at the same time", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    const otherTeacher = await request(app).post("/teachers").send({ name: "Prof B", email: "profb.sched@test.com", password: "senha1234" });

    await request(app).post("/schedule").send({
      turmaId,
      disciplinaId,
      professorId,
      diaSemana: "SEGUNDA",
      horarioInicio: "08:00",
      horarioFim: "10:00"
    });

    const conflict = await request(app).post("/schedule").send({
      turmaId,
      disciplinaId,
      professorId: otherTeacher.body.id,
      diaSemana: "SEGUNDA",
      horarioInicio: "08:00",
      horarioFim: "10:00"
    });

    expect(conflict.status).toBe(500);
  });

  it("updates and deletes a lesson", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();

    const created = await request(app).post("/schedule").send({
      turmaId,
      disciplinaId,
      professorId,
      diaSemana: "TERCA",
      horarioInicio: "08:00",
      horarioFim: "10:00"
    });

    const updated = await request(app).put(`/schedule/${created.body.id}`).send({ sala: "305" });
    expect(updated.status).toBe(200);
    expect(updated.body.sala).toBe("305");

    const deleted = await request(app).delete(`/schedule/${created.body.id}`);
    expect(deleted.status).toBe(204);

    const list = await request(app).get("/schedule/weekly");
    expect(list.body).toHaveLength(0);
  });
});
