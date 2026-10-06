import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, resetDb } from "./helpers.js";

async function setupLesson() {
  const turma = await request(app).post("/classes").send({ nome: "Turma Att", anoLetivo: 2026 });
  const disciplina = await request(app).post("/disciplinas").send({ nome: "Química" });
  const teacher = await request(app).post("/teachers").send({ name: "Prof Att", email: "prof.att@test.com", password: "senha1234" });
  const lesson = await request(app).post("/schedule").send({
    turmaId: turma.body.id,
    disciplinaId: disciplina.body.id,
    professorId: teacher.body.id,
    diaSemana: "QUARTA",
    horarioInicio: "08:00",
    horarioFim: "10:00"
  });

  return { turmaId: turma.body.id, aulaId: lesson.body.id };
}

describe("attendance", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("marks attendance for multiple students in one call", async () => {
    const { turmaId, aulaId } = await setupLesson();
    const s1 = await request(app).post("/students").send({ nome: "Aluno 1" });
    const s2 = await request(app).post("/students").send({ nome: "Aluno 2" });

    const res = await request(app).post("/attendance/mark").send({
      aulaId,
      data: "2026-09-30",
      entries: [
        { alunoId: s1.body.id, presente: true },
        { alunoId: s2.body.id, presente: false }
      ]
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);

    const byClass = await request(app).get(`/attendance/by-class/${turmaId}`);
    expect(byClass.body).toHaveLength(2);
  });

  it("is idempotent when re-marking the same student/lesson/date", async () => {
    const { aulaId } = await setupLesson();
    const student = await request(app).post("/students").send({ nome: "Aluno Repeat" });

    await request(app).post("/attendance/mark").send({
      aulaId,
      data: "2026-09-30",
      entries: [{ alunoId: student.body.id, presente: true }]
    });

    const second = await request(app).post("/attendance/mark").send({
      aulaId,
      data: "2026-09-30",
      entries: [{ alunoId: student.body.id, presente: false }]
    });

    expect(second.status).toBe(201);

    const report = await request(app).get(`/attendance/report/${student.body.id}`);
    expect(report.body.totalClasses).toBe(1);
    expect(report.body.present).toBe(0);
  });

  it("computes an attendance report with the correct percentage", async () => {
    const { aulaId } = await setupLesson();
    const student = await request(app).post("/students").send({ nome: "Aluno Report" });

    await request(app).post("/attendance/mark").send({ aulaId, data: "2026-09-01", entries: [{ alunoId: student.body.id, presente: true }] });
    await request(app).post("/attendance/mark").send({ aulaId, data: "2026-09-02", entries: [{ alunoId: student.body.id, presente: false }] });

    const res = await request(app).get(`/attendance/report/${student.body.id}`);

    expect(res.body.totalClasses).toBe(2);
    expect(res.body.present).toBe(1);
    expect(res.body.absent).toBe(1);
    expect(res.body.percentage).toBe(50);
  });

  it("returns a zeroed report for a student with no attendance history", async () => {
    const student = await request(app).post("/students").send({ nome: "Aluno Sem Historico" });

    const res = await request(app).get(`/attendance/report/${student.body.id}`);

    expect(res.body).toEqual({ totalClasses: 0, present: 0, absent: 0, percentage: 0, history: [] });
  });
});
