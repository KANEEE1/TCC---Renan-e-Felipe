import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, createUser, resetDb } from "./helpers.js";

describe("disciplinas", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects duplicates ignoring case and extra spaces, and blank names", async () => {
    expect((await request(app).post("/disciplinas").send({ nome: "Matemática" })).status).toBe(201);
    expect((await request(app).post("/disciplinas").send({ nome: "  matemática " })).status).toBe(409);
    expect((await request(app).post("/disciplinas").send({ nome: "   " })).status).toBe(400);
  });

  it("renames and deletes", async () => {
    const created = await request(app).post("/disciplinas").send({ nome: "Fisica" });
    const other = await request(app).post("/disciplinas").send({ nome: "Química" });

    expect((await request(app).put(`/disciplinas/${created.body.id}`).send({ nome: "Química" })).status).toBe(409);
    const renamed = await request(app).put(`/disciplinas/${created.body.id}`).send({ nome: "Física" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.nome).toBe("Física");
    expect((await request(app).put("/disciplinas/naoexiste").send({ nome: "X" })).status).toBe(404);

    expect((await request(app).delete(`/disciplinas/${other.body.id}`)).status).toBe(204);
    expect((await request(app).delete(`/disciplinas/${other.body.id}`)).status).toBe(404);
  });

  it("blocks deleting a discipline used by a teacher or a class matrix", async () => {
    const disciplina = await request(app).post("/disciplinas").send({ nome: "Biologia" });
    await request(app)
      .post("/teachers")
      .send({ name: "Prof", email: "prof.disc@test.com", password: "senha1234", disciplinaIds: [disciplina.body.id] });
    const comProfessor = await request(app).delete(`/disciplinas/${disciplina.body.id}`);
    expect(comProfessor.status).toBe(409);

    const usada = await request(app).post("/disciplinas").send({ nome: "História" });
    await request(app)
      .post("/classes")
      .send({ nome: "T", anoLetivo: 2026, disciplinas: [{ disciplinaId: usada.body.id, aulasPorSemana: 2, duracaoMinutos: 90 }] });
    const res = await request(app).delete(`/disciplinas/${usada.body.id}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Disciplina em uso");
  });

  it("creates in batch, deduplicating and ignoring existing", async () => {
    await request(app).post("/disciplinas").send({ nome: "Português" });
    const res = await request(app)
      .post("/disciplinas/lote")
      .send({ nomes: ["português", "Física", "física ", "Química"] });
    expect(res.status).toBe(201);
    expect(res.body.criadas.map((d: { nome: string }) => d.nome)).toEqual(["Física", "Química"]);
    expect(res.body.ignoradas).toEqual(["português"]);

    expect((await request(app).post("/disciplinas/lote").send({ nomes: [] })).status).toBe(400);
  });
});

describe("class curriculum matrix", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates the matrix resolving by id and by name (creating the discipline)", async () => {
    const mat = await request(app).post("/disciplinas").send({ nome: "Matemática" });
    const res = await request(app)
      .post("/classes")
      .send({
        nome: "Extensivo",
        anoLetivo: 2026,
        disciplinas: [
          { nome: "  física ", aulasPorSemana: 2, duracaoMinutos: 90 },
          { disciplinaId: mat.body.id, aulasPorSemana: 4, duracaoMinutos: 120 },
          { nome: "matemática", aulasPorSemana: 1, duracaoMinutos: 60 }
        ]
      });
    expect(res.status).toBe(400);

    const ok = await request(app)
      .post("/classes")
      .send({
        nome: "Extensivo",
        anoLetivo: 2026,
        disciplinas: [
          { nome: "Física", aulasPorSemana: 2, duracaoMinutos: 90 },
          { disciplinaId: mat.body.id, aulasPorSemana: 4, duracaoMinutos: 120 }
        ]
      });
    expect(ok.status).toBe(201);
    expect(ok.body.cargas.map((c: { disciplina: { nome: string } }) => c.disciplina.nome)).toEqual(["Física", "Matemática"]);

    const got = await request(app).get(`/classes/${ok.body.id}`);
    expect(got.body.cargas[1]).toMatchObject({ aulasPorSemana: 4, duracaoMinutos: 120, disciplina: { id: mat.body.id } });
  });

  it("update: undefined keeps, [] clears, list replaces", async () => {
    const mat = await request(app).post("/disciplinas").send({ nome: "Matemática" });
    const turma = await request(app)
      .post("/classes")
      .send({ nome: "T", anoLetivo: 2026, disciplinas: [{ disciplinaId: mat.body.id, aulasPorSemana: 3, duracaoMinutos: 60 }] });

    const kept = await request(app).put(`/classes/${turma.body.id}`).send({ sala: "1" });
    expect(kept.body.cargas).toHaveLength(1);

    const replaced = await request(app)
      .put(`/classes/${turma.body.id}`)
      .send({ disciplinas: [{ disciplinaId: mat.body.id, aulasPorSemana: 5, duracaoMinutos: 100 }] });
    expect(replaced.body.cargas[0]).toMatchObject({ aulasPorSemana: 5, duracaoMinutos: 100 });

    const cleared = await request(app).put(`/classes/${turma.body.id}`).send({ disciplinas: [] });
    expect(cleared.body.cargas).toHaveLength(0);
  });

  it("validates rows", async () => {
    const base = { nome: "T", anoLetivo: 2026 };
    const post = (disciplinas: unknown[]) => request(app).post("/classes").send({ ...base, disciplinas });
    expect((await post([{ aulasPorSemana: 1, duracaoMinutos: 60 }])).status).toBe(400);
    expect((await post([{ nome: "X", aulasPorSemana: 0, duracaoMinutos: 60 }])).status).toBe(400);
    expect((await post([{ nome: "X", aulasPorSemana: 1, duracaoMinutos: 62 }])).status).toBe(400);
    expect((await post([{ disciplinaId: "ckxxxxxxxxxxxxxxxxxxxxxxx", aulasPorSemana: 1, duracaoMinutos: 60 }])).status).toBe(400);
    expect(((await request(app).get("/classes")).body)).toHaveLength(0);
  });
});

describe("class curriculum matrix (extra)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  const post = (disciplinas: unknown[]) => request(app).post("/classes").send({ nome: "T", anoLetivo: 2026, disciplinas });

  it("reuses an existing discipline when the name differs only by case/spaces", async () => {
    const mat = await request(app).post("/disciplinas").send({ nome: "Matemática" });
    const res = await post([{ nome: "  MATEMÁTICA ", aulasPorSemana: 2, duracaoMinutos: 60 }]);
    expect(res.status).toBe(201);
    expect(res.body.cargas[0].disciplina.id).toBe(mat.body.id);
    expect((await request(app).get("/disciplinas")).body).toHaveLength(1);
  });

  it("rejects the same discipline twice (by id and by name) with 400", async () => {
    const mat = await request(app).post("/disciplinas").send({ nome: "Matemática" });
    const res = await post([
      { disciplinaId: mat.body.id, aulasPorSemana: 2, duracaoMinutos: 60 },
      { nome: "matemática", aulasPorSemana: 1, duracaoMinutos: 60 }
    ]);
    expect(res.status).toBe(400);
  });

  it("GET /classes and /classes/:id return cargas with disciplina {id,nome}", async () => {
    const mat = await request(app).post("/disciplinas").send({ nome: "Matemática" });
    const turma = await post([{ disciplinaId: mat.body.id, aulasPorSemana: 2, duracaoMinutos: 60 }]);
    const expected = [{ aulasPorSemana: 2, duracaoMinutos: 60, disciplina: { id: mat.body.id, nome: "Matemática" } }];

    const one = await request(app).get(`/classes/${turma.body.id}`);
    expect(one.body.cargas).toMatchObject(expected);
    const list = await request(app).get("/classes");
    expect(list.body[0].cargas).toMatchObject(expected);
  });

  it("returns 409 when deleting a discipline used in a matrix", async () => {
    const mat = await request(app).post("/disciplinas").send({ nome: "Matemática" });
    await post([{ disciplinaId: mat.body.id, aulasPorSemana: 2, duracaoMinutos: 60 }]);
    expect((await request(app).delete(`/disciplinas/${mat.body.id}`)).status).toBe(409);
  });
});

describe("class curriculum matrix and existing lessons", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("changing the matrix keeps the lessons already in the schedule", async () => {
    const professor = await createUser({ email: "prof@test.com", roles: ["PROFESSOR"] });
    const turma = await request(app)
      .post("/classes")
      .send({ nome: "Turma Matriz", anoLetivo: 2026, disciplinas: [{ nome: "Física", aulasPorSemana: 2, duracaoMinutos: 90 }] });
    expect(turma.status).toBe(201);
    const disciplinaId = turma.body.cargas[0].disciplina.id as string;

    const aula = await request(app).post("/schedule").send({
      turmaId: turma.body.id,
      disciplinaId,
      professorId: professor.id,
      diaSemana: "SEGUNDA",
      horarioInicio: "08:00",
      horarioFim: "09:30"
    });
    expect(aula.status).toBe(201);

    expect((await request(app).put(`/classes/${turma.body.id}`).send({ disciplinas: [] })).status).toBe(200);

    const schedule = await request(app).get("/schedule");
    expect(schedule.body.map((item: { id: string }) => item.id)).toContain(aula.body.id);
  });
});
