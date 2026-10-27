import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, createUser, loginAs, resetDb } from "./helpers.js";

const gestor = { name: "Primeira Gestora", email: "gestora@test.com", password: "senha1234" };

describe("first management account setup", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("is available while there is no GESTAO user, even if teachers exist", async () => {
    expect((await request(app).get("/auth/setup")).body).toEqual({ disponivel: true });

    await createUser({ email: "prof@test.com", roles: ["PROFESSOR"] });
    expect((await request(app).get("/auth/setup")).body).toEqual({ disponivel: true });
  });

  it("creates the first GESTAO and returns a working session", async () => {
    const res = await request(app).post("/auth/setup").send(gestor);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: gestor.email, roles: ["GESTAO"] });

    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.name).toBe(gestor.name);
    expect(me.body.passwordHash).toBeUndefined();

    expect((await request(app).get("/auth/setup")).body).toEqual({ disponivel: false });
  });

  it("rejects a second setup", async () => {
    await request(app).post("/auth/setup").send(gestor);

    const res = await request(app).post("/auth/setup").send({ ...gestor, email: "outra@test.com" });
    expect(res.status).toBe(409);
  });

  it("validates the payload", async () => {
    expect((await request(app).post("/auth/setup").send({ ...gestor, password: "curta" })).status).toBe(400);
    expect((await request(app).post("/auth/setup").send({ ...gestor, email: "invalido" })).status).toBe(400);
    expect((await request(app).post("/auth/setup").send({ email: gestor.email, password: gestor.password })).status).toBe(400);
  });

  it("creates only one GESTAO under concurrent requests", async () => {
    const results = await Promise.all([
      request(app).post("/auth/setup").send(gestor),
      request(app).post("/auth/setup").send({ ...gestor, email: "outra@test.com" })
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
  });
});

describe("users routes", () => {
  beforeEach(async () => {
    await resetDb();
  });

  const novo = { name: "Novo", email: "novo@test.com", password: "senha1234", roles: ["GESTAO"] };

  it("require authentication", async () => {
    expect((await request(app).get("/users")).status).toBe(401);
    expect((await request(app).post("/users").send(novo)).status).toBe(401);
  });

  it("forbid teachers and allow GESTAO", async () => {
    await createUser({ email: "prof@test.com", roles: ["PROFESSOR"] });
    await createUser({ email: "gestao@test.com", roles: ["GESTAO"] });
    const prof = await loginAs("prof@test.com");
    const gestao = await loginAs("gestao@test.com");

    expect((await request(app).post("/users").set("Authorization", `Bearer ${prof}`).send(novo)).status).toBe(403);
    expect((await request(app).post("/users").set("Authorization", `Bearer ${gestao}`).send(novo)).status).toBe(201);
  });
});
