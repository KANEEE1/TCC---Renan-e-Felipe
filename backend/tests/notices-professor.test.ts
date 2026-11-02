import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signAuthToken } from "../src/shared/auth.js";
import { prisma } from "../src/shared/prisma.js";
import { app, asTeacher, createUser, resetDb } from "./helpers.js";

// America/Sao_Paulo é UTC-3. 2026-10-28 é quarta; aula semanal QUARTA 08:00-10:00 do Prof A. Evento em 2026-11-10 14:00-16:00.
const ANTES = "2026-10-20T12:00:00Z";
const QUARTA_0830 = "2026-10-28T11:30:00Z";
const EVENTO_DEPOIS = "2026-11-10T18:00:00Z"; // 15:00 em SP, dentro do evento

function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const day = (iso: string) => new Date(iso);
const asGestor = (id: string) => ({ Authorization: `Bearer ${signAuthToken({ sub: id, roles: ["GESTAO"] })}` });
const ocorrencia = (aulaId: string, dataOriginal = "2026-10-28") => `/schedule/${aulaId}/ocorrencias/${dataOriginal}`;

async function setup() {
  const turma = await prisma.turma.create({
    data: { nome: "Turma Conv", anoLetivo: 2026, gradeInicio: day("2026-10-01"), gradeFim: day("2026-12-31") }
  });
  const disciplina = await prisma.disciplina.create({ data: { nome: "Química", nomeNormalizado: "quimica" } });
  const gestor = await createUser({ email: "g@conv.com", roles: ["GESTAO"], name: "Gestor" });
  const profA = await createUser({ email: "a@conv.com", roles: ["PROFESSOR"], name: "Prof A" });
  const profB = await createUser({ email: "b@conv.com", roles: ["PROFESSOR"], name: "Prof B" });
  const profC = await createUser({ email: "c@conv.com", roles: ["PROFESSOR"], name: "Prof C" });
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
  return { turma, disciplina, gestor, profA, profB, profC, aula };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const editar = (ctx: Ctx, professorId: string, dataOriginal = "2026-10-28", extra: object = {}) =>
  request(app).put(ocorrencia(ctx.aula.id, dataOriginal)).set(asGestor(ctx.gestor.id)).send({ professorId, ...extra });
const meus = async (userId: string) => {
  const res = await request(app).get("/notices/mine").set(asTeacher(userId));
  expect(res.status).toBe(200);
  return res.body as { convocacoes: any[]; retiradas: any[] };
};
const responder = (id: string, userId: string, status: string) =>
  request(app).put(`/notices/mine/convocacoes/${id}`).set(asTeacher(userId)).send({ status });
const avisosDaGestao = async (ctx: Ctx) => (await request(app).get("/notices").set(asGestor(ctx.gestor.id))).body as any[];

describe("avisos do professor: convocação e retirada", () => {
  beforeEach(async () => {
    await resetDb();
    setNow(ANTES);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("aula (edição de uma ocorrência)", () => {
    it("trocar o professor convoca o novo e avisa a retirada do antigo", async () => {
      const ctx = await setup();
      expect((await editar(ctx, ctx.profB.id)).status).toBe(200);

      const b = await meus(ctx.profB.id);
      expect(b.retiradas).toEqual([]);
      expect(b.convocacoes).toEqual([
        {
          id: expect.any(String),
          aulaId: ctx.aula.id,
          dataOriginal: "2026-10-28",
          data: "2026-10-28",
          horarioInicio: "08:00",
          horarioFim: "10:00",
          disciplina: "Química",
          turma: "Turma Conv",
          remarcada: false
        }
      ]);

      const a = await meus(ctx.profA.id);
      expect(a.convocacoes).toEqual([]);
      expect(a.retiradas).toEqual([
        { id: expect.any(String), tipo: "RETIRADO_AULA", titulo: "Química", turma: "Turma Conv", data: "2026-10-28", horarioInicio: "08:00", horarioFim: "10:00" }
      ]);
    });

    it("editar sem mudar professor, data nem horário não gera nada", async () => {
      const ctx = await setup();
      expect((await editar(ctx, ctx.profA.id)).status).toBe(200);
      expect(await prisma.convocacaoAula.count()).toBe(0);
      expect(await prisma.avisoProfessor.count()).toBe(0);
    });

    describe("remarcação (mesmo professor, data ou horário mudou)", () => {
      it("remarcar a data convoca o mesmo professor com convocação remarcada", async () => {
        const ctx = await setup();
        expect((await editar(ctx, ctx.profA.id, "2026-10-28", { data: "2026-10-29" })).status).toBe(200);
        const a = await meus(ctx.profA.id);
        expect(a.retiradas).toEqual([]);
        expect(a.convocacoes).toEqual([expect.objectContaining({ data: "2026-10-29", dataOriginal: "2026-10-28", remarcada: true })]);
      });

      it("remarcar só o horário também convoca, reabrindo uma convocação já respondida", async () => {
        const ctx = await setup();
        await prisma.convocacaoAula.create({
          data: { aulaId: ctx.aula.id, dataOriginal: day("2026-10-28"), professorId: ctx.profA.id, status: "CONFIRMADO" }
        });
        expect((await editar(ctx, ctx.profA.id, "2026-10-28", { horarioInicio: "09:00", horarioFim: "11:00" })).status).toBe(200);
        expect(await prisma.convocacaoAula.count()).toBe(1);
        expect((await meus(ctx.profA.id)).convocacoes).toEqual([expect.objectContaining({ horarioInicio: "09:00", remarcada: true })]);
      });

      it("o editor não recebe a convocação remarcada", async () => {
        const ctx = await setup();
        const asProfA = { Authorization: `Bearer ${signAuthToken({ sub: ctx.profA.id, roles: ["GESTAO", "PROFESSOR"] })}` };
        expect((await request(app).put(ocorrencia(ctx.aula.id)).set(asProfA).send({ data: "2026-10-29" })).status).toBe(200);
        expect(await prisma.convocacaoAula.count()).toBe(0);
      });

      it("trocar o professor e a data mantém convocação normal para o novo e retirada para o anterior", async () => {
        const ctx = await setup();
        expect((await editar(ctx, ctx.profB.id, "2026-10-28", { data: "2026-10-29" })).status).toBe(200);
        expect((await meus(ctx.profB.id)).convocacoes).toEqual([expect.objectContaining({ remarcada: false })]);
        const a = await meus(ctx.profA.id);
        expect(a.convocacoes).toEqual([]);
        expect(a.retiradas).toHaveLength(1);
      });

      it("responder zera a marca de remarcada e Não vou avisa a gestão", async () => {
        const ctx = await setup();
        await editar(ctx, ctx.profA.id, "2026-10-28", { data: "2026-10-29" });
        const [convocacao] = (await meus(ctx.profA.id)).convocacoes;
        expect((await responder(convocacao.id, ctx.profA.id, "RECUSADO")).status).toBe(200);
        expect((await prisma.convocacaoAula.findUnique({ where: { id: convocacao.id } }))?.remarcada).toBe(false);
        expect((await meus(ctx.profA.id)).convocacoes).toEqual([]);
        expect(await avisosDaGestao(ctx)).toHaveLength(1);
      });
    });

    it("editar a série (PUT /schedule/:id) não gera convocação nem retirada", async () => {
      const ctx = await setup();
      const res = await request(app).put(`/schedule/${ctx.aula.id}`).set(asGestor(ctx.gestor.id)).send({ professorId: ctx.profB.id });
      expect(res.status).toBe(200);
      expect(await prisma.convocacaoAula.count()).toBe(0);
      expect(await prisma.avisoProfessor.count()).toBe(0);
    });

    it("ocorrência que já começou não pode ser editada e não gera nada", async () => {
      const ctx = await setup();
      setNow(QUARTA_0830);
      expect((await editar(ctx, ctx.profB.id)).status).toBe(409);
      expect(await prisma.convocacaoAula.count()).toBe(0);
      expect(await prisma.avisoProfessor.count()).toBe(0);
    });

    it("não notifica o próprio editor", async () => {
      const ctx = await setup();
      const editor = await createUser({ email: "ed@conv.com", roles: ["GESTAO", "PROFESSOR"], name: "Editor" });
      const asEditor = { Authorization: `Bearer ${signAuthToken({ sub: editor.id, roles: ["GESTAO", "PROFESSOR"] })}` };
      expect((await request(app).put(ocorrencia(ctx.aula.id)).set(asEditor).send({ professorId: editor.id })).status).toBe(200);
      expect(await prisma.convocacaoAula.count()).toBe(0);
      expect((await meus(ctx.profA.id)).retiradas).toHaveLength(1);

      await prisma.avisoProfessor.deleteMany();
      expect((await request(app).put(ocorrencia(ctx.aula.id)).set(asEditor).send({ professorId: ctx.profB.id })).status).toBe(200);
      expect(await prisma.convocacaoAula.count()).toBe(1);
      expect(await prisma.avisoProfessor.count()).toBe(0);
    });

    it("confirmar tira a convocação da lista e não avisa a gestão", async () => {
      const ctx = await setup();
      await editar(ctx, ctx.profB.id);
      const [convocacao] = (await meus(ctx.profB.id)).convocacoes;

      const res = await responder(convocacao.id, ctx.profB.id, "CONFIRMADO");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: convocacao.id, status: "CONFIRMADO" });
      expect((await meus(ctx.profB.id)).convocacoes).toEqual([]);
      expect(await avisosDaGestao(ctx)).toEqual([]);
    });

    it("recusar gera o aviso de indisponibilidade da gestão e a aula continua com o professor", async () => {
      const ctx = await setup();
      await editar(ctx, ctx.profB.id);
      const [convocacao] = (await meus(ctx.profB.id)).convocacoes;

      expect((await responder(convocacao.id, ctx.profB.id, "RECUSADO")).status).toBe(200);
      expect((await meus(ctx.profB.id)).convocacoes).toEqual([]);

      const avisos = await avisosDaGestao(ctx);
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toMatchObject({ tipo: "AULA", professor: { id: ctx.profB.id }, aulaId: ctx.aula.id, dataOriginal: "2026-10-28" });
      const agenda = await request(app).get("/schedule/weekly");
      expect(agenda.body[0].indisponibilidades).toEqual([{ dataOriginal: "2026-10-28", professorId: ctx.profB.id }]);
    });

    it("trocar de novo invalida a convocação anterior e avisa a retirada; voltar reabre como pendente", async () => {
      const ctx = await setup();
      await editar(ctx, ctx.profB.id);
      const [convB] = (await meus(ctx.profB.id)).convocacoes;
      expect((await responder(convB.id, ctx.profB.id, "CONFIRMADO")).status).toBe(200);

      expect((await editar(ctx, ctx.profC.id)).status).toBe(200);
      expect((await meus(ctx.profC.id)).convocacoes).toHaveLength(1);
      const b = await meus(ctx.profB.id);
      expect(b.convocacoes).toEqual([]);
      expect(b.retiradas).toHaveLength(1);

      // A convocação antiga do B já não vale para responder.
      expect((await responder(convB.id, ctx.profB.id, "RECUSADO")).status).toBe(409);

      // B volta a ser escalado: a convocação reabre como pendente e a retirada some.
      expect((await editar(ctx, ctx.profB.id)).status).toBe(200);
      const b2 = await meus(ctx.profB.id);
      expect(b2.retiradas).toEqual([]);
      expect(b2.convocacoes.map((c) => c.id)).toEqual([convB.id]);
      expect(await prisma.convocacaoAula.count()).toBe(2);
    });

    it("convocação de uma ocorrência movida mostra a data efetiva", async () => {
      const ctx = await setup();
      await editar(ctx, ctx.profB.id, "2026-10-28", { data: "2026-10-30", horarioInicio: "14:00", horarioFim: "16:00" });
      const [convocacao] = (await meus(ctx.profB.id)).convocacoes;
      expect(convocacao).toMatchObject({ dataOriginal: "2026-10-28", data: "2026-10-30", horarioInicio: "14:00", horarioFim: "16:00" });
    });

    it("cancelar a ocorrência remove a convocação da lista", async () => {
      const ctx = await setup();
      await editar(ctx, ctx.profB.id);
      expect((await request(app).delete(ocorrencia(ctx.aula.id)).set(asGestor(ctx.gestor.id))).status).toBe(204);
      expect((await meus(ctx.profB.id)).convocacoes).toEqual([]);
    });

    it("os avisos somem quando a aula começa", async () => {
      const ctx = await setup();
      await editar(ctx, ctx.profB.id);
      setNow(QUARTA_0830);
      expect(await meus(ctx.profB.id)).toEqual({ convocacoes: [], retiradas: [] });
      expect(await meus(ctx.profA.id)).toEqual({ convocacoes: [], retiradas: [] });
      const [convocacao] = await prisma.convocacaoAula.findMany();
      expect((await responder(convocacao!.id, ctx.profB.id, "CONFIRMADO")).status).toBe(409);
    });

    it("só o dono responde (404 para outros); status inválido é 400; exige login", async () => {
      const ctx = await setup();
      await editar(ctx, ctx.profB.id);
      const [convocacao] = (await meus(ctx.profB.id)).convocacoes;

      expect((await request(app).put(`/notices/mine/convocacoes/${convocacao.id}`).send({ status: "CONFIRMADO" })).status).toBe(401);
      expect((await responder(convocacao.id, ctx.profC.id, "CONFIRMADO")).status).toBe(404);
      expect((await responder(convocacao.id, ctx.profA.id, "RECUSADO")).status).toBe(404);
      expect((await responder("inexistente", ctx.profB.id, "CONFIRMADO")).status).toBe(404);
      expect((await responder(convocacao.id, ctx.profB.id, "PENDENTE")).status).toBe(400);
      expect((await meus(ctx.profB.id)).convocacoes).toHaveLength(1);

      // Já respondida: não é mais vigente.
      expect((await responder(convocacao.id, ctx.profB.id, "CONFIRMADO")).status).toBe(200);
      expect((await responder(convocacao.id, ctx.profB.id, "RECUSADO")).status).toBe(409);
    });

    it("GET /notices/mine exige login e GET /notices continua restrito à gestão", async () => {
      const ctx = await setup();
      expect((await request(app).get("/notices/mine")).status).toBe(401);
      expect((await request(app).get("/notices").set(asTeacher(ctx.profA.id))).status).toBe(403);
    });
  });

  describe("ciente da retirada", () => {
    it("o ciente tira o aviso da lista; só o dono marca (404 para outros); exige login", async () => {
      const ctx = await setup();
      await editar(ctx, ctx.profB.id);
      const [retirada] = (await meus(ctx.profA.id)).retiradas;

      expect((await request(app).post(`/notices/mine/${retirada.id}/ciente`)).status).toBe(401);
      expect((await request(app).post(`/notices/mine/${retirada.id}/ciente`).set(asTeacher(ctx.profB.id))).status).toBe(404);
      expect((await meus(ctx.profA.id)).retiradas).toHaveLength(1);

      expect((await request(app).post(`/notices/mine/${retirada.id}/ciente`).set(asTeacher(ctx.profA.id))).status).toBe(204);
      expect((await meus(ctx.profA.id)).retiradas).toEqual([]);
      expect((await request(app).post("/notices/mine/inexistente/ciente").set(asTeacher(ctx.profA.id))).status).toBe(404);
    });
  });

  describe("evento", () => {
    async function criarEvento(ctx: Ctx, participanteIds: string[]) {
      const res = await request(app)
        .post("/meetings")
        .set(asGestor(ctx.gestor.id))
        .send({ titulo: "Reunião pedagógica", tipo: "REUNIAO", data: "2026-11-10", horarioInicio: "14:00", horarioFim: "16:00", participanteIds, turmaIds: [ctx.turma.id], semProfessores: true });
      expect(res.status).toBe(201);
      return res.body.id as string;
    }
    const atualizar = (ctx: Ctx, id: string, body: object) => request(app).put(`/meetings/${id}`).set(asGestor(ctx.gestor.id)).send(body);
    const meuStatus = async (id: string, userId: string) => (await request(app).get(`/meetings/${id}`).set(asTeacher(userId))).body.meuStatus;

    it("remover participante gera aviso de retirada, só para quem saiu", async () => {
      const ctx = await setup();
      const id = await criarEvento(ctx, [ctx.profA.id, ctx.profB.id]);
      expect((await atualizar(ctx, id, { participanteIds: [ctx.profA.id] })).status).toBe(200);

      expect((await meus(ctx.profB.id)).retiradas).toEqual([
        { id: expect.any(String), tipo: "RETIRADO_EVENTO", titulo: "Reunião pedagógica", turma: "Turma Conv", data: "2026-11-10", horarioInicio: "14:00", horarioFim: "16:00" }
      ]);
      expect((await meus(ctx.profA.id)).retiradas).toEqual([]);
      expect((await meus(ctx.profB.id)).convocacoes).toEqual([]);
    });

    it("o aviso de retirada sobrevive à exclusão do evento e some com o ciente", async () => {
      const ctx = await setup();
      const id = await criarEvento(ctx, [ctx.profA.id, ctx.profB.id]);
      await atualizar(ctx, id, { participanteIds: [ctx.profA.id] });
      expect((await request(app).delete(`/meetings/${id}`).set(asGestor(ctx.gestor.id))).status).toBe(204);

      const [retirada] = (await meus(ctx.profB.id)).retiradas;
      expect(retirada).toBeDefined();
      expect((await request(app).post(`/notices/mine/${retirada.id}/ciente`).set(asTeacher(ctx.profB.id))).status).toBe(204);
      expect((await meus(ctx.profB.id)).retiradas).toEqual([]);
    });

    it("adicionar participante gera o convite (meuStatus PENDENTE)", async () => {
      const ctx = await setup();
      const id = await criarEvento(ctx, [ctx.profA.id]);
      expect(await meuStatus(id, ctx.profB.id)).toBeNull();
      expect((await atualizar(ctx, id, { participanteIds: [ctx.profA.id, ctx.profB.id] })).status).toBe(200);
      expect(await meuStatus(id, ctx.profB.id)).toBe("PENDENTE");
      expect((await meus(ctx.profB.id)).retiradas).toEqual([]);
    });

    it("substituir um participante por outro convida o novo e avisa o antigo", async () => {
      const ctx = await setup();
      const id = await criarEvento(ctx, [ctx.profA.id]);
      await atualizar(ctx, id, { participanteIds: [ctx.profB.id] });
      expect(await meuStatus(id, ctx.profB.id)).toBe("PENDENTE");
      expect((await meus(ctx.profA.id)).retiradas).toHaveLength(1);
    });

    it("voltar ao evento apaga o aviso de retirada", async () => {
      const ctx = await setup();
      const id = await criarEvento(ctx, [ctx.profA.id, ctx.profB.id]);
      await atualizar(ctx, id, { participanteIds: [ctx.profA.id] });
      await atualizar(ctx, id, { participanteIds: [ctx.profA.id, ctx.profB.id] });
      expect((await meus(ctx.profB.id)).retiradas).toEqual([]);
    });

    it("editar sem alterar os participantes não gera retirada", async () => {
      const ctx = await setup();
      const id = await criarEvento(ctx, [ctx.profA.id, ctx.profB.id]);
      await atualizar(ctx, id, { titulo: "Novo título" });
      await atualizar(ctx, id, { participanteIds: [ctx.profA.id, ctx.profB.id] });
      expect(await prisma.avisoProfessor.count()).toBe(0);
    });

    it("evento que já começou não gera retirada; o aviso some quando o evento começa", async () => {
      const ctx = await setup();
      const id = await criarEvento(ctx, [ctx.profA.id, ctx.profB.id]);
      setNow(EVENTO_DEPOIS);
      await atualizar(ctx, id, { participanteIds: [ctx.profA.id] });
      expect(await prisma.avisoProfessor.count()).toBe(0);

      setNow(ANTES);
      await atualizar(ctx, id, { participanteIds: [ctx.profB.id] });
      expect((await meus(ctx.profA.id)).retiradas).toHaveLength(1);
      setNow(EVENTO_DEPOIS);
      expect((await meus(ctx.profA.id)).retiradas).toEqual([]);
    });

    it("o editor removido do evento não recebe aviso", async () => {
      const ctx = await setup();
      const editor = await createUser({ email: "ed2@conv.com", roles: ["GESTAO", "PROFESSOR"], name: "Editor" });
      const asEditor = { Authorization: `Bearer ${signAuthToken({ sub: editor.id, roles: ["GESTAO", "PROFESSOR"] })}` };
      const id = await criarEvento(ctx, [editor.id, ctx.profA.id]);
      expect((await request(app).put(`/meetings/${id}`).set(asEditor).send({ participanteIds: [ctx.profA.id] })).status).toBe(200);
      expect(await prisma.avisoProfessor.count()).toBe(0);
    });
  });

  describe("cancelamento", () => {
    const excluirOcorrencia = (ctx: Ctx, dataOriginal = "2026-10-28") =>
      request(app).delete(ocorrencia(ctx.aula.id, dataOriginal)).set(asGestor(ctx.gestor.id));
    const criarEvento = async (ctx: Ctx, participanteIds: string[]) =>
      (
        await request(app)
          .post("/meetings")
          .set(asGestor(ctx.gestor.id))
          .send({ titulo: "Reunião pedagógica", tipo: "REUNIAO", data: "2026-11-10", horarioInicio: "14:00", horarioFim: "16:00", participanteIds, turmaIds: [ctx.turma.id], semProfessores: true })
      ).body.id as string;

    it("excluir evento futuro avisa todos os participantes, menos quem excluiu", async () => {
      const ctx = await setup();
      const id = await criarEvento(ctx, [ctx.profA.id, ctx.profB.id, ctx.gestor.id]);
      await request(app).put(`/meetings/${id}/rsvp`).set(asTeacher(ctx.profA.id)).send({ status: "CONFIRMADO" });
      expect((await request(app).delete(`/meetings/${id}`).set(asGestor(ctx.gestor.id))).status).toBe(204);

      const esperado = [{ id: expect.any(String), tipo: "CANCELADO_EVENTO", titulo: "Reunião pedagógica", turma: "Turma Conv", data: "2026-11-10", horarioInicio: "14:00", horarioFim: "16:00" }];
      expect((await meus(ctx.profA.id)).retiradas).toEqual(esperado);
      expect((await meus(ctx.profB.id)).retiradas).toEqual(esperado);
      expect(await prisma.avisoProfessor.count({ where: { userId: ctx.gestor.id } })).toBe(0);
      expect((await meus(ctx.profC.id)).retiradas).toEqual([]);
    });

    it("evento que já começou não avisa", async () => {
      const ctx = await setup();
      const id = await criarEvento(ctx, [ctx.profA.id]);
      setNow(EVENTO_DEPOIS);
      expect((await request(app).delete(`/meetings/${id}`).set(asGestor(ctx.gestor.id))).status).toBe(204);
      expect(await prisma.avisoProfessor.count()).toBe(0);
    });

    it("cancelar ocorrência futura avisa o professor efetivo e invalida a convocação pendente", async () => {
      const ctx = await setup();
      await editar(ctx, ctx.profB.id);
      expect((await meus(ctx.profB.id)).convocacoes).toHaveLength(1);
      expect((await excluirOcorrencia(ctx)).status).toBe(204);

      const b = await meus(ctx.profB.id);
      expect(b.convocacoes).toEqual([]);
      expect(await prisma.convocacaoAula.count()).toBe(0);
      expect(b.retiradas).toEqual([
        { id: expect.any(String), tipo: "CANCELADO_AULA", titulo: "Química", turma: "Turma Conv", data: "2026-10-28", horarioInicio: "08:00", horarioFim: "10:00" }
      ]);
      // Prof A (antigo) só tem a retirada de quando foi trocado.
      expect((await meus(ctx.profA.id)).retiradas.map((r) => r.tipo)).toEqual(["RETIRADO_AULA"]);
    });

    it("o ciente remove o cancelamento; outro usuário não vê nem dá ciente (404)", async () => {
      const ctx = await setup();
      expect((await excluirOcorrencia(ctx)).status).toBe(204);
      const [aviso] = (await meus(ctx.profA.id)).retiradas;
      expect(aviso.tipo).toBe("CANCELADO_AULA");
      expect((await meus(ctx.profB.id)).retiradas).toEqual([]);
      expect((await request(app).post(`/notices/mine/${aviso.id}/ciente`).set(asTeacher(ctx.profB.id))).status).toBe(404);
      expect((await request(app).post(`/notices/mine/${aviso.id}/ciente`).set(asTeacher(ctx.profA.id))).status).toBe(204);
      expect((await meus(ctx.profA.id)).retiradas).toEqual([]);
    });

    it("ocorrência que já começou não pode ser cancelada e não gera aviso", async () => {
      const ctx = await setup();
      setNow(QUARTA_0830);
      expect((await excluirOcorrencia(ctx)).status).toBe(409);
      expect(await prisma.avisoProfessor.count()).toBe(0);
    });

    it("excluir a série inteira não gera aviso", async () => {
      const ctx = await setup();
      expect((await request(app).delete(`/schedule/${ctx.aula.id}`).set(asGestor(ctx.gestor.id))).status).toBe(204);
      expect(await prisma.avisoProfessor.count()).toBe(0);
    });
  });
});
