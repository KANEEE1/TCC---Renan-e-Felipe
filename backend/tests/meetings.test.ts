import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { app, createUser, loginAs, resetDb } from "./helpers.js";

const payload = { titulo: "Reunião", tipo: "AULAO", data: "2026-11-10", horarioInicio: "14:00", horarioFim: "16:00" };

async function setup() {
  const gestor = await createUser({ email: "gestor@test.com", roles: ["GESTAO"], name: "Gestor" });
  await createUser({ email: "p1@test.com", roles: ["PROFESSOR"], name: "Prof Um" });
  await createUser({ email: "p2@test.com", roles: ["PROFESSOR"], name: "Prof Dois" });
  const tokens = {
    gestor: await loginAs("gestor@test.com"),
    p1: await loginAs("p1@test.com"),
    p2: await loginAs("p2@test.com")
  };
  return { gestor, tokens };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("meetings", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("requires a token", async () => {
    expect((await request(app).get("/meetings")).status).toBe(401);
  });

  it("lets any authenticated user create, list and view", async () => {
    const { tokens } = await setup();
    const created = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);
    expect(created.status).toBe(201);

    const list = await request(app).get("/meetings").set(auth(tokens.p2));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const one = await request(app).get(`/meetings/${created.body.id}`).set(auth(tokens.p2));
    expect(one.status).toBe(200);
  });

  it("takes creator from token, ignoring body, and hides email", async () => {
    const { gestor, tokens } = await setup();
    const res = await request(app).post("/meetings").set(auth(tokens.p1)).send({ ...payload, criadoPorId: gestor.id });

    expect(res.status).toBe(201);
    expect(res.body.criadoPor.name).toBe("Prof Um");
    expect(res.body.criadoPor.id).not.toBe(gestor.id);
    expect(res.body.criadoPor.email).toBeUndefined();
    expect(res.body.permissoes).toEqual({ editar: true, excluir: true, responder: true });
  });

  it("lets creator and GESTAO update/delete but forbids other teachers", async () => {
    const { tokens } = await setup();
    const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);

    const other = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.p2)).send({ titulo: "X" });
    expect(other.status).toBe(403);
    expect((await request(app).delete(`/meetings/${body.id}`).set(auth(tokens.p2))).status).toBe(403);

    const view = await request(app).get(`/meetings/${body.id}`).set(auth(tokens.p2));
    expect(view.body.permissoes).toEqual({ editar: false, excluir: false, responder: false });

    const own = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.p1)).send({ titulo: "Novo" });
    expect(own.status).toBe(200);
    expect(own.body.titulo).toBe("Novo");

    const asGestor = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.gestor)).send({ titulo: "G" });
    expect(asGestor.status).toBe(200);

    expect((await request(app).delete(`/meetings/${body.id}`).set(auth(tokens.p1))).status).toBe(204);
    const again = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);
    expect((await request(app).delete(`/meetings/${again.body.id}`).set(auth(tokens.gestor))).status).toBe(204);
  });

  it("legacy meeting without creator is managed only by GESTAO", async () => {
    const { tokens } = await setup();
    const legacy = await prisma.reuniao.create({
      data: {
        titulo: "Legada",
        tipo: "AULAO",
        data: new Date("2026-11-10"),
        horarioInicio: new Date("1970-01-01T14:00:00Z"),
        horarioFim: new Date("1970-01-01T16:00:00Z")
      }
    });

    expect((await request(app).put(`/meetings/${legacy.id}`).set(auth(tokens.p1)).send({ titulo: "X" })).status).toBe(403);
    expect((await request(app).delete(`/meetings/${legacy.id}`).set(auth(tokens.p1))).status).toBe(403);
    expect((await request(app).put(`/meetings/${legacy.id}`).set(auth(tokens.gestor)).send({ titulo: "Y" })).status).toBe(200);
    expect((await request(app).delete(`/meetings/${legacy.id}`).set(auth(tokens.gestor))).status).toBe(204);
  });

  it("rejects PUT with horarioFim before stored horarioInicio", async () => {
    const { tokens } = await setup();
    const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);

    const res = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.p1)).send({ horarioFim: "13:00" });
    expect(res.status).toBe(400);
  });

  it("keeps the meeting as legacy when its creator is deleted", async () => {
    const { tokens } = await setup();
    const created = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);

    await prisma.user.delete({ where: { email: "p1@test.com" } });

    const one = await request(app).get(`/meetings/${created.body.id}`).set(auth(tokens.gestor));
    expect(one.status).toBe(200);
    expect(one.body.criadoPorId).toBeNull();
    expect(one.body.criadoPor).toBeNull();
    expect(one.body.permissoes).toEqual({ editar: true, excluir: true, responder: false });
  });

  it("returns 404 for unknown id", async () => {
    const { tokens } = await setup();
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await request(app).get(`/meetings/${id}`).set(auth(tokens.gestor))).status).toBe(404);
    expect((await request(app).put(`/meetings/${id}`).set(auth(tokens.gestor)).send({ titulo: "X" })).status).toBe(404);
    expect((await request(app).delete(`/meetings/${id}`).set(auth(tokens.gestor))).status).toBe(404);
  });

  describe("rsvp", () => {
    const ids = async () => ({
      p1: (await prisma.user.findUniqueOrThrow({ where: { email: "p1@test.com" } })).id,
      p2: (await prisma.user.findUniqueOrThrow({ where: { email: "p2@test.com" } })).id
    });
    const statusOf = (body: any, userId: string) => body.participantes.find((p: any) => p.userId === userId)?.status;

    it("adds creator as CONFIRMADO, guests as PENDENTE, without email", async () => {
      const { tokens } = await setup();
      const u = await ids();
      const res = await request(app).post("/meetings").set(auth(tokens.p1)).send({ ...payload, participanteIds: [u.p2, u.p1] });
      expect(res.status).toBe(201);
      expect(res.body.participantes).toHaveLength(2);
      expect(res.body.participantes[0]).toEqual({ userId: u.p1, name: "Prof Um", status: "CONFIRMADO" });
      expect(res.body.participantes[1]).toEqual({ userId: u.p2, name: "Prof Dois", status: "PENDENTE" });
      expect(res.body.participantes.every((p: any) => p.email === undefined)).toBe(true);
      expect(res.body.meuStatus).toBe("CONFIRMADO");
    });

    it("update without participanteIds keeps participants", async () => {
      const { tokens } = await setup();
      const u = await ids();
      const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send({ ...payload, participanteIds: [u.p2] });
      const res = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.p1)).send({ titulo: "Novo" });
      expect(res.status).toBe(200);
      expect(res.body.participantes).toHaveLength(2);
    });

    it("update with participanteIds adds/removes, preserves status and never removes creator", async () => {
      const { gestor, tokens } = await setup();
      const u = await ids();
      const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send({ ...payload, participanteIds: [u.p2] });
      await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p2)).send({ status: "CONFIRMADO" });

      const add = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.p1)).send({ participanteIds: [u.p1, u.p2, gestor.id] });
      expect(add.status).toBe(200);
      expect(add.body.participantes).toHaveLength(3);
      expect(statusOf(add.body, u.p2)).toBe("CONFIRMADO");
      expect(statusOf(add.body, gestor.id)).toBe("PENDENTE");

      const rem = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.p1)).send({ participanteIds: [gestor.id] });
      expect(rem.status).toBe(200);
      expect(rem.body.participantes.map((p: any) => p.userId).sort()).toEqual([u.p1, gestor.id].sort());
      expect(statusOf(rem.body, u.p1)).toBe("CONFIRMADO");

      const empty = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.p1)).send({ participanteIds: [] });
      expect(empty.body.participantes.map((p: any) => p.userId)).toEqual([u.p1]);
    });

    it("rejects nonexistent participanteId with 400", async () => {
      const { tokens } = await setup();
      const bad = "00000000-0000-4000-8000-000000000000";
      expect((await request(app).post("/meetings").set(auth(tokens.p1)).send({ ...payload, participanteIds: [bad] })).status).toBe(400);
      const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);
      expect((await request(app).put(`/meetings/${body.id}`).set(auth(tokens.p1)).send({ participanteIds: [bad] })).status).toBe(400);
    });

    it("guest confirms then declines; meuStatus reflects", async () => {
      const { tokens } = await setup();
      const u = await ids();
      const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send({ ...payload, participanteIds: [u.p2] });
      const before = await request(app).get(`/meetings/${body.id}`).set(auth(tokens.p2));
      expect(before.body.meuStatus).toBe("PENDENTE");
      expect(before.body.permissoes.responder).toBe(true);

      const yes = await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p2)).send({ status: "CONFIRMADO" });
      expect(yes.status).toBe(200);
      expect(yes.body.meuStatus).toBe("CONFIRMADO");
      expect(statusOf(yes.body, u.p2)).toBe("CONFIRMADO");

      const no = await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p2)).send({ status: "RECUSADO" });
      expect(no.body.meuStatus).toBe("RECUSADO");
      expect(statusOf(no.body, u.p2)).toBe("RECUSADO");
    });

    it("rejects invalid rsvp status with 400", async () => {
      const { tokens } = await setup();
      const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);
      expect((await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p1)).send({ status: "PENDENTE" })).status).toBe(400);
    });

    it("forbids non participants (including GESTAO), 404 unknown, 401 without token", async () => {
      const { tokens } = await setup();
      const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);
      const send = { status: "CONFIRMADO" };
      expect((await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.p2)).send(send)).status).toBe(403);
      expect((await request(app).put(`/meetings/${body.id}/rsvp`).set(auth(tokens.gestor)).send(send)).status).toBe(403);
      const id = "00000000-0000-4000-8000-000000000000";
      expect((await request(app).put(`/meetings/${id}/rsvp`).set(auth(tokens.p2)).send(send)).status).toBe(404);
      expect((await request(app).put(`/meetings/${body.id}/rsvp`).send(send)).status).toBe(401);
    });

    it("meuStatus is null for non participants", async () => {
      const { tokens } = await setup();
      const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);
      const one = await request(app).get(`/meetings/${body.id}`).set(auth(tokens.p2));
      expect(one.body.meuStatus).toBeNull();
      const list = await request(app).get("/meetings").set(auth(tokens.p2));
      expect(list.body[0].meuStatus).toBeNull();
    });

    it("deleting the meeting removes participations", async () => {
      const { tokens } = await setup();
      const u = await ids();
      const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send({ ...payload, participanteIds: [u.p2] });
      expect(await prisma.participacaoReuniao.count()).toBe(2);
      expect((await request(app).delete(`/meetings/${body.id}`).set(auth(tokens.p1))).status).toBe(204);
      expect(await prisma.participacaoReuniao.count()).toBe(0);
    });
  });

  it("lists participant options with only id and name, and requires a token", async () => {
    const { tokens } = await setup();
    expect((await request(app).get("/meetings/participant-options")).status).toBe(401);

    const res = await request(app).get("/meetings/participant-options").set(auth(tokens.p1));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    for (const option of res.body) {
      expect(Object.keys(option).sort()).toEqual(["id", "name"]);
    }
  });

  it("rejects inviting an inactive user but keeps editing a meeting whose participant was later deactivated", async () => {
    const { tokens } = await setup();
    const p2 = await prisma.user.findUniqueOrThrow({ where: { email: "p2@test.com" } });

    const created = await request(app).post("/meetings").set(auth(tokens.p1)).send({ ...payload, participanteIds: [p2.id] });
    expect(created.status).toBe(201);

    await prisma.user.update({ where: { id: p2.id }, data: { ativo: false } });

    const keep = await request(app)
      .put(`/meetings/${created.body.id}`)
      .set(auth(tokens.p1))
      .send({ titulo: "Renomeada", participanteIds: [p2.id] });
    expect(keep.status).toBe(200);

    const other = await request(app).post("/meetings").set(auth(tokens.p1)).send({ ...payload, participanteIds: [p2.id] });
    expect(other.status).toBe(400);
  });
});
