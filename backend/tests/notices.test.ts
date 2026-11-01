import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signAuthToken } from "../src/shared/auth.js";
import { prisma } from "../src/shared/prisma.js";
import { app, asGestao, asTeacher, createUser, resetDb } from "./helpers.js";

// America/Sao_Paulo é UTC-3. 2026-10-28 é quarta; aula semanal QUARTA 08:00-10:00 do Prof A. Evento em 2026-11-10 14:00-16:00.
const ANTES = "2026-10-20T12:00:00Z";
const QUARTA_0830 = "2026-10-28T11:30:00Z";
const QUARTA_1030 = "2026-10-28T13:30:00Z";
const EVENTO_DEPOIS = "2026-11-10T18:00:00Z"; // 15:00 em SP, dentro do evento

function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const day = (iso: string) => new Date(iso);
const asGestor = (id: string) => ({ Authorization: `Bearer ${signAuthToken({ sub: id, roles: ["GESTAO"] })}` });
const indisponivel = (aulaId: string, dataOriginal = "2026-10-28") => `/schedule/${aulaId}/ocorrencias/${dataOriginal}/indisponivel`;
const ocorrencia = (aulaId: string, dataOriginal = "2026-10-28") => `/schedule/${aulaId}/ocorrencias/${dataOriginal}`;

async function setup() {
  const turma = await prisma.turma.create({
    data: { nome: "Turma Av", anoLetivo: 2026, gradeInicio: day("2026-10-01"), gradeFim: day("2026-12-31") }
  });
  const disciplina = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
  const gestor = await createUser({ email: "g@av.com", roles: ["GESTAO"], name: "Gestor" });
  const profA = await createUser({ email: "a@av.com", roles: ["PROFESSOR"], name: "Prof A" });
  const profB = await createUser({ email: "b@av.com", roles: ["PROFESSOR"], name: "Prof B" });
  const aula = await prisma.aula.create({
    data: {
      turmaId: turma.id,
      disciplinaId: disciplina.id,
      professorId: profA.id,
      diaSemana: "QUARTA",
      horarioInicio: time("08:00"),
      horarioFim: time("10:00"),
      createdAt: new Date("2026-10-01T12:00:00Z")
    }
  });
  return { turma, disciplina, gestor, profA, profB, aula };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const avisos = async (ctx: Ctx) => (await request(app).get("/notices").set(asGestor(ctx.gestor.id))).body as any[];
const avisosAula = async (ctx: Ctx) => (await avisos(ctx)).filter((a) => a.tipo === "AULA");
const avisosEvento = async (ctx: Ctx) => (await avisos(ctx)).filter((a) => a.tipo === "EVENTO");

// A partir daqui o tempo "anda": as alterações da gestão têm de ser posteriores ao aviso.
const avancar = (ms = 60_000) => vi.setSystemTime(new Date(Date.now() + ms));

async function criarEvento(ctx: Ctx, participanteIds: string[]) {
  const res = await request(app)
    .post("/meetings")
    .set(asGestor(ctx.gestor.id))
    .send({
      titulo: "Reunião pedagógica",
      tipo: "REUNIAO",
      data: "2026-11-10",
      horarioInicio: "14:00",
      horarioFim: "16:00",
      participanteIds,
      turmaIds: [ctx.turma.id],
      semProfessores: true
    });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

const responder = (id: string, userId: string, status: "CONFIRMADO" | "RECUSADO") =>
  request(app).put(`/meetings/${id}/rsvp`).set(asTeacher(userId)).send({ status });

describe("professor indisponível em uma aula", () => {
  beforeEach(async () => {
    await resetDb();
    setNow(ANTES);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("POST /schedule/:id/ocorrencias/:dataOriginal/indisponivel", () => {
    it("o professor da ocorrência avisa, sem registrar falta, e a agenda recebe a indisponibilidade", async () => {
      const ctx = await setup();
      const res = await request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profA.id));
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ aulaId: ctx.aula.id, dataOriginal: "2026-10-28", professorId: ctx.profA.id });
      expect(await prisma.ausenciaAula.count()).toBe(0);

      const weekly = await request(app).get("/schedule/weekly");
      expect(weekly.body[0].indisponibilidades).toEqual([{ dataOriginal: "2026-10-28", professorId: ctx.profA.id }]);
      const porTurma = await request(app).get(`/schedule/by-class/${ctx.turma.id}`);
      expect(porTurma.body[0].indisponibilidades).toHaveLength(1);
    });

    it("exige login e o professor efetivo (outro professor e a gestão recebem 403)", async () => {
      const ctx = await setup();
      expect((await request(app).post(indisponivel(ctx.aula.id))).status).toBe(401);
      expect((await request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profB.id))).status).toBe(403);
      expect((await request(app).post(indisponivel(ctx.aula.id)).set(asGestao())).status).toBe(403);
      expect(await prisma.indisponibilidadeAula.count()).toBe(0);
    });

    it("usa o professor efetivo da ocorrência (exceção troca o professor)", async () => {
      const ctx = await setup();
      await prisma.aulaExcecao.create({
        data: { aulaId: ctx.aula.id, dataOriginal: day("2026-10-28"), data: day("2026-10-28"), horarioInicio: time("08:00"), horarioFim: time("10:00"), professorId: ctx.profB.id }
      });
      expect((await request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profA.id))).status).toBe(403);
      expect((await request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profB.id))).status).toBe(201);
    });

    it("rejeita ocorrência que já começou, cancelada, inexistente ou fora da série", async () => {
      const ctx = await setup();
      setNow(QUARTA_0830);
      expect((await request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profA.id))).status).toBe(409);
      setNow(ANTES);
      expect((await request(app).post(indisponivel(ctx.aula.id, "2026-10-29")).set(asTeacher(ctx.profA.id))).status).toBe(400);
      expect((await request(app).post(indisponivel(ctx.aula.id, "2026-13-45")).set(asTeacher(ctx.profA.id))).status).toBe(400);
      expect((await request(app).post(indisponivel("inexistente")).set(asTeacher(ctx.profA.id))).status).toBe(404);
      await prisma.aulaExcecao.create({ data: { aulaId: ctx.aula.id, dataOriginal: day("2026-11-04"), cancelada: true } });
      expect((await request(app).post(indisponivel(ctx.aula.id, "2026-11-04")).set(asTeacher(ctx.profA.id))).status).toBe(409);
      expect(await prisma.indisponibilidadeAula.count()).toBe(0);
    });

    it("é idempotente e reabre o aviso depois do ciente", async () => {
      const ctx = await setup();
      const post = () => request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profA.id));
      expect((await post()).status).toBe(201);
      expect((await post()).status).toBe(201);
      expect(await prisma.indisponibilidadeAula.count()).toBe(1);

      const [aviso] = await avisosAula(ctx);
      expect((await request(app).post(`/notices/${aviso.id}/ciente`).set(asGestor(ctx.gestor.id))).status).toBe(204);
      expect(await avisosAula(ctx)).toHaveLength(0);

      avancar();
      expect((await post()).status).toBe(201);
      expect(await avisosAula(ctx)).toHaveLength(1);
    });
  });

  describe("GET /notices", () => {
    it("exige autenticação e papel de gestão", async () => {
      const ctx = await setup();
      expect((await request(app).get("/notices")).status).toBe(401);
      expect((await request(app).get("/notices").set(asTeacher(ctx.profA.id))).status).toBe(403);
      expect((await request(app).post("/notices/aula:x/ciente")).status).toBe(401);
      expect((await request(app).post("/notices/aula:x/ciente").set(asTeacher(ctx.profA.id))).status).toBe(403);
    });

    it("mostra a aula e o evento recusados, ordenados por data e horário", async () => {
      const ctx = await setup();
      const eventoId = await criarEvento(ctx, [ctx.profB.id]);
      await responder(eventoId, ctx.profB.id, "RECUSADO");
      await request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profA.id));

      const lista = await avisos(ctx);
      expect(lista).toHaveLength(2);
      const indisp = await prisma.indisponibilidadeAula.findFirstOrThrow();
      expect(lista[0]).toEqual({
        id: `aula:${indisp.id}`,
        tipo: "AULA",
        professor: { id: ctx.profA.id, name: "Prof A" },
        titulo: "Química",
        turma: "Turma Av",
        data: "2026-10-28",
        horarioInicio: "08:00",
        horarioFim: "10:00",
        aulaId: ctx.aula.id,
        dataOriginal: "2026-10-28"
      });
      expect(lista[1]).toMatchObject({
        tipo: "EVENTO",
        professor: { id: ctx.profB.id, name: "Prof B" },
        titulo: "Reunião pedagógica",
        turma: "Turma Av",
        data: "2026-11-10",
        horarioInicio: "14:00",
        horarioFim: "16:00",
        eventoId
      });
      expect(lista[1].id).toMatch(/^evento:/);
    });

    it("ignora evento pendente, confirmado ou recusado por quem não é professor", async () => {
      const ctx = await setup();
      const eventoId = await criarEvento(ctx, [ctx.profA.id, ctx.profB.id, ctx.gestor.id]);
      await responder(eventoId, ctx.profA.id, "CONFIRMADO");
      await responder(eventoId, ctx.gestor.id, "RECUSADO");
      expect(await avisos(ctx)).toHaveLength(0);
    });

    describe("aviso de aula some", () => {
      async function comAviso() {
        const ctx = await setup();
        await request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profA.id));
        expect(await avisosAula(ctx)).toHaveLength(1);
        avancar();
        return ctx;
      }

      it("quando a gestão troca o professor da ocorrência", async () => {
        const ctx = await comAviso();
        const res = await request(app).put(ocorrencia(ctx.aula.id)).set(asGestao()).send({ professorId: ctx.profB.id });
        expect(res.status).toBe(200);
        expect(await avisosAula(ctx)).toHaveLength(0);
        expect((await request(app).get("/schedule/weekly")).body[0].indisponibilidades).toEqual([]);
      });

      it("quando a ocorrência é cancelada", async () => {
        const ctx = await comAviso();
        expect((await request(app).delete(ocorrencia(ctx.aula.id)).set(asGestao())).status).toBe(204);
        expect(await avisosAula(ctx)).toHaveLength(0);
      });

      it("quando a ocorrência é alterada depois do aviso, mesmo mantendo o professor", async () => {
        const ctx = await comAviso();
        const res = await request(app).put(ocorrencia(ctx.aula.id)).set(asGestao()).send({ horarioInicio: "09:00", horarioFim: "11:00" });
        expect(res.status).toBe(200);
        expect(await avisosAula(ctx)).toHaveLength(0);
      });

      it("quando a série da aula é editada depois do aviso", async () => {
        const ctx = await comAviso();
        const res = await request(app).put(`/schedule/${ctx.aula.id}`).send({ sala: "Sala 10" });
        expect(res.status).toBe(200);
        expect(await avisosAula(ctx)).toHaveLength(0);
        expect((await request(app).get("/schedule/weekly")).body[0].indisponibilidades).toEqual([]);
      });

      it("não some por uma exceção anterior ao aviso, e mostra a data e o horário efetivos", async () => {
        const ctx = await setup();
        await prisma.aulaExcecao.create({
          data: { aulaId: ctx.aula.id, dataOriginal: day("2026-10-28"), data: day("2026-10-29"), horarioInicio: time("14:00"), horarioFim: time("16:00"), professorId: ctx.profB.id }
        });
        avancar();
        await request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profB.id));
        const [aviso] = await avisosAula(ctx);
        expect(aviso).toMatchObject({ professor: { id: ctx.profB.id }, data: "2026-10-29", horarioInicio: "14:00", horarioFim: "16:00", dataOriginal: "2026-10-28" });
      });

      it("quando o início efetivo passa", async () => {
        const ctx = await comAviso();
        setNow(QUARTA_0830);
        expect(await avisosAula(ctx)).toHaveLength(0);
        setNow(QUARTA_1030);
        expect(await avisosAula(ctx)).toHaveLength(0);
      });

      it("quando a aula é excluída", async () => {
        const ctx = await comAviso();
        await request(app).delete(`/schedule/${ctx.aula.id}`);
        expect(await avisosAula(ctx)).toHaveLength(0);
      });
    });

    describe("aviso de evento some", () => {
      async function comAviso() {
        const ctx = await setup();
        const eventoId = await criarEvento(ctx, [ctx.profA.id, ctx.profB.id]);
        await responder(eventoId, ctx.profA.id, "RECUSADO");
        expect(await avisosEvento(ctx)).toHaveLength(1);
        return { ctx, eventoId };
      }

      it("quando o evento é remarcado", async () => {
        const { ctx, eventoId } = await comAviso();
        const res = await request(app).put(`/meetings/${eventoId}`).set(asGestor(ctx.gestor.id)).send({ horarioInicio: "15:00", horarioFim: "17:00" });
        expect(res.status).toBe(200);
        expect(await avisosEvento(ctx)).toHaveLength(0);
      });

      it("quando o professor sai do evento", async () => {
        const { ctx, eventoId } = await comAviso();
        const res = await request(app).put(`/meetings/${eventoId}`).set(asGestor(ctx.gestor.id)).send({ participanteIds: [ctx.profB.id] });
        expect(res.status).toBe(200);
        expect(await avisosEvento(ctx)).toHaveLength(0);
      });

      it("quando o professor muda a resposta", async () => {
        const { ctx, eventoId } = await comAviso();
        await responder(eventoId, ctx.profA.id, "CONFIRMADO");
        expect(await avisosEvento(ctx)).toHaveLength(0);
      });

      it("quando o evento é excluído", async () => {
        const { ctx, eventoId } = await comAviso();
        await request(app).delete(`/meetings/${eventoId}`).set(asGestor(ctx.gestor.id));
        expect(await avisosEvento(ctx)).toHaveLength(0);
      });

      it("quando o início do evento passa", async () => {
        const { ctx } = await comAviso();
        setNow(EVENTO_DEPOIS);
        expect(await avisosEvento(ctx)).toHaveLength(0);
      });
    });

    describe("ciente", () => {
      it("dispensa o aviso do evento, que volta se o professor recusar de novo", async () => {
        const ctx = await setup();
        const eventoId = await criarEvento(ctx, [ctx.profA.id]);
        await responder(eventoId, ctx.profA.id, "RECUSADO");
        const [aviso] = await avisosEvento(ctx);

        expect((await request(app).post(`/notices/${aviso.id}/ciente`).set(asGestor(ctx.gestor.id))).status).toBe(204);
        expect(await avisosEvento(ctx)).toHaveLength(0);

        await responder(eventoId, ctx.profA.id, "CONFIRMADO");
        await responder(eventoId, ctx.profA.id, "RECUSADO");
        expect(await avisosEvento(ctx)).toHaveLength(1);
      });

      it("mantém a aula cinza para o professor após o ciente", async () => {
        const ctx = await setup();
        await request(app).post(indisponivel(ctx.aula.id)).set(asTeacher(ctx.profA.id));
        const [aviso] = await avisosAula(ctx);
        await request(app).post(`/notices/${aviso.id}/ciente`).set(asGestor(ctx.gestor.id));
        expect(await avisosAula(ctx)).toHaveLength(0);
        expect((await request(app).get("/schedule/weekly")).body[0].indisponibilidades).toHaveLength(1);
      });

      it("devolve 404 para aviso inexistente ou id inválido", async () => {
        const ctx = await setup();
        for (const id of ["aula:inexistente", "evento:inexistente", "outro:1", "aula:", "semtipo"]) {
          expect((await request(app).post(`/notices/${id}/ciente`).set(asGestor(ctx.gestor.id))).status).toBe(404);
        }
      });
    });
  });
});
