import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildAttendanceSummary } from "../src/modules/presenca/presenca.service.js";
import { app, resetDb } from "./helpers.js";

const T1 = { id: "t1", nome: "Turma 1" };
const T2 = { id: "t2", nome: "Turma 2" };
const mat = (alunoId: string, nome: string, turma = T1) => ({ alunoId, aluno: { nome }, turma });
const pres = (alunoId: string, presente: boolean, n = 1) => Array.from({ length: n }, () => ({ alunoId, presente }));

describe("buildAttendanceSummary", () => {
  it("computes 100% and 0%", () => {
    const { items } = buildAttendanceSummary(
      [mat("a", "Ana"), mat("b", "Bia")],
      [...pres("a", true, 4), ...pres("b", false, 4)],
      75
    );
    const a = items.find((i) => i.alunoId === "a")!;
    const b = items.find((i) => i.alunoId === "b")!;
    expect(a).toMatchObject({ percentual: 100, abaixoDoLimite: false, faltas: 0 });
    expect(b).toMatchObject({ percentual: 0, abaixoDoLimite: true, presencas: 0, faltas: 4 });
  });

  it("does not flag a student exactly at the limit", () => {
    const { items } = buildAttendanceSummary([mat("a", "Ana")], [...pres("a", true, 3), ...pres("a", false, 1)], 75);
    expect(items[0].percentual).toBe(75);
    expect(items[0].abaixoDoLimite).toBe(false);
  });

  it("flags a student whose real percentage is below the limit even if it rounds to it", () => {
    const { items } = buildAttendanceSummary([mat("a", "Ana")], [...pres("a", true, 1874), ...pres("a", false, 626)], 75);
    expect(items[0].percentual).toBe(75);
    expect(items[0].abaixoDoLimite).toBe(true);
  });

  it("handles students without records", () => {
    const { items } = buildAttendanceSummary([mat("a", "Ana")], [], 75);
    expect(items[0]).toMatchObject({ percentual: null, semRegistros: true, abaixoDoLimite: false, totalRegistros: 0 });
  });

  it("sorts by percentual, nulls last, ties by name", () => {
    const { items } = buildAttendanceSummary(
      [mat("n", "Zed"), mat("c", "Carla"), mat("a", "Ana"), mat("l", "Low"), mat("m", "Abel")],
      [...pres("c", true), ...pres("a", true), ...pres("l", false)],
      75
    );
    expect(items.map((i) => i.nome)).toEqual(["Low", "Ana", "Carla", "Abel", "Zed"]);
  });

  it("merges a student in two classes into one row", () => {
    const { items } = buildAttendanceSummary([mat("a", "Ana", T1), mat("a", "Ana", T2)], pres("a", true, 2), 75);
    expect(items).toHaveLength(1);
    expect(items[0].turmas).toEqual([T1, T2]);
    expect(items[0].totalRegistros).toBe(2);
  });
});

describe("GET /attendance/summary", () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setupClass(nome: string, email: string, dia: string) {
    const turma = await request(app).post("/classes").send({ nome, anoLetivo: 2026 });
    const disciplina = await request(app).post("/disciplinas").send({ nome: `Disc ${nome}` });
    const teacher = await request(app).post("/teachers").send({ name: `Prof ${nome}`, email, password: "senha1234" });
    const aula = await request(app).post("/schedule").send({
      turmaId: turma.body.id, disciplinaId: disciplina.body.id, professorId: teacher.body.id,
      diaSemana: dia, horarioInicio: "08:00", horarioFim: "10:00"
    });
    return { turmaId: turma.body.id as string, aulaId: aula.body.id as string };
  }

  it("filters by turmaId counting only that class's lessons", async () => {
    const c1 = await setupClass("A", "a@sum.com", "SEGUNDA");
    const c2 = await setupClass("B", "b@sum.com", "TERCA");
    const aluno = await request(app).post("/students").send({ nome: "Aluno Sum" });
    const id = aluno.body.id;
    await request(app).post(`/classes/${c1.turmaId}/students`).send({ studentIds: [id] });
    await request(app).post(`/classes/${c2.turmaId}/students`).send({ studentIds: [id] });
    await request(app).post("/attendance/mark").send({ aulaId: c1.aulaId, data: "2026-09-01", entries: [{ alunoId: id, presente: true }] });
    await request(app).post("/attendance/mark").send({ aulaId: c2.aulaId, data: "2026-09-01", entries: [{ alunoId: id, presente: false }] });

    const filtered = await request(app).get(`/attendance/summary?turmaId=${c1.turmaId}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.limite).toBe(75);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0]).toMatchObject({ totalRegistros: 1, presencas: 1, percentual: 100 });

    const all = await request(app).get("/attendance/summary");
    expect(all.body.items).toHaveLength(1);
    expect(all.body.items[0]).toMatchObject({ totalRegistros: 2, percentual: 50, abaixoDoLimite: true });
    expect(all.body.items[0].turmas).toHaveLength(2);
  });

  it("treats an empty limite as the default", async () => {
    const res = await request(app).get("/attendance/summary?limite=");
    expect(res.status).toBe(200);
    expect(res.body.limite).toBe(75);
  });

  it("rejects an invalid limite with 400", async () => {
    const res = await request(app).get("/attendance/summary?limite=150");
    expect(res.status).toBe(400);
  });

  it("returns empty items for an unknown turmaId", async () => {
    const res = await request(app).get("/attendance/summary?turmaId=nao-existe");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});
