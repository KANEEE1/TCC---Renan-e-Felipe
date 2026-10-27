import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../src/app.js";
import { signAuthToken } from "../src/shared/auth.js";
import { prisma } from "../src/shared/prisma.js";

export const app = createApp();

export async function resetDb() {
  await prisma.$transaction([
    prisma.presenca.deleteMany(),
    prisma.nota.deleteMany(),
    prisma.matricula.deleteMany(),
    prisma.substituicao.deleteMany(),
    prisma.ausenciaAula.deleteMany(),
    prisma.aula.deleteMany(),
    prisma.disponibilidade.deleteMany(),
    prisma.simulado.deleteMany(),
    prisma.cargaDisciplinaTurma.deleteMany(),
    prisma.janelaTurma.deleteMany(),
    prisma.disciplina.deleteMany(),
    prisma.turma.deleteMany(),
    prisma.aluno.deleteMany(),
    prisma.participacaoReuniao.deleteMany(),
    prisma.reuniao.deleteMany(),
    prisma.user.deleteMany()
  ]);
}

export async function createUser(overrides: { email: string; roles?: ("GESTAO" | "PROFESSOR")[]; password?: string; name?: string }) {
  // Direto no banco: POST /users exige um gestor autenticado.
  return prisma.user.create({
    data: {
      name: overrides.name ?? "Test User",
      email: overrides.email,
      passwordHash: await bcrypt.hash(overrides.password ?? "senha1234", 4),
      roles: overrides.roles ?? ["GESTAO"]
    },
    select: { id: true, email: true }
  });
}

export async function loginAs(email: string, password = "senha1234") {
  const res = await request(app).post("/auth/login").send({ email, password });
  return res.body.token as string;
}

// Header de autenticação de um professor pelo id, sem passar pelo login.
export function asTeacher(professorId: string) {
  return { Authorization: `Bearer ${signAuthToken({ sub: professorId, roles: ["PROFESSOR"] })}` };
}

// Header de autenticação de um gestor, sem passar pelo login.
export function asGestao() {
  return { Authorization: `Bearer ${signAuthToken({ sub: "gestao-teste", roles: ["GESTAO"] })}` };
}
