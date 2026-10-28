import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { currentDiaSemana, parseTimeToDate, todayInSaoPaulo } from "../src/shared/time.js";
import { app, createUser, resetDb } from "./helpers.js";

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

describe("dashboard summary", () => {
  beforeEach(resetDb);

  it("lists today's lessons only for classes whose grade period includes today", async () => {
    const hoje = todayInSaoPaulo();
    const professor = await createUser({ email: "prof@test.com", roles: ["PROFESSOR"] });
    const disciplina = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
    const turma = async (nome: string, gradeInicio: Date | null, gradeFim: Date | null, hora: string) => {
      const t = await prisma.turma.create({ data: { nome, anoLetivo: 2026, gradeInicio, gradeFim } });
      await prisma.aula.create({
        data: {
          turmaId: t.id,
          disciplinaId: disciplina.id,
          professorId: professor.id,
          diaSemana: currentDiaSemana(),
          horarioInicio: parseTimeToDate(hora),
          horarioFim: parseTimeToDate(`${hora.slice(0, 2)}:30`)
        }
      });
    };
    await turma("Vigente", shift(hoje, -10), shift(hoje, 10), "08:00");
    await turma("Termina hoje", shift(hoje, -10), shift(hoje, 0), "09:00");
    await turma("Sem periodo", null, null, "10:00");
    await turma("Vencida", shift(hoje, -30), shift(hoje, -1), "11:00");
    await turma("Futura", shift(hoje, 1), shift(hoje, 30), "12:00");

    const res = await request(app).get("/dashboard/summary");
    expect(res.status).toBe(200);
    const nomes = (res.body.todayActivities as { class: string }[]).map((a) => a.class).sort();
    expect(nomes).toEqual(["Sem periodo", "Termina hoje", "Vigente"]);
  });
});
