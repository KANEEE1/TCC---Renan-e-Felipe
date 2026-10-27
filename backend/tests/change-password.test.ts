import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, asGestao, createUser, resetDb } from "./helpers.js";

const email = "prof@test.com";
const trocar = (body: Record<string, unknown>) => request(app).post("/auth/change-password").send(body);
const login = (password: string) => request(app).post("/auth/login").send({ email, password });

describe("change password", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("changes the password when the current one matches", async () => {
    await createUser({ email, roles: ["PROFESSOR"] });

    expect((await trocar({ email, senhaAtual: "senha1234", novaSenha: "novaSenha99" })).status).toBe(204);
    expect((await login("senha1234")).status).toBe(401);
    expect((await login("novaSenha99")).status).toBe(200);
  });

  it("rejects a wrong current password or unknown email with 401", async () => {
    await createUser({ email, roles: ["PROFESSOR"] });

    expect((await trocar({ email, senhaAtual: "errada", novaSenha: "novaSenha99" })).status).toBe(401);
    expect((await trocar({ email: "nao@existe.com", senhaAtual: "senha1234", novaSenha: "novaSenha99" })).status).toBe(401);
    expect((await login("senha1234")).status).toBe(200);
  });

  it("validates the new password", async () => {
    await createUser({ email, roles: ["PROFESSOR"] });

    expect((await trocar({ email, senhaAtual: "senha1234", novaSenha: "curta" })).status).toBe(400);
    expect((await trocar({ email, senhaAtual: "senha1234", novaSenha: "senha1234" })).status).toBe(400);
  });

  it("blocks a deactivated user", async () => {
    const user = await createUser({ email, roles: ["PROFESSOR"] });
    await request(app).put(`/teachers/${user.id}`).set(asGestao()).send({ ativo: false });

    expect((await trocar({ email, senhaAtual: "senha1234", novaSenha: "novaSenha99" })).status).toBe(403);
  });
});
