import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, createUser, loginAs, resetDb } from "./helpers.js";

describe("auth", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects login with unknown email", async () => {
    const res = await request(app).post("/auth/login").send({ email: "nobody@test.com", password: "senha1234" });

    expect(res.status).toBe(401);
  });

  it("logs in and returns a token for a valid user", async () => {
    await createUser({ email: "gestao@test.com" });

    const res = await request(app).post("/auth/login").send({ email: "gestao@test.com", password: "senha1234" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.email).toBe("gestao@test.com");
  });

  it("rejects login with the wrong password", async () => {
    await createUser({ email: "gestao@test.com" });

    const res = await request(app).post("/auth/login").send({ email: "gestao@test.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("hashes the password instead of storing it as plain text", async () => {
    const user = await createUser({ email: "gestao@test.com" });

    const { prisma } = await import("../src/shared/prisma.js");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(stored.passwordHash).not.toBe("senha1234");
    expect(stored.passwordHash.length).toBeGreaterThan(20);
  });

  it("rejects /auth/me without a token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user for /auth/me with a valid token", async () => {
    await createUser({ email: "gestao@test.com", name: "Gestão Teste" });
    const token = await loginAs("gestao@test.com");

    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Gestão Teste");
  });

  it("rejects a request with a malformed token", async () => {
    const res = await request(app).get("/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
