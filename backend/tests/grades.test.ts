import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, resetDb } from "./helpers.js";

describe("grades", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates a mock exam with a subject and a grade for a student", async () => {
    const subject = await request(app).post("/disciplinas").send({ nome: "Matemática" });
    const exam = await request(app).post("/simulados").send({ nome: "Simulado ENEM 1", data: "2026-10-01", disciplinaId: subject.body.id });
    expect(exam.status).toBe(201);

    const student = await request(app).post("/students").send({ nome: "Aluno Grades" });
    const grade = await request(app).post("/grades").send({
      alunoId: student.body.id,
      simuladoId: exam.body.id,
      valor: 8.5,
      observacoes: "Bom desempenho"
    });

    expect(grade.status).toBe(201);
    expect(grade.body.valor).toBe(8.5);
    expect(grade.body.observacoes).toBe("Bom desempenho");
  });

  it("includes the linked subject and grades when listing exams", async () => {
    const subject = await request(app).post("/disciplinas").send({ nome: "Física" });
    const exam = await request(app).post("/simulados").send({ nome: "Simulado Física", data: "2026-10-02", disciplinaId: subject.body.id });
    const student = await request(app).post("/students").send({ nome: "Aluno" });
    await request(app).post("/grades").send({ alunoId: student.body.id, simuladoId: exam.body.id, valor: 7 });

    const list = await request(app).get("/simulados");

    expect(list.body).toHaveLength(1);
    expect(list.body[0].disciplina.nome).toBe("Física");
    expect(list.body[0].notas).toHaveLength(1);
  });

  it("rejects a second grade for the same student on the same exam", async () => {
    const exam = await request(app).post("/simulados").send({ nome: "Simulado Único", data: "2026-10-03" });
    const student = await request(app).post("/students").send({ nome: "Aluno Dup" });

    await request(app).post("/grades").send({ alunoId: student.body.id, simuladoId: exam.body.id, valor: 6 });
    const dup = await request(app).post("/grades").send({ alunoId: student.body.id, simuladoId: exam.body.id, valor: 9 });

    expect(dup.status).toBe(500);
  });

  it("rejects a negative grade", async () => {
    const exam = await request(app).post("/simulados").send({ nome: "Simulado Neg", data: "2026-10-04" });
    const student = await request(app).post("/students").send({ nome: "Aluno Neg" });

    const res = await request(app).post("/grades").send({ alunoId: student.body.id, simuladoId: exam.body.id, valor: -1 });

    expect(res.status).toBe(400);
  });
});
