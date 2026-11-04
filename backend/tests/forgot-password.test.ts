import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, createUser, resetDb } from "./helpers.js";
import { signPurposeToken } from "../src/shared/auth.js";

const email = "prof@test.com";
const forgotPassword = (body: Record<string, unknown>) => request(app).post("/auth/forgot-password").send(body);
const resetPassword = (body: Record<string, unknown>) => request(app).post("/auth/reset-password").send(body);
const login = (password: string) => request(app).post("/auth/login").send({ email, password });

describe("forgot password", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("always responds 204, existing or not, to avoid leaking which emails exist", async () => {
    await createUser({ email, roles: ["PROFESSOR"] });

    expect((await forgotPassword({ email })).status).toBe(204);
    expect((await forgotPassword({ email: "nao@existe.com" })).status).toBe(204);
  });

  it("resets the password with a valid token", async () => {
    const user = await createUser({ email, roles: ["PROFESSOR"] });
    const token = signPurposeToken("reset-password", user.id, "1h");

    expect((await resetPassword({ token, novaSenha: "novaSenha99" })).status).toBe(204);
    expect((await login("senha1234")).status).toBe(401);
    expect((await login("novaSenha99")).status).toBe(200);
  });

  it("rejects an invalid or wrong-purpose token", async () => {
    const user = await createUser({ email, roles: ["PROFESSOR"] });
    const wrongPurpose = signPurposeToken("confirm-email", user.id, "1h");

    expect((await resetPassword({ token: "lixo-invalido", novaSenha: "novaSenha99" })).status).toBe(400);
    expect((await resetPassword({ token: wrongPurpose, novaSenha: "novaSenha99" })).status).toBe(400);
    expect((await login("senha1234")).status).toBe(200);
  });

  it("validates the new password", async () => {
    const user = await createUser({ email, roles: ["PROFESSOR"] });
    const token = signPurposeToken("reset-password", user.id, "1h");

    expect((await resetPassword({ token, novaSenha: "curta" })).status).toBe(400);
  });
});
