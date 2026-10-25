import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildClassPerformance, type ClassPerformanceNota } from "../src/modules/notas/notas.service.js";
import { app, resetDb } from "./helpers.js";

const nota = (valor: number, aluno: string, sim: string, disc: { id: string; nome: string } | null, data = "2026-01-01"): ClassPerformanceNota => ({
  valor,
  aluno: { id: aluno, nome: aluno },
  simulado: { id: sim, nome: sim, data: new Date(data), disciplinaId: disc?.id ?? null, disciplina: disc }
});
const mat = { id: "m", nome: "Matemática" };
const fis = { id: "f", nome: "Física" };

describe("buildClassPerformance", () => {
  it("computes overall, per-subject and per-exam averages", () => {
    const r = buildClassPerformance(
      [nota(8, "A", "s1", mat, "2026-01-01"), nota(6, "B", "s1", mat, "2026-01-01"), nota(4, "A", "s2", fis, "2026-02-01")],
      6,
      "t1"
    );
    expect(r.turmaId).toBe("t1");
    expect(r.totalNotas).toBe(3);
    expect(r.mediaGeral).toBe(6);
    expect(r.porDisciplina).toEqual([
      { disciplinaId: "f", nome: "Física", media: 4, totalNotas: 1 },
      { disciplinaId: "m", nome: "Matemática", media: 7, totalNotas: 2 }
    ]);
    expect(r.porSimulado.map((s) => [s.simuladoId, s.media])).toEqual([["s2", 4], ["s1", 7]]);
    expect(r.piorDisciplina).toEqual({ disciplinaId: "f", nome: "Física", media: 4 });
  });

  it("handles a class with no grades", () => {
    const r = buildClassPerformance([], 6);
    expect(r.mediaGeral).toBeNull();
    expect(r.porDisciplina).toEqual([]);
    expect(r.porSimulado).toEqual([]);
    expect(r.alunosAbaixoDoLimite).toEqual([]);
    expect(r.piorDisciplina).toBeNull();
  });

  it("groups exams without subject as 'Sem disciplina' and never as worst subject", () => {
    const r = buildClassPerformance([nota(1, "A", "s1", null), nota(9, "A", "s2", mat)], 6);
    expect(r.porDisciplina[0]).toMatchObject({ disciplinaId: null, nome: "Sem disciplina", media: 1 });
    expect(r.piorDisciplina?.disciplinaId).toBe("m");
  });

  it("has no worst subject when only subject-less exams exist", () => {
    expect(buildClassPerformance([nota(1, "A", "s1", null)], 6).piorDisciplina).toBeNull();
  });

  it("excludes students whose average equals the threshold", () => {
    const r = buildClassPerformance([nota(6, "Igual", "s1", mat), nota(5.99, "Abaixo", "s1", mat)], 6);
    expect(r.alunosAbaixoDoLimite.map((a) => a.nome)).toEqual(["Abaixo"]);
  });

  it("breaks worst-subject ties by name", () => {
    const r = buildClassPerformance([nota(5, "A", "s1", mat), nota(5, "A", "s2", fis)], 6);
    expect(r.piorDisciplina?.nome).toBe("Física");
  });
});

describe("GET /grades/class-summary/:turmaId", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("only counts grades from students enrolled in the class", async () => {
    const turma = await request(app).post("/classes").send({ nome: "Turma Desempenho", anoLetivo: 2026 });
    const disc = await request(app).post("/disciplinas").send({ nome: "Química" });
    const exam = await request(app).post("/simulados").send({ nome: "Sim 1", data: "2026-10-01", disciplinaId: disc.body.id });
    const dentro = await request(app).post("/students").send({ nome: "Dentro" });
    const fora = await request(app).post("/students").send({ nome: "Fora" });
    await request(app).post(`/classes/${turma.body.id}/students`).send({ studentIds: [dentro.body.id] });
    await request(app).post("/grades").send({ alunoId: dentro.body.id, simuladoId: exam.body.id, valor: 4 });
    await request(app).post("/grades").send({ alunoId: fora.body.id, simuladoId: exam.body.id, valor: 10 });

    const res = await request(app).get(`/grades/class-summary/${turma.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.totalNotas).toBe(1);
    expect(res.body.mediaGeral).toBe(4);
    expect(res.body.limite).toBe(6);
    expect(res.body.alunosAbaixoDoLimite.map((a: { nome: string }) => a.nome)).toEqual(["Dentro"]);
  });

  it("treats an empty threshold as the default", async () => {
    const turma = await request(app).post("/classes").send({ nome: "Turma Vazia", anoLetivo: 2026 });
    const res = await request(app).get(`/grades/class-summary/${turma.body.id}?limite=`);
    expect(res.status).toBe(200);
    expect(res.body.limite).toBe(6);
  });

  it("rejects an invalid threshold", async () => {
    const turma = await request(app).post("/classes").send({ nome: "Turma Lim", anoLetivo: 2026 });
    const res = await request(app).get(`/grades/class-summary/${turma.body.id}?limite=11`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown class", async () => {
    const res = await request(app).get("/grades/class-summary/inexistente");
    expect(res.status).toBe(404);
  });
});
