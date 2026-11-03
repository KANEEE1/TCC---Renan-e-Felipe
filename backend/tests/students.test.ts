import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, resetDb, asGestao, asTeacher } from "./helpers.js";

describe("students", () => {
  let turmaId: string;

  beforeEach(async () => {
    await resetDb();
    turmaId = (await request(app).post("/classes").set(asGestao()).send({ nome: "Extensivo", anoLetivo: 2026, turmaId })).body.id;
  });

  it("creates and lists a student", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Ana Beatriz Santos", numero: "01", turmaId });
    expect(created.status).toBe(201);

    const list = await request(app).get("/students");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].nome).toBe("Ana Beatriz Santos");
  });

  it("rejects duplicate email", async () => {
    await request(app).post("/students").set(asGestao()).send({ nome: "Aluno 1", email: "aluno@test.com", turmaId });
    const dup = await request(app).post("/students").set(asGestao()).send({ nome: "Aluno 2", email: "aluno@test.com", turmaId });

    expect(dup.status).toBe(409);
  });

  it("fetches a student by id", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Bruno Costa", turmaId });

    const res = await request(app).get(`/students/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe("Bruno Costa");
  });

  it("returns 404 for an unknown student id", async () => {
    const res = await request(app).get("/students/nonexistent-id");
    expect(res.status).toBe(404);
  });

  it("updates a student", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Carla Silva", turmaId });

    const res = await request(app).put(`/students/${created.body.id}`).set(asGestao()).send({ telefone: "(11) 99999-0000" });

    expect(res.status).toBe(200);
    expect(res.body.telefone).toBe("(11) 99999-0000");
  });

  it("rejects creating a student without a name", async () => {
    const res = await request(app).post("/students").set(asGestao()).send({ turmaId });
    expect(res.status).toBe(400);
  });

  it("creates the student already enrolled in the class, and requires an existing class", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Dora Lima" });
    expect(created.status).toBe(400);
    const missing = await request(app).post("/students").set(asGestao()).send({ nome: "Dora Lima", turmaId: "inexistente" });
    expect(missing.status).toBe(400);
    expect((await request(app).get("/students")).body).toHaveLength(0);

    const ok = await request(app).post("/students").set(asGestao()).send({ nome: "Dora Lima", turmaId });
    expect(ok.status).toBe(201);
    const aluno = await request(app).get(`/students/${ok.body.id}`);
    expect(aluno.body.matriculas.map((m: { turma: { id: string } }) => m.turma.id)).toEqual([turmaId]);
  });

  it("only GESTAO creates or edits students", async () => {
    const created = await request(app).post("/students").set(asGestao()).send({ nome: "Aluno Teste", turmaId });
    expect(created.status).toBe(201);
    const professor = asTeacher("professor-qualquer");

    expect((await request(app).post("/students").send({ nome: "Sem login", turmaId })).status).toBe(401);
    expect((await request(app).post("/students").set(professor).send({ nome: "Professor", turmaId })).status).toBe(403);
    expect((await request(app).put(`/students/${created.body.id}`).set(professor).send({ nome: "Outro" })).status).toBe(403);
    expect((await request(app).get(`/students/${created.body.id}`)).status).toBe(200);
  });

  describe("DELETE /students/:id (exclusão lógica)", () => {
    it("only GESTAO deletes, 404 for unknown and idempotent", async () => {
      const created = await request(app).post("/students").set(asGestao()).send({ nome: "Eli Souza", turmaId });
      const url = `/students/${created.body.id}`;

      expect((await request(app).delete(url)).status).toBe(401);
      expect((await request(app).delete(url).set(asTeacher("professor-qualquer"))).status).toBe(403);
      expect((await request(app).delete("/students/inexistente").set(asGestao())).status).toBe(404);

      expect((await request(app).delete(url).set(asGestao())).status).toBe(204);
      const removidoEm = (await request(app).get(url)).body.removidoEm;
      expect(removidoEm).not.toBeNull();
      // De novo: continua 204 e mantém a data da primeira remoção.
      expect((await request(app).delete(url).set(asGestao())).status).toBe(204);
      expect((await request(app).get(url)).body.removidoEm).toBe(removidoEm);
    });

    it("leaves the list, the class and the indicators; the student page still loads", async () => {
      const fica = await request(app).post("/students").set(asGestao()).send({ nome: "Fábio", turmaId });
      const sai = await request(app).post("/students").set(asGestao()).send({ nome: "Gil", turmaId });
      await request(app).delete(`/students/${sai.body.id}`).set(asGestao());

      expect((await request(app).get("/students")).body.map((a: { id: string }) => a.id)).toEqual([fica.body.id]);
      const turma = await request(app).get(`/classes/${turmaId}`);
      expect(turma.body.matriculas.map((m: { aluno: { id: string } }) => m.aluno.id)).toEqual([fica.body.id]);
      const indicadores = await request(app).get("/classes/indicadores").set(asGestao());
      expect(indicadores.body.find((r: { turmaId: string }) => r.turmaId === turmaId).alunos).toBe(1);

      const pagina = await request(app).get(`/students/${sai.body.id}`);
      expect(pagina.status).toBe(200);
      expect(pagina.body).toMatchObject({ nome: "Gil", removidoEm: expect.any(String) });
    });

    it("frees cpf and email for a new registration and blocks editing or enrolling the removed student", async () => {
      const dados = { nome: "Hugo", numero: "07", email: "hugo@test.com", cpf: "123.456.789-00", turmaId };
      const antigo = await request(app).post("/students").set(asGestao()).send(dados);
      await request(app).delete(`/students/${antigo.body.id}`).set(asGestao());
      expect((await request(app).get(`/students/${antigo.body.id}`)).body).toMatchObject({ nome: "Hugo", numero: "07", email: null, cpf: null });
      expect((await request(app).post("/students").set(asGestao()).send(dados)).status).toBe(201);

      const editar = await request(app).put(`/students/${antigo.body.id}`).set(asGestao()).send({ nome: "Outro" });
      expect(editar.status).toBe(409);
      expect(editar.body.message).toBe("Aluno removido");
      const outra = (await request(app).post("/classes").set(asGestao()).send({ nome: "Intensivo", anoLetivo: 2026 })).body.id;
      expect((await request(app).post(`/classes/${outra}/students`).set(asGestao()).send({ studentIds: [antigo.body.id] })).status).toBe(409);
      expect((await request(app).post("/matriculas").set(asGestao()).send({ alunoId: antigo.body.id, turmaId: outra })).status).toBe(409);
    });
  });
});
