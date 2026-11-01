import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { app, createUser, loginAs, resetDb } from "./helpers.js";

const payload = { titulo: "Evento", tipo: "REUNIAO", data: "2026-11-10", horarioInicio: "14:00", horarioFim: "16:00", semProfessores: true };

async function setup() {
  const gestor = await createUser({ email: "gestor@test.com", roles: ["GESTAO"], name: "Gestor" });
  const p1 = await createUser({ email: "p1@test.com", roles: ["PROFESSOR"], name: "Prof Um" });
  const p2 = await createUser({ email: "p2@test.com", roles: ["PROFESSOR"], name: "Prof Dois" });
  const tokens = {
    gestor: await loginAs("gestor@test.com"),
    p1: await loginAs("p1@test.com"),
    p2: await loginAs("p2@test.com")
  };
  return { gestor, p1, p2, tokens };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const statusOf = (body: any, userId: string) => body.participantes.find((p: any) => p.userId === userId)?.status;
const unknownId = "00000000-0000-4000-8000-000000000000";

describe("meetings (eventos)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("requires a token on every route", async () => {
    expect((await request(app).get("/meetings")).status).toBe(401);
    expect((await request(app).post("/meetings").send(payload)).status).toBe(401);
    expect((await request(app).put("/meetings/x").send({})).status).toBe(401);
    expect((await request(app).delete("/meetings/x")).status).toBe(401);
  });

  it("only GESTAO creates, updates and deletes; teachers get 403", async () => {
    const { tokens } = await setup();
    expect((await request(app).post("/meetings").set(auth(tokens.p1)).send(payload)).status).toBe(403);

    const created = await request(app).post("/meetings").set(auth(tokens.gestor)).send(payload);
    expect(created.status).toBe(201);
    expect(created.body.turmas).toEqual([]);
    expect(created.body.permissoes).toEqual({ editar: true, excluir: true, responder: false });

    const id = created.body.id;
    expect((await request(app).put(`/meetings/${id}`).set(auth(tokens.p1)).send({ titulo: "X" })).status).toBe(403);
    expect((await request(app).delete(`/meetings/${id}`).set(auth(tokens.p1))).status).toBe(403);

    const upd = await request(app).put(`/meetings/${id}`).set(auth(tokens.gestor)).send({ titulo: "Novo", tipo: "SIMULADO" });
    expect(upd.status).toBe(200);
    expect(upd.body.titulo).toBe("Novo");
    expect(upd.body.tipo).toBe("SIMULADO");
    expect((await request(app).delete(`/meetings/${id}`).set(auth(tokens.gestor))).status).toBe(204);
  });

  it("lists and views for teachers with read-only permissions", async () => {
    const { tokens } = await setup();
    const { body } = await request(app).post("/meetings").set(auth(tokens.gestor)).send(payload);
    const list = await request(app).get("/meetings").set(auth(tokens.p2));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].meuStatus).toBeNull();
    const one = await request(app).get(`/meetings/${body.id}`).set(auth(tokens.p2));
    expect(one.body.permissoes).toEqual({ editar: false, excluir: false, responder: false });
  });

  it("takes creator from token, ignoring body, and hides email", async () => {
    const { p1, gestor, tokens } = await setup();
    const res = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, criadoPorId: p1.id });
    expect(res.status).toBe(201);
    expect(res.body.criadoPorId).toBe(gestor.id);
    expect(res.body.criadoPor.name).toBe("Gestor");
    expect(res.body.criadoPor.email).toBeUndefined();
  });

  it("keeps the event with criadoPorId null when its creator is deleted", async () => {
    const { tokens } = await setup();
    await createUser({ email: "gestor2@test.com", roles: ["GESTAO"], name: "Gestor 2" });
    const token2 = await loginAs("gestor2@test.com");
    const created = await request(app).post("/meetings").set(auth(tokens.gestor)).send(payload);
    await prisma.user.delete({ where: { email: "gestor@test.com" } });
    const one = await request(app).get(`/meetings/${created.body.id}`).set(auth(token2));
    expect(one.status).toBe(200);
    expect(one.body.criadoPorId).toBeNull();
    expect(one.body.criadoPor).toBeNull();
    expect(one.body.permissoes).toEqual({ editar: true, excluir: true, responder: false });
  });

  it("validates tipo, time range and unknown ids", async () => {
    const { tokens } = await setup();
    expect((await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, tipo: "REVISAO" })).status).toBe(400);
    expect((await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, horarioFim: "13:00" })).status).toBe(400);
    const { body } = await request(app).post("/meetings").set(auth(tokens.gestor)).send(payload);
    expect((await request(app).put(`/meetings/${body.id}`).set(auth(tokens.gestor)).send({ horarioFim: "13:00" })).status).toBe(400);
    expect((await request(app).get(`/meetings/${unknownId}`).set(auth(tokens.gestor))).status).toBe(404);
    expect((await request(app).put(`/meetings/${unknownId}`).set(auth(tokens.gestor)).send({ titulo: "X" })).status).toBe(404);
    expect((await request(app).delete(`/meetings/${unknownId}`).set(auth(tokens.gestor))).status).toBe(404);
  });

  it("class-type events require an immutable subject", async () => {
    const { tokens } = await setup();
    const quimica = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
    const post = (body: object) => request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, ...body });

    expect((await post({ tipo: "AULA" })).status).toBe(400);
    expect((await post({ tipo: "AULAO", disciplinaId: "nao-existe" })).status).toBe(400);
    expect((await post({ tipo: "REUNIAO", disciplinaId: quimica.id })).status).toBe(400);

    const aulao = await post({ tipo: "AULAO", disciplinaId: quimica.id });
    expect(aulao.status).toBe(201);
    expect(aulao.body.disciplina).toEqual({ id: quimica.id, nome: "Química" });
    const id = aulao.body.id as string;
    const put = (body: object) => request(app).put(`/meetings/${id}`).set(auth(tokens.gestor)).send(body);

    const outra = await prisma.disciplina.create({ data: { nome: "Física", nomeNormalizado: "fisica" } });
    expect((await put({ disciplinaId: outra.id })).status).toBe(400);
    expect((await put({ tipo: "REUNIAO" })).status).toBe(400);

    const asAula = await put({ tipo: "AULA", titulo: "Revisão" });
    expect(asAula.status).toBe(200);
    expect(asAula.body.disciplina).toEqual({ id: quimica.id, nome: "Química" });

    const reuniao = await post({ tipo: "REUNIAO" });
    expect(reuniao.body.disciplina).toBeNull();
    expect((await request(app).put(`/meetings/${reuniao.body.id}`).set(auth(tokens.gestor)).send({ tipo: "AULAO" })).status).toBe(400);
    expect((await request(app).put(`/meetings/${reuniao.body.id}`).set(auth(tokens.gestor)).send({ tipo: "SIMULADO" })).status).toBe(200);
  });

  it("links classes: returns them, replaces on update, rejects unknown", async () => {
    const { tokens } = await setup();
    const a = await prisma.turma.create({ data: { nome: "Turma A", anoLetivo: 2026 } });
    const b = await prisma.turma.create({ data: { nome: "Turma B", anoLetivo: 2026 } });

    const created = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, turmaIds: [a.id, b.id] });
    expect(created.status).toBe(201);
    expect(created.body.turmas).toEqual([{ id: a.id, nome: "Turma A" }, { id: b.id, nome: "Turma B" }]);

    const kept = await request(app).put(`/meetings/${created.body.id}`).set(auth(tokens.gestor)).send({ titulo: "Y" });
    expect(kept.body.turmas).toHaveLength(2);

    const only = await request(app).put(`/meetings/${created.body.id}`).set(auth(tokens.gestor)).send({ turmaIds: [b.id] });
    expect(only.body.turmas).toEqual([{ id: b.id, nome: "Turma B" }]);

    const cleared = await request(app).put(`/meetings/${created.body.id}`).set(auth(tokens.gestor)).send({ turmaIds: [] });
    expect(cleared.body.turmas).toEqual([]);

    const bad = "c000000000000000000000000";
    expect((await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, turmaIds: [bad] })).status).toBe(400);
    expect((await request(app).put(`/meetings/${created.body.id}`).set(auth(tokens.gestor)).send({ turmaIds: [bad] })).status).toBe(400);
  });

  describe("participants and rsvp", () => {
    it("creates guests as PENDENTE, without email, creator not auto-added", async () => {
      const { p1, p2, tokens } = await setup();
      const res = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [p2.id, p1.id] });
      expect(res.status).toBe(201);
      expect(res.body.participantes).toEqual([
        { userId: p2.id, name: "Prof Dois", status: "PENDENTE" },
        { userId: p1.id, name: "Prof Um", status: "PENDENTE" }
      ].sort((a, b) => a.name.localeCompare(b.name)));
      expect(res.body.meuStatus).toBeNull();
    });

    it("confirms the creator who includes themselves; they can change it later", async () => {
      const { gestor, p1, tokens } = await setup();
      const res = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [gestor.id, p1.id] });
      expect(res.status).toBe(201);
      expect(statusOf(res.body, gestor.id)).toBe("CONFIRMADO");
      expect(statusOf(res.body, p1.id)).toBe("PENDENTE");
      expect(res.body.meuStatus).toBe("CONFIRMADO");

      const changed = await request(app).put(`/meetings/${res.body.id}/rsvp`).set(auth(tokens.gestor)).send({ status: "RECUSADO" });
      expect(changed.status).toBe(200);
      expect(statusOf(changed.body, gestor.id)).toBe("RECUSADO");
    });

    it("confirms the editor who adds themselves, keeping everyone else's status", async () => {
      const { gestor, p1, tokens } = await setup();
      const created = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [p1.id] });
      await request(app).put(`/meetings/${created.body.id}/rsvp`).set(auth(tokens.p1)).send({ status: "RECUSADO" });

      const res = await request(app)
        .put(`/meetings/${created.body.id}`)
        .set(auth(tokens.gestor))
        .send({ participanteIds: [p1.id, gestor.id] });
      expect(res.status).toBe(200);
      expect(statusOf(res.body, gestor.id)).toBe("CONFIRMADO");
      expect(statusOf(res.body, p1.id)).toBe("RECUSADO");
    });

    it("rescheduling (date or time) asks participants to confirm again, except the editor", async () => {
      const { gestor, p1, p2, tokens } = await setup();
      const created = await request(app)
        .post("/meetings")
        .set(auth(tokens.gestor))
        .send({ ...payload, participanteIds: [gestor.id, p1.id, p2.id] });
      const id = created.body.id as string;
      await request(app).put(`/meetings/${id}/rsvp`).set(auth(tokens.p1)).send({ status: "CONFIRMADO" });
      await request(app).put(`/meetings/${id}/rsvp`).set(auth(tokens.p2)).send({ status: "RECUSADO" });

      // Mudar só o título não é remarcação.
      const renamed = await request(app).put(`/meetings/${id}`).set(auth(tokens.gestor)).send({ titulo: "Novo título" });
      expect(statusOf(renamed.body, p1.id)).toBe("CONFIRMADO");

      const moved = await request(app).put(`/meetings/${id}`).set(auth(tokens.gestor)).send({ data: "2026-11-12" });
      expect(moved.status).toBe(200);
      expect(statusOf(moved.body, gestor.id)).toBe("CONFIRMADO");
      expect(statusOf(moved.body, p1.id)).toBe("PENDENTE");
      expect(statusOf(moved.body, p2.id)).toBe("PENDENTE");
      expect(moved.body.meuRemarcado).toBe(false);

      const forP1 = await request(app).get(`/meetings/${id}`).set(auth(tokens.p1));
      expect(forP1.body.meuRemarcado).toBe(true);
      const answered = await request(app).put(`/meetings/${id}/rsvp`).set(auth(tokens.p1)).send({ status: "CONFIRMADO" });
      expect(answered.body.meuRemarcado).toBe(false);
      expect(statusOf(answered.body, p1.id)).toBe("CONFIRMADO");

      const retimed = await request(app).put(`/meetings/${id}`).set(auth(tokens.gestor)).send({ horarioInicio: "15:00" });
      expect(statusOf(retimed.body, p1.id)).toBe("PENDENTE");
      expect((await request(app).get(`/meetings/${id}`).set(auth(tokens.p1))).body.meuRemarcado).toBe(true);
    });

    it("new invitees added together with a reschedule are plain invites, not reschedules", async () => {
      const { p1, p2, tokens } = await setup();
      const created = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [p1.id] });
      await request(app)
        .put(`/meetings/${created.body.id}`)
        .set(auth(tokens.gestor))
        .send({ data: "2026-11-13", participanteIds: [p1.id, p2.id] });

      expect((await request(app).get(`/meetings/${created.body.id}`).set(auth(tokens.p1))).body.meuRemarcado).toBe(true);
      const forP2 = await request(app).get(`/meetings/${created.body.id}`).set(auth(tokens.p2));
      expect(forP2.body.meuStatus).toBe("PENDENTE");
      expect(forP2.body.meuRemarcado).toBe(false);
    });

    it("update with participanteIds adds/removes and preserves status; without keeps", async () => {
      const { p1, p2, tokens } = await setup();
      const { body } = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [p2.id] });
      await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p2)).send({ status: "CONFIRMADO" });

      const keep = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.gestor)).send({ titulo: "Z" });
      expect(keep.body.participantes).toHaveLength(1);

      const add = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.gestor)).send({ participanteIds: [p1.id, p2.id] });
      expect(add.body.participantes).toHaveLength(2);
      expect(statusOf(add.body, p2.id)).toBe("CONFIRMADO");
      expect(statusOf(add.body, p1.id)).toBe("PENDENTE");

      const rem = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.gestor)).send({ participanteIds: [p1.id] });
      expect(rem.body.participantes.map((p: any) => p.userId)).toEqual([p1.id]);
    });

    it("rejects nonexistent participanteId with 400", async () => {
      const { tokens } = await setup();
      const bad = "00000000-0000-4000-8000-000000000000";
      expect((await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [bad] })).status).toBe(400);
      const { body } = await request(app).post("/meetings").set(auth(tokens.gestor)).send(payload);
      expect((await request(app).put(`/meetings/${body.id}`).set(auth(tokens.gestor)).send({ participanteIds: [bad] })).status).toBe(400);
    });

    it("participant confirms then declines; meuStatus reflects", async () => {
      const { p2, tokens } = await setup();
      const { body } = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [p2.id] });
      const before = await request(app).get(`/meetings/${body.id}`).set(auth(tokens.p2));
      expect(before.body.meuStatus).toBe("PENDENTE");
      expect(before.body.permissoes.responder).toBe(true);

      const yes = await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p2)).send({ status: "CONFIRMADO" });
      expect(yes.status).toBe(200);
      expect(yes.body.meuStatus).toBe("CONFIRMADO");
      const no = await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p2)).send({ status: "RECUSADO" });
      expect(no.body.meuStatus).toBe("RECUSADO");
      expect(statusOf(no.body, p2.id)).toBe("RECUSADO");
    });

    it("rejects invalid rsvp status; forbids non participants; 404 and 401", async () => {
      const { p1, tokens } = await setup();
      const { body } = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [p1.id] });
      expect((await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p1)).send({ status: "PENDENTE" })).status).toBe(400);
      const send = { status: "CONFIRMADO" };
      expect((await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p2)).send(send)).status).toBe(403);
      expect((await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.gestor)).send(send)).status).toBe(403);
      expect((await request(app).put(`/meetings/${unknownId}/rsvp`).set(auth(tokens.p1)).send(send)).status).toBe(404);
      expect((await request(app).put(`/meetings/${body.id}/rsvp`).send(send)).status).toBe(401);
    });

    it("deleting the event removes participations", async () => {
      const { p2, tokens } = await setup();
      const { body } = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [p2.id] });
      expect(await prisma.participacaoReuniao.count()).toBe(1);
      expect((await request(app).delete(`/meetings/${body.id}`).set(auth(tokens.gestor))).status).toBe(204);
      expect(await prisma.participacaoReuniao.count()).toBe(0);
    });
  });

  it("lists participant options (id and name only) for GESTAO; 401 without token, 403 for teachers", async () => {
    const { tokens } = await setup();
    expect((await request(app).get("/meetings/participant-options")).status).toBe(401);
    expect((await request(app).get("/meetings/participant-options").set(auth(tokens.p1))).status).toBe(403);
    const res = await request(app).get("/meetings/participant-options").set(auth(tokens.gestor));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    for (const option of res.body) expect(Object.keys(option).sort()).toEqual(["id", "name"]);
  });

  it("rejects inviting an inactive user but keeps editing an event whose participant was later deactivated", async () => {
    const { p2, tokens } = await setup();
    const created = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [p2.id] });
    expect(created.status).toBe(201);
    await prisma.user.update({ where: { id: p2.id }, data: { ativo: false } });

    const keep = await request(app).put(`/meetings/${created.body.id}`).set(auth(tokens.gestor)).send({ titulo: "Renomeada", participanteIds: [p2.id] });
    expect(keep.status).toBe(200);
    const other = await request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...payload, participanteIds: [p2.id] });
    expect(other.status).toBe(400);
  });

  describe("regra do professor", () => {
    const base = { titulo: "Evento", tipo: "REUNIAO", data: "2026-11-10", horarioInicio: "14:00", horarioFim: "16:00" };
    const post = (tokens: any, body: object) => request(app).post("/meetings").set(auth(tokens.gestor)).send({ ...base, ...body });
    const put = (tokens: any, id: string, body: object) => request(app).put(`/meetings/${id}`).set(auth(tokens.gestor)).send(body);

    it("rejects creating without a professor unless semProfessores", async () => {
      const { gestor, p1, tokens } = await setup();
      expect((await post(tokens, {})).status).toBe(400);
      expect((await post(tokens, { participanteIds: [gestor.id] })).status).toBe(400);
      const sem = await post(tokens, { semProfessores: true });
      expect(sem.status).toBe(201);
      expect(sem.body.semProfessores).toBe(true);
      const com = await post(tokens, { participanteIds: [p1.id], semProfessores: true });
      expect(com.status).toBe(201);
      expect(com.body.semProfessores).toBe(false);
      const so = await post(tokens, { participanteIds: [p1.id] });
      expect(so.status).toBe(201);
      expect(so.body.semProfessores).toBe(false);
    });

    it("validates the final participants on update", async () => {
      const { gestor, p1, tokens } = await setup();
      const { body } = await post(tokens, { participanteIds: [p1.id, gestor.id] });
      expect((await put(tokens, body.id, { participanteIds: [gestor.id] })).status).toBe(400);
      expect((await put(tokens, body.id, { participanteIds: [] })).status).toBe(400);
      const ok = await put(tokens, body.id, { participanteIds: [gestor.id], semProfessores: true });
      expect(ok.status).toBe(200);
      expect(ok.body.semProfessores).toBe(true);
    });

    it("keeps a saved semProfessores when editing without participants", async () => {
      const { p1, tokens } = await setup();
      const { body } = await post(tokens, { semProfessores: true });
      const res = await put(tokens, body.id, { titulo: "Novo" });
      expect(res.status).toBe(200);
      expect(res.body.semProfessores).toBe(true);
      const withProf = await put(tokens, body.id, { participanteIds: [p1.id] });
      expect(withProf.status).toBe(200);
      expect(withProf.body.semProfessores).toBe(false);
    });
  });
});
