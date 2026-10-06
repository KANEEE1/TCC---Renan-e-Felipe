import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/shared/prisma.js";

export const app = createApp();

export async function resetDb() {
  await prisma.$transaction([
    prisma.presenca.deleteMany(),
    prisma.nota.deleteMany(),
    prisma.matricula.deleteMany(),
    prisma.aula.deleteMany(),
    prisma.disponibilidade.deleteMany(),
    prisma.simulado.deleteMany(),
    prisma.disciplina.deleteMany(),
    prisma.turma.deleteMany(),
    prisma.aluno.deleteMany(),
    prisma.user.deleteMany()
  ]);
}

export async function createUser(overrides: { email: string; roles?: ("GESTAO" | "PROFESSOR")[]; password?: string; name?: string }) {
  const res = await request(app)
    .post("/users")
    .send({
      name: overrides.name ?? "Test User",
      email: overrides.email,
      password: overrides.password ?? "senha1234",
      roles: overrides.roles ?? ["GESTAO"]
    });

  return res.body as { id: string; email: string };
}

export async function loginAs(email: string, password = "senha1234") {
  const res = await request(app).post("/auth/login").send({ email, password });
  return res.body.token as string;
}
