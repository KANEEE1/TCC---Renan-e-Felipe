import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, resetDb, asTeacher } from "./helpers.js";

async function setupLessonDeps() {
  const disciplina = await request(app).post("/disciplinas").send({ nome: "Física" });
  const turma = await request(app).post("/classes").send({
    nome: "Turma Sched",
    anoLetivo: 2026,
    disciplinas: [{ disciplinaId: disciplina.body.id, aulasPorSemana: 2, duracaoMinutos: 120 }]
  });
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
    expect(Object.keys(weekly.body[0].professor).sort()).toEqual(["id", "name"]);

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

    expect(conflict.status).toBe(409);
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

  async function addAvailability(professorId: string, diaSemana: string, horarioInicio: string, horarioFim: string, periodoLetivo = "2026-1") {
    const res = await request(app)
      .post(`/teachers/${professorId}/availability`).set(asTeacher(professorId))
      .send({ diaSemana, horarioInicio, horarioFim, periodoLetivo });
    expect(res.status).toBe(201);
  }

  it("suggest does not persist anything and respects periodoLetivo", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    await addAvailability(professorId, "SEGUNDA", "08:00", "12:00", "2026-1");
    const pedidos = [{ professorId, disciplinaId, turmaId, quantidade: 2 }];

    const res = await request(app).post("/schedule/suggest").send({ periodoLetivo: "2026-1", pedidos });
    expect(res.status).toBe(200);
    expect(res.body.propostas).toHaveLength(2);
    expect(res.body.naoAlocados).toHaveLength(0);

    const other = await request(app).post("/schedule/suggest").send({ periodoLetivo: "2026-2", pedidos });
    expect(other.body.propostas).toHaveLength(0);
    expect(other.body.naoAlocados[0].motivo).toBe("SEM_DISPONIBILIDADE");

    const weekly = await request(app).get("/schedule/weekly");
    expect(weekly.body).toHaveLength(0);
  });

  it("suggest uses the class matrix duration and rejects requests without a matrix entry", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    await request(app).put(`/classes/${turmaId}`).send({ disciplinas: [{ disciplinaId, aulasPorSemana: 2, duracaoMinutos: 60 }] });
    await addAvailability(professorId, "SEGUNDA", "08:00", "10:00");

    const res = await request(app)
      .post("/schedule/suggest")
      .send({ periodoLetivo: "2026-1", pedidos: [{ professorId, disciplinaId, turmaId, quantidade: 2 }] });
    expect(res.status).toBe(200);
    expect(res.body.propostas.map((p: { horarioInicio: string; horarioFim: string }) => [p.horarioInicio, p.horarioFim])).toEqual([
      ["08:00", "09:00"],
      ["09:00", "10:00"]
    ]);

    await request(app).put(`/classes/${turmaId}`).send({ disciplinas: [] });
    const semCarga = await request(app)
      .post("/schedule/suggest")
      .send({ periodoLetivo: "2026-1", pedidos: [{ professorId, disciplinaId, turmaId, quantidade: 2 }] });
    expect(semCarga.status).toBe(400);
    expect(semCarga.body.semCarga).toEqual([{ turmaId, disciplinaId }]);
  });

  it("suggest uses 90-minute matrix duration for horarioFim", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    await request(app).put(`/classes/${turmaId}`).send({ disciplinas: [{ disciplinaId, aulasPorSemana: 1, duracaoMinutos: 90 }] });
    await addAvailability(professorId, "SEGUNDA", "08:00", "12:00");

    const res = await request(app)
      .post("/schedule/suggest")
      .send({ periodoLetivo: "2026-1", pedidos: [{ professorId, disciplinaId, turmaId, quantidade: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.propostas[0]).toMatchObject({ horarioInicio: "08:00", horarioFim: "09:30" });
  });

  it("suggest reports JANELA_INSUFICIENTE when duration exceeds the availability window", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    await request(app).put(`/classes/${turmaId}`).send({ disciplinas: [{ disciplinaId, aulasPorSemana: 1, duracaoMinutos: 120 }] });
    await addAvailability(professorId, "SEGUNDA", "08:00", "09:00");

    const res = await request(app)
      .post("/schedule/suggest")
      .send({ periodoLetivo: "2026-1", pedidos: [{ professorId, disciplinaId, turmaId, quantidade: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.propostas).toHaveLength(0);
    expect(res.body.naoAlocados[0].motivo).toBe("JANELA_INSUFICIENTE");
  });

  it("confirm persists the batch", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    const base = { turmaId, disciplinaId, professorId, diaSemana: "SEGUNDA" };

    const res = await request(app).post("/schedule/confirm").send({
      aulas: [
        { ...base, horarioInicio: "08:00", horarioFim: "10:00" },
        { ...base, horarioInicio: "10:00", horarioFim: "12:00" }
      ]
    });
    expect(res.status).toBe(201);

    const weekly = await request(app).get("/schedule/weekly");
    expect(weekly.body).toHaveLength(2);
  });

  it("confirm with one conflict returns 409 and saves nothing", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    const base = { turmaId, disciplinaId, professorId, diaSemana: "SEGUNDA" };
    await request(app).post("/schedule").send({ ...base, horarioInicio: "10:00", horarioFim: "12:00" });

    const res = await request(app).post("/schedule/confirm").send({
      aulas: [
        { ...base, diaSemana: "TERCA", horarioInicio: "08:00", horarioFim: "10:00" },
        { ...base, horarioInicio: "11:00", horarioFim: "13:00" }
      ]
    });
    expect(res.status).toBe(409);
    expect(res.body.conflitos.length).toBeGreaterThan(0);

    const weekly = await request(app).get("/schedule/weekly");
    expect(weekly.body).toHaveLength(1);
  });

  it("confirm rejects a batch whose own lessons overlap", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    const base = { turmaId, disciplinaId, professorId, diaSemana: "QUARTA" };

    const res = await request(app).post("/schedule/confirm").send({
      aulas: [
        { ...base, horarioInicio: "08:00", horarioFim: "10:00" },
        { ...base, horarioInicio: "09:00", horarioFim: "11:00" }
      ]
    });
    expect(res.status).toBe(409);

    const weekly = await request(app).get("/schedule/weekly");
    expect(weekly.body).toHaveLength(0);
  });

  it("suggest rejects quantidade 0 with 400", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    const res = await request(app)
      .post("/schedule/suggest")
      .send({ periodoLetivo: "2026-1", pedidos: [{ professorId, disciplinaId, turmaId, quantidade: 0 }] });
    expect(res.status).toBe(400);
  });

  it("rejects partial overlap for the same teacher with 409", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    const otherTurma = await request(app).post("/classes").send({ nome: "Outra", anoLetivo: 2026 });
    const base = { disciplinaId, professorId, diaSemana: "SEGUNDA" };

    await request(app).post("/schedule").send({ ...base, turmaId, horarioInicio: "08:00", horarioFim: "10:00" });
    const res = await request(app).post("/schedule").send({ ...base, turmaId: otherTurma.body.id, horarioInicio: "09:00", horarioFim: "11:00" });
    expect(res.status).toBe(409);
  });

  it("PUT without changing time does not conflict with itself", async () => {
    const { turmaId, disciplinaId, professorId } = await setupLessonDeps();
    const created = await request(app)
      .post("/schedule")
      .send({ turmaId, disciplinaId, professorId, diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "10:00" });

    const res = await request(app)
      .put(`/schedule/${created.body.id}`)
      .send({ horarioInicio: "08:00", horarioFim: "10:00", sala: "1" });
    expect(res.status).toBe(200);
  });
});
