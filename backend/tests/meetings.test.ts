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
    expect(res.body.permissoes).toEqual({ editar: true, excluir: true });
  });

  it("lets creator and GESTAO update/delete but forbids other teachers", async () => {
    const { tokens } = await setup();
    const { body } = await request(app).post("/meetings").set(auth(tokens.p1)).send(payload);

    const other = await request(app).put(`/meetings/${body.id}`).set(auth(tokens.p2)).send({ titulo: "X" });
    expect(other.status).toBe(403);
    expect((await request(app).delete(`/meetings/${body.id}`).set(auth(tokens.p2))).status).toBe(403);

    const view = await request(app).get(`/meetings/${body.id}`).set(auth(tokens.p2));
    expect(view.body.permissoes).toEqual({ editar: false, excluir: false });

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
    expect(one.body.permissoes).toEqual({ editar: true, excluir: true });
  });

  it("returns 404 for unknown id", async () => {
    const { tokens } = await setup();
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await request(app).get(`/meetings/${id}`).set(auth(tokens.gestor))).status).toBe(404);
    expect((await request(app).put(`/meetings/${id}`).set(auth(tokens.gestor)).send({ titulo: "X" })).status).toBe(404);
    expect((await request(app).delete(`/meetings/${id}`).set(auth(tokens.gestor))).status).toBe(404);
  });
});
