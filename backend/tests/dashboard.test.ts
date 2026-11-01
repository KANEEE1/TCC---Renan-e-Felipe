import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { currentDiaSemana, parseTimeToDate, todayInSaoPaulo } from "../src/shared/time.js";
import { app, asGestao, asTeacher, createUser, resetDb } from "./helpers.js";

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

    const res = await request(app).get("/dashboard/summary").set(asGestao());
    expect(res.status).toBe(200);
    const nomes = (res.body.todayActivities as { turmas: string[] }[]).map((a) => a.turmas[0]).sort();
    expect(nomes).toEqual(["Sem periodo", "Termina hoje", "Vigente"]);
  });

  describe("resumo do dia por perfil", () => {
    // 2026-10-28 é quarta; 11:30Z = 08:30 em São Paulo.
    const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
    const day = (iso: string) => new Date(iso);
    const summary = async (headers: Record<string, string>) => (await request(app).get("/dashboard/summary").set(headers)).body;
    const titulos = (body: any) => body.todayActivities.map((a: any) => a.titulo);

    afterEach(() => vi.useRealTimers());

    async function setup(agoraIso = "2026-10-28T11:30:00Z") {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(agoraIso));
      const turma = await prisma.turma.create({
        data: { nome: "Turma 1", anoLetivo: 2026, gradeInicio: day("2026-10-01"), gradeFim: day("2026-12-31") }
      });
      const [mat, fis, qui, bio] = await Promise.all(
        ["Matemática", "Física", "Química", "Biologia"].map((nome) =>
          prisma.disciplina.create({ data: { nome, nomeNormalizado: nome.toLowerCase() } })
        )
      );
      const gestor = await createUser({ email: "g@d.com", roles: ["GESTAO"], name: "Gestor" });
      const profA = await createUser({ email: "a@d.com", roles: ["PROFESSOR"], name: "Prof A" });
      const profB = await createUser({ email: "b@d.com", roles: ["PROFESSOR"], name: "Prof B" });
      const aula = (disciplinaId: string, professorId: string, inicio: string, fim: string, sala?: string) =>
        prisma.aula.create({
          data: {
            turmaId: turma.id,
            disciplinaId,
            professorId,
            diaSemana: "QUARTA",
            horarioInicio: time(inicio),
            horarioFim: time(fim),
            sala,
            createdAt: new Date("2026-10-01T12:00:00Z")
          }
        });
      const aulaA = await aula(mat.id, profA.id, "08:00", "09:00", "Sala 1");
      const aulaB = await aula(fis.id, profB.id, "10:00", "11:00");
      const evento = (titulo: string, data: string, inicio: string, participantes: { id: string; status: "PENDENTE" | "CONFIRMADO" | "RECUSADO" }[], tipo: "REUNIAO" | "AULAO" = "REUNIAO") =>
        prisma.reuniao.create({
          data: {
            titulo,
            tipo,
            data: day(data),
            horarioInicio: time(inicio),
            horarioFim: time(`${String(Number(inicio.slice(0, 2)) + 1).padStart(2, "0")}:00`),
            local: "Auditório",
            disciplinaId: tipo === "AULAO" ? qui.id : null,
            turmas: { connect: [{ id: turma.id }] },
            participacoes: { create: participantes.map((p) => ({ userId: p.id, status: p.status })) }
          }
        });
      return { turma, gestor, profA, profB, aulaA, aulaB, evento, bio };
    }

    it("requires authentication", async () => {
      expect((await request(app).get("/dashboard/summary")).status).toBe(401);
    });

    it("professor sees only own lessons and events (not declined, not others, not other days)", async () => {
      const ctx = await setup();
      await ctx.evento("Reunião A", "2026-10-28", "13:00", [{ id: ctx.profA.id, status: "PENDENTE" }]);
      await ctx.evento("Reunião recusada", "2026-10-28", "14:00", [{ id: ctx.profA.id, status: "RECUSADO" }]);
      await ctx.evento("Reunião de B", "2026-10-28", "15:00", [{ id: ctx.profB.id, status: "CONFIRMADO" }]);
      await ctx.evento("Reunião amanhã", "2026-10-29", "13:00", [{ id: ctx.profA.id, status: "CONFIRMADO" }]);
      const body = await summary(asTeacher(ctx.profA.id));
      expect(titulos(body)).toEqual(["Matemática", "Reunião A"]);
      expect(body.todayActivities[0]).toMatchObject({
        kind: "AULA", tipo: "AULA", disciplina: "Matemática", turmas: ["Turma 1"], professores: ["Prof A"], local: "Sala 1",
        horarioInicio: "08:00", horarioFim: "09:00", participo: true, aulaId: ctx.aulaA.id, dataOriginal: "2026-10-28"
      });
      expect(body.todayActivities[1]).toMatchObject({ kind: "EVENTO", local: "Auditório", eventoId: expect.any(String), participo: true });
      expect(body.todayActivities.filter((item: { kind: string }) => item.kind === "AULA")).toHaveLength(1);
      expect(body.stats).toBeUndefined();
    });

    it("professor does not see a lesson with a standing unavailability", async () => {
      const ctx = await setup();
      await prisma.indisponibilidadeAula.create({
        data: { aulaId: ctx.aulaA.id, dataOriginal: day("2026-10-28"), professorId: ctx.profA.id }
      });
      expect(titulos(await summary(asTeacher(ctx.profA.id)))).toEqual([]);
      // A gestão ainda vê a aula.
      expect(titulos(await summary(asGestao()))).toContain("Matemática");
    });

    it("gestão sees everything and flags what they take part in", async () => {
      const ctx = await setup();
      await ctx.evento("Reunião gestão", "2026-10-28", "13:00", [{ id: ctx.gestor.id, status: "PENDENTE" }, { id: ctx.profA.id, status: "RECUSADO" }]);
      await ctx.evento("Aulão", "2026-10-28", "14:00", [{ id: ctx.profB.id, status: "CONFIRMADO" }], "AULAO");
      await ctx.evento("Outro dia", "2026-10-30", "14:00", [{ id: ctx.profB.id, status: "CONFIRMADO" }]);
      const headers = { Authorization: `Bearer ${(await import("../src/shared/auth.js")).signAuthToken({ sub: ctx.gestor.id, roles: ["GESTAO"] })}` };
      const body = await summary(headers);
      expect(titulos(body)).toEqual(["Matemática", "Física", "Reunião gestão", "Aulão"]);
      expect(body.todayActivities.map((a: any) => a.participo)).toEqual([false, false, true, false]);
      expect(body.todayActivities[2].professores).toEqual(["Gestor"]);
      expect(body.todayActivities.filter((item: { kind: string }) => item.kind === "AULA")).toHaveLength(2);
      expect(body.todayActivities.filter((item: { tipo: string }) => item.tipo === "AULAO")).toHaveLength(1);
    });

    it("respects moved and cancelled occurrences", async () => {
      const ctx = await setup();
      await prisma.aulaExcecao.create({ data: { aulaId: ctx.aulaA.id, dataOriginal: day("2026-10-28"), cancelada: true } });
      await prisma.aulaExcecao.create({
        data: { aulaId: ctx.aulaB.id, dataOriginal: day("2026-10-28"), horarioInicio: time("16:00"), horarioFim: time("17:00") }
      });
      const body = await summary(asGestao());
      expect(body.todayActivities).toHaveLength(1);
      expect(body.todayActivities[0]).toMatchObject({ titulo: "Física", horarioInicio: "16:00", horarioFim: "17:00" });
    });

    it("computes status from the São Paulo time of day", async () => {
      // 08:30 em SP: aula A em andamento, B agendada.
      const ctx = await setup();
      let body = await summary(asGestao());
      expect(body.todayActivities.map((a: any) => a.status)).toEqual(["em andamento", "agendada"]);
      vi.setSystemTime(new Date("2026-10-28T14:30:00Z")); // 11:30 em SP
      body = await summary(asGestao());
      expect(body.todayActivities.map((a: any) => a.status)).toEqual(["concluída", "concluída"]);
      expect(ctx.aulaA.id).toBeTruthy();
    });
  });
});
