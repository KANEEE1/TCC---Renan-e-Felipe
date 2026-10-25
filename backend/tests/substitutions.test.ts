import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { app, createUser, loginAs, resetDb } from "./helpers.js";

const DIAS = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

function nextDate(dia: string, minDias = 3) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDias);
  while (DIAS[d.getUTCDay()] !== dia) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function setup() {
  const p1 = await createUser({ email: "p1@test.com", roles: ["PROFESSOR"], name: "Prof Um" });
  const p2 = await createUser({ email: "p2@test.com", roles: ["PROFESSOR"], name: "Prof Dois" });
  const p3 = await createUser({ email: "p3@test.com", roles: ["PROFESSOR"], name: "Prof Tres" });
  const gestorUser = await createUser({ email: "gestor@test.com", roles: ["GESTAO"], name: "Gestor" });
  const tokens = {
    p1: await loginAs("p1@test.com"),
    p2: await loginAs("p2@test.com"),
    gestor: await loginAs("gestor@test.com")
  };
  const disciplina = await request(app).post("/disciplinas").send({ nome: "Química" });
  const mkAula = async (professorId: string, diaSemana: string, horarioInicio: string, horarioFim: string, nome: string) => {
    const turma = await request(app).post("/classes").send({ nome, anoLetivo: 2026 });
    const res = await request(app).post("/schedule").send({
      turmaId: turma.body.id,
      disciplinaId: disciplina.body.id,
      professorId,
      diaSemana,
      horarioInicio,
      horarioFim
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };
  const mkAusencia = async (token: string, aulaId: string, data: string) => {
    const res = await request(app).post("/absences").set(auth(token)).send({ aulaId, data });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };
  const data = nextDate("QUARTA");
  const aulaId = await mkAula(p1.id, "QUARTA", "08:00", "10:00", "T1");
  const ausenciaId = await mkAusencia(tokens.p1, aulaId, data);
  return { p1, p2, p3, gestorUser, tokens, disciplina, mkAula, mkAusencia, data, aulaId, ausenciaId };
}

const designar = (token: string, ausenciaId: string, substitutoId: string) =>
  request(app).post("/substitutions").set(auth(token)).send({ ausenciaId, substitutoId });

describe("substitutions", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates as GESTAO with designadoPorId and no substitute email", async () => {
    const s = await setup();
    const res = await designar(s.tokens.gestor, s.ausenciaId, s.p2.id);
    expect(res.status).toBe(201);
    expect(res.body.designadoPorId).toBe(s.gestorUser.id);
    expect(res.body.status).toBe("PENDENTE");
    expect(JSON.stringify(res.body)).not.toContain("email");
    expect(JSON.stringify(res.body)).not.toContain("@test.com");
  });

  it("forbids PROFESSOR and requires a token", async () => {
    const s = await setup();
    expect((await designar(s.tokens.p1, s.ausenciaId, s.p2.id)).status).toBe(403);
    expect((await request(app).post("/substitutions").send({})).status).toBe(401);
  });

  it("returns 404 for an unknown absence", async () => {
    const s = await setup();
    expect((await designar(s.tokens.gestor, "nao-existe", s.p2.id)).status).toBe(404);
  });

  it("rejects substitute equal to the titular, inactive, or not a teacher", async () => {
    const s = await setup();
    expect((await designar(s.tokens.gestor, s.ausenciaId, s.p1.id)).status).toBe(400);

    await prisma.user.update({ where: { id: s.p3.id }, data: { ativo: false } });
    expect((await designar(s.tokens.gestor, s.ausenciaId, s.p3.id)).status).toBe(400);

    expect((await designar(s.tokens.gestor, s.ausenciaId, s.gestorUser.id)).status).toBe(400);
  });

  it("rejects substitute with an overlapping own lesson on the same weekday, but not an adjacent one", async () => {
    const s = await setup();
    await s.mkAula(s.p2.id, "QUARTA", "09:00", "11:00", "T2");
    expect((await designar(s.tokens.gestor, s.ausenciaId, s.p2.id)).status).toBe(409);

    await s.mkAula(s.p3.id, "QUARTA", "10:00", "12:00", "T3");
    expect((await designar(s.tokens.gestor, s.ausenciaId, s.p3.id)).status).toBe(201);
  });

  it("rejects substitute already PENDENTE on another overlapping absence on the same date", async () => {
    const s = await setup();
    const aula2 = await s.mkAula(s.p3.id, "QUARTA", "09:00", "11:00", "T2");
    const ausencia2 = await s.mkAusencia(await loginAs("p3@test.com"), aula2, s.data);
    expect((await designar(s.tokens.gestor, s.ausenciaId, s.p2.id)).status).toBe(201);
    expect((await designar(s.tokens.gestor, ausencia2, s.p2.id)).status).toBe(409);
  });

  it("rejects an absence that already has a PENDENTE substitution", async () => {
    const s = await setup();
    expect((await designar(s.tokens.gestor, s.ausenciaId, s.p2.id)).status).toBe(201);
    expect((await designar(s.tokens.gestor, s.ausenciaId, s.p3.id)).status).toBe(409);
  });

  it("allows only one of two concurrent designations for the same absence", async () => {
    const s = await setup();
    const results = await Promise.all([
      designar(s.tokens.gestor, s.ausenciaId, s.p2.id),
      designar(s.tokens.gestor, s.ausenciaId, s.p3.id)
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.substituicao.count({ where: { ausenciaId: s.ausenciaId } })).toBe(1);
  });

  it("accepts a new designation of another teacher after RECUSADA", async () => {
    const s = await setup();
    const first = await designar(s.tokens.gestor, s.ausenciaId, s.p2.id);
    await prisma.substituicao.update({ where: { id: first.body.id }, data: { status: "RECUSADA", respondidaEm: new Date() } });
    expect((await designar(s.tokens.gestor, s.ausenciaId, s.p3.id)).status).toBe(201);
  });

  it("DELETE: 204 when PENDENTE, 409 when ACEITA, 404 when unknown", async () => {
    const s = await setup();
    const created = await designar(s.tokens.gestor, s.ausenciaId, s.p2.id);
    expect((await request(app).delete(`/substitutions/${created.body.id}`).set(auth(s.tokens.gestor))).status).toBe(204);
    expect(await prisma.substituicao.count()).toBe(0);

    const again = await designar(s.tokens.gestor, s.ausenciaId, s.p2.id);
    await prisma.substituicao.update({ where: { id: again.body.id }, data: { status: "ACEITA" } });
    expect((await request(app).delete(`/substitutions/${again.body.id}`).set(auth(s.tokens.gestor))).status).toBe(409);

    expect((await request(app).delete("/substitutions/nao-existe").set(auth(s.tokens.gestor))).status).toBe(404);
  });

  it("GET /absences includes substituicao", async () => {
    const s = await setup();
    const before = await request(app).get("/absences").set(auth(s.tokens.gestor));
    expect(before.body[0].substituicao).toBeNull();

    await designar(s.tokens.gestor, s.ausenciaId, s.p2.id);
    const after = await request(app).get("/absences").set(auth(s.tokens.gestor));
    expect(after.body[0].substituicao).toMatchObject({ status: "PENDENTE" });
  });

  it("DELETE /absences/:id is 409 with a PENDENTE substitution", async () => {
    const s = await setup();
    await designar(s.tokens.gestor, s.ausenciaId, s.p2.id);
    expect((await request(app).delete(`/absences/${s.ausenciaId}`).set(auth(s.tokens.p1))).status).toBe(409);
    expect(await prisma.ausenciaAula.count()).toBe(1);
  });

  it("DELETE /absences/:id with only RECUSADA is 204 and removes everything", async () => {
    const s = await setup();
    const created = await designar(s.tokens.gestor, s.ausenciaId, s.p2.id);
    await prisma.substituicao.update({ where: { id: created.body.id }, data: { status: "RECUSADA" } });
    expect((await request(app).delete(`/absences/${s.ausenciaId}`).set(auth(s.tokens.p1))).status).toBe(204);
    expect(await prisma.ausenciaAula.count()).toBe(0);
    expect(await prisma.substituicao.count()).toBe(0);
  });

  describe("GET /substitutions/candidates", () => {
    const candidates = (token: string, ausenciaId: string) =>
      request(app).get("/substitutions/candidates").query({ ausenciaId }).set(auth(token));
    const periodo = (data: string) => {
      const d = new Date(`${data}T00:00:00Z`);
      return `${d.getUTCFullYear()}-${d.getUTCMonth() < 6 ? 1 : 2}`;
    };
    const setDisciplinas = (id: string, disciplinaIds: string[]) =>
      request(app).put(`/teachers/${id}`).send({ disciplinaIds });
    const addDisp = (id: string, data: string, inicio = "07:00", fim = "12:00") =>
      request(app).post(`/teachers/${id}/availability`).send({
        periodoLetivo: periodo(data),
        diaSemana: "QUARTA",
        horarioInicio: inicio,
        horarioFim: fim
      });

    it("forbids PROFESSOR, 404 for unknown absence, 409 when PENDENTE exists", async () => {
      const s = await setup();
      expect((await candidates(s.tokens.p1, s.ausenciaId)).status).toBe(403);
      expect((await candidates(s.tokens.gestor, "nao-existe")).status).toBe(404);
      await designar(s.tokens.gestor, s.ausenciaId, s.p2.id);
      expect((await candidates(s.tokens.gestor, s.ausenciaId)).status).toBe(409);
    });

    it("excludes titular, inactive, overlapping and those who refused", async () => {
      const s = await setup();
      const p4 = await createUser({ email: "p4@test.com", roles: ["PROFESSOR"], name: "Prof Quatro" });
      const p5 = await createUser({ email: "p5@test.com", roles: ["PROFESSOR"], name: "Prof Cinco" });
      await prisma.user.update({ where: { id: s.p3.id }, data: { ativo: false } });
      await s.mkAula(p4.id, "QUARTA", "09:00", "11:00", "T4");
      const rec = await designar(s.tokens.gestor, s.ausenciaId, p5.id);
      await prisma.substituicao.update({ where: { id: rec.body.id }, data: { status: "RECUSADA" } });

      const res = await candidates(s.tokens.gestor, s.ausenciaId);
      expect(res.status).toBe(200);
      expect(res.body.map((c: { id: string }) => c.id)).toEqual([s.p2.id]);
    });

    it("sets lecionaDisciplina and disponivel flags, ranks teachers first and hides email", async () => {
      const s = await setup();
      await setDisciplinas(s.p3.id, [s.disciplina.body.id]);
      await addDisp(s.p2.id, s.data);
      await addDisp(s.p3.id, s.data, "09:00", "10:00");

      const res = await candidates(s.tokens.gestor, s.ausenciaId);
      expect(res.status).toBe(200);
      const byId = Object.fromEntries(res.body.map((c: { id: string }) => [c.id, c]));
      expect(byId[s.p3.id]).toMatchObject({ lecionaDisciplina: true, disponivel: false });
      expect(byId[s.p2.id]).toMatchObject({ lecionaDisciplina: false, disponivel: true });
      expect(res.body[0].id).toBe(s.p3.id);
      expect(JSON.stringify(res.body)).not.toContain("email");
      expect(JSON.stringify(res.body)).not.toContain("@test.com");
    });

    it("designating the first candidate returns 201", async () => {
      const s = await setup();
      await setDisciplinas(s.p3.id, [s.disciplina.body.id]);
      const res = await candidates(s.tokens.gestor, s.ausenciaId);
      expect(res.body.length).toBeGreaterThan(0);
      expect((await designar(s.tokens.gestor, s.ausenciaId, res.body[0].id)).status).toBe(201);
    });
  });
});
