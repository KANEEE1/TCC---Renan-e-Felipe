import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signAuthToken } from "../src/shared/auth.js";
import { prisma } from "../src/shared/prisma.js";
import { app, asTeacher, createUser, resetDb } from "./helpers.js";

// America/Sao_Paulo é UTC-3. Simulado em 2026-11-07 (sábado), 08:00-12:00 (SP), prazo da correção 2026-11-10.
const ANTES = "2026-11-06T12:00:00Z";
const DURANTE = "2026-11-07T13:00:00Z"; // 10:00 SP
const DEPOIS = "2026-11-07T15:30:00Z"; // 12:30 SP
const ULTIMO_DIA = "2026-11-11T02:30:00Z"; // 23:30 SP do dia 10
const VENCIDO = "2026-11-11T03:30:00Z"; // 00:30 SP do dia 11

function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

async function setup() {
  const gestor = await createUser({ email: "gestor@sim.com", roles: ["GESTAO"], name: "Gestor" });
  const profA = await createUser({ email: "a@sim.com", roles: ["PROFESSOR"], name: "Prof A" });
  const profB = await createUser({ email: "b@sim.com", roles: ["PROFESSOR"], name: "Prof B" });
  const profC = await createUser({ email: "c@sim.com", roles: ["PROFESSOR"], name: "Prof C" });
  const turmaA = await prisma.turma.create({ data: { nome: "Turma A", anoLetivo: 2026 } });
  const turmaB = await prisma.turma.create({ data: { nome: "Turma B", anoLetivo: 2026 } });
  const turmaC = await prisma.turma.create({ data: { nome: "Turma C", anoLetivo: 2026 } });
  const matricular = async (nome: string, turmaIds: string[], dataMatricula = "2026-10-01T12:00:00Z") => {
    const aluno = await prisma.aluno.create({ data: { nome } });
    for (const turmaId of turmaIds) {
      await prisma.matricula.create({ data: { alunoId: aluno.id, turmaId, dataMatricula: new Date(dataMatricula) } });
    }
    return aluno;
  };
  const ana = await matricular("Ana", [turmaA.id]);
  const bia = await matricular("Bia", [turmaA.id]);
  // Em duas turmas do simulado: conta uma vez, na primeira por nome (Turma A).
  const gabi = await matricular("Gabi", [turmaA.id, turmaB.id]);
  const caio = await matricular("Caio", [turmaB.id]);
  const duda = await matricular("Duda", [turmaC.id]);
  // Matriculada depois do simulado: não entra.
  const eva = await matricular("Eva", [turmaA.id], "2026-11-08T12:00:00Z");
  return {
    // Token assinado na hora: com o relógio adiantado, um token antigo já teria expirado.
    get gestorHeader() {
      return { Authorization: `Bearer ${signAuthToken({ sub: gestor.id, roles: ["GESTAO"] })}` };
    },
    gestor,
    profA, profB, profC, turmaA, turmaB, turmaC, ana, bia, gabi, caio, duda, eva };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const payloadDe = (ctx: Ctx, extra: Record<string, unknown> = {}) => ({
  titulo: "Simulado ENEM 1",
  tipo: "SIMULADO",
  data: "2026-11-07",
  horarioInicio: "08:00",
  horarioFim: "12:00",
  participanteIds: [ctx.profA.id],
  turmaIds: [ctx.turmaA.id, ctx.turmaB.id],
  corretorIds: [ctx.profA.id, ctx.profB.id],
  prazoCorrecao: "2026-11-10",
  pontuacaoMaxima: 90,
  ...extra
});

async function criarSimulado(ctx: Ctx, extra: Record<string, unknown> = {}) {
  const res = await request(app).post("/meetings").set(ctx.gestorHeader).send(payloadDe(ctx, extra));
  expect(res.status).toBe(201);
  return res.body.id as string;
}

type Nota = { alunoId: string; valor: number | null; ausente: boolean };
const lancar = (header: Record<string, string>, id: string, notas: Nota[], enviar?: boolean) =>
  request(app).put(`/simulados/${id}/notas`).set(header).send({ notas, enviar });
const nota = (alunoId: string, valor: number | null, ausente = false): Nota => ({ alunoId, valor, ausente });
const detalhe = async (ctx: Ctx, id: string, header: Record<string, string> = ctx.gestorHeader) =>
  (await request(app).get(`/simulados/${id}`).set(header)).body;
const alunoNoDetalhe = (body: any, alunoId: string) =>
  body.turmasComAlunos.flatMap((turma: any) => turma.alunos).find((aluno: any) => aluno.alunoId === alunoId);
const correcoesDe = async (userId: string) => (await request(app).get("/notices/mine").set(asTeacher(userId))).body.correcoes as any[];
const avisosDaGestao = async (ctx: Ctx) => (await request(app).get("/notices").set(ctx.gestorHeader)).body as any[];

describe("simulados", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("criação e edição pela agenda", () => {
    it("requires classes, graders (active teachers), deadline and max score", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const post = (extra: Record<string, unknown>) => request(app).post("/meetings").set(ctx.gestorHeader).send(payloadDe(ctx, extra));

      expect((await post({ turmaIds: [] })).status).toBe(400);
      expect((await post({ corretorIds: [] })).status).toBe(400);
      expect((await post({ prazoCorrecao: undefined })).status).toBe(400);
      expect((await post({ pontuacaoMaxima: undefined })).status).toBe(400);
      expect((await post({ pontuacaoMaxima: 0 })).status).toBe(400);
      const antes = await post({ prazoCorrecao: "2026-11-06" });
      expect(antes.status).toBe(400);
      expect(antes.body.message).toBe("O prazo da correção não pode ser antes da data do simulado");
      expect((await post({ corretorIds: [ctx.gestor.id] })).status).toBe(400);
      await prisma.user.update({ where: { id: ctx.profC.id }, data: { ativo: false } });
      expect((await post({ corretorIds: [ctx.profC.id] })).status).toBe(400);
      // Os campos do simulado não valem nos outros tipos.
      expect((await post({ tipo: "REUNIAO" })).status).toBe(400);

      const ok = await post({ prazoCorrecao: "2026-11-07" });
      expect(ok.status).toBe(201);
      expect(ok.body.corretores).toEqual([
        { userId: ctx.profA.id, name: "Prof A" },
        { userId: ctx.profB.id, name: "Prof B" }
      ]);
      expect(ok.body.pontuacaoMaxima).toBe(90);
      expect(ok.body.prazoCorrecao.slice(0, 10)).toBe("2026-11-07");

      const lista = await request(app).get("/simulados").set(asTeacher(ctx.profC.id));
      expect(lista.status).toBe(200);
      expect(lista.body).toHaveLength(1);
      expect(lista.body[0]).toMatchObject({ estado: "AGENDADO", lancados: 0, total: 4, media: null, pontuacaoMaxima: 90 });
    });

    it("locks score, classes and schedule once there are grades; graders and deadline until sent", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      const put = (body: object) => request(app).put(`/meetings/${id}`).set(ctx.gestorHeader).send(body);

      // Sem notas, tudo pode mudar.
      expect((await put({ pontuacaoMaxima: 100 })).status).toBe(200);
      expect((await put({ turmaIds: [ctx.turmaA.id, ctx.turmaB.id, ctx.turmaC.id] })).status).toBe(200);
      expect((await put({ turmaIds: [ctx.turmaA.id, ctx.turmaB.id], pontuacaoMaxima: 90 })).status).toBe(200);
      expect((await put({ prazoCorrecao: "2026-11-05" })).status).toBe(400);

      setNow(DEPOIS);
      expect((await lancar(asTeacher(ctx.profA.id), id, [nota(ctx.ana.id, 50)])).status).toBe(200);

      expect((await put({ pontuacaoMaxima: 100 })).status).toBe(409);
      expect((await put({ turmaIds: [ctx.turmaA.id] })).status).toBe(409);
      expect((await put({ data: "2026-11-08", prazoCorrecao: "2026-11-10" })).status).toBe(409);
      expect((await put({ horarioFim: "12:30" })).status).toBe(409);
      expect((await put({ tipo: "REUNIAO" })).status).toBe(409);
      // Os mesmos valores (o pop-up manda tudo) não travam.
      expect((await put(payloadDe(ctx, { titulo: "Simulado ENEM 1 (revisado)" }))).status).toBe(200);
      expect((await put({ corretorIds: [ctx.profA.id, ctx.profB.id, ctx.profC.id] })).status).toBe(200);
      expect((await put({ prazoCorrecao: "2026-11-12" })).status).toBe(200);

      expect((await request(app).delete(`/meetings/${id}`).set(ctx.gestorHeader)).status).toBe(409);

      const todos = [nota(ctx.ana.id, 50), nota(ctx.bia.id, 40), nota(ctx.gabi.id, null, true), nota(ctx.caio.id, 30)];
      expect((await lancar(ctx.gestorHeader, id, todos, true)).status).toBe(200);
      expect((await put({ corretorIds: [ctx.profA.id] })).status).toBe(409);
      expect((await put({ prazoCorrecao: "2026-11-13" })).status).toBe(409);
      expect((await put({ titulo: "Simulado final" })).status).toBe(200);
    });

    it("deletes a simulado without grades", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      expect((await request(app).delete(`/meetings/${id}`).set(ctx.gestorHeader)).status).toBe(204);
    });

    it("an old simulado without configuration is pending and editing it requires the configuration", async () => {
      const ctx = await setup();
      setNow(DEPOIS);
      const antigo = await prisma.reuniao.create({
        data: {
          titulo: "Simulado antigo",
          tipo: "SIMULADO",
          data: new Date("2026-11-07"),
          horarioInicio: new Date("1970-01-01T08:00:00Z"),
          horarioFim: new Date("1970-01-01T12:00:00Z"),
          semProfessores: true
        }
      });
      const lista = await request(app).get("/simulados").set(ctx.gestorHeader);
      expect(lista.body[0].estado).toBe("CONFIGURACAO_PENDENTE");
      expect((await lancar(ctx.gestorHeader, antigo.id, [nota(ctx.ana.id, 10)])).status).toBe(409);

      const put = (body: object) => request(app).put(`/meetings/${antigo.id}`).set(ctx.gestorHeader).send(body);
      expect((await put({ titulo: "Simulado antigo 2" })).status).toBe(400);
      const ok = await put({ turmaIds: [ctx.turmaA.id], corretorIds: [ctx.profA.id], prazoCorrecao: "2026-11-10", pontuacaoMaxima: 10 });
      expect(ok.status).toBe(200);
      expect((await detalhe(ctx, antigo.id)).estado).toBe("EM_CORRECAO");
    });
  });

  describe("lançamento das notas", () => {
    it("opens when the simulado ends, only for graders and management", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);

      setNow(DURANTE);
      expect((await lancar(asTeacher(ctx.profA.id), id, [nota(ctx.ana.id, 50)])).status).toBe(409);
      expect((await lancar(asTeacher(ctx.profC.id), id, [nota(ctx.ana.id, 50)])).status).toBe(403);
      expect((await detalhe(ctx, id, asTeacher(ctx.profA.id))).permissoes).toEqual({ lancar: false, enviar: false });

      setNow(DEPOIS);
      expect((await lancar(asTeacher(ctx.profC.id), id, [nota(ctx.ana.id, 50)])).status).toBe(403);
      const visto = await detalhe(ctx, id, asTeacher(ctx.profC.id));
      expect(visto.permissoes).toEqual({ lancar: false, enviar: false });
      expect((await detalhe(ctx, id, asTeacher(ctx.profA.id))).permissoes).toEqual({ lancar: true, enviar: true });
    });

    it("graders save partial progress, validate grades and send only when everyone is graded", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(DEPOIS);
      const profA = asTeacher(ctx.profA.id);
      const profB = asTeacher(ctx.profB.id);

      const parcial = await lancar(profA, id, [nota(ctx.ana.id, 70), nota(ctx.bia.id, null, true)]);
      expect(parcial.status).toBe(200);
      expect(parcial.body).toMatchObject({ estado: "EM_CORRECAO", lancados: 2, total: 4 });
      expect(alunoNoDetalhe(parcial.body, ctx.bia.id)).toMatchObject({ valor: null, ausente: true, lancado: true });

      // Outro corretor continua de onde parou.
      const continua = await lancar(profB, id, [nota(ctx.caio.id, 50.25)]);
      expect(continua.body.lancados).toBe(3);
      expect(alunoNoDetalhe(continua.body, ctx.ana.id)).toMatchObject({ valor: 70, ausente: false });

      expect((await lancar(profA, id, [nota(ctx.ana.id, 90.5)])).status).toBe(400);
      expect((await lancar(profA, id, [nota(ctx.ana.id, -1)])).status).toBe(400);
      expect((await lancar(profA, id, [nota(ctx.ana.id, 10.555)])).status).toBe(400);
      expect((await lancar(profA, id, [nota(ctx.ana.id, 10, true)])).status).toBe(400);
      expect((await lancar(profA, id, [nota(ctx.duda.id, 10)])).status).toBe(400);
      expect((await lancar(profA, id, [nota(ctx.eva.id, 10)])).status).toBe(400);

      // Sem nota e sem "Não presente" = limpar.
      const limpo = await lancar(profB, id, [nota(ctx.caio.id, null)]);
      expect(limpo.body.lancados).toBe(2);
      expect(alunoNoDetalhe(limpo.body, ctx.caio.id)).toMatchObject({ valor: null, ausente: false, lancado: false });

      // Enviar com faltando: 400 com quantos faltam, e nada da requisição é gravado (mesma transação).
      const incompleto = await lancar(profA, id, [nota(ctx.caio.id, 20)], true);
      expect(incompleto.status).toBe(400);
      expect(incompleto.body.message).toBe("Faltam 1 aluno sem nota ou Não presente");
      expect((await detalhe(ctx, id)).lancados).toBe(2);

      const enviado = await lancar(profA, id, [nota(ctx.caio.id, 20), nota(ctx.gabi.id, 0)], true);
      expect(enviado.status).toBe(200);
      expect(enviado.body.estado).toBe("ENVIADO");
      expect(enviado.body.correcaoEnviadaPor).toEqual({ id: ctx.profA.id, name: "Prof A" });
      expect(enviado.body.permissoes).toEqual({ lancar: false, enviar: false });

      // Fechado para todos os professores; a gestão continua editando.
      expect((await lancar(profA, id, [nota(ctx.ana.id, 60)])).status).toBe(409);
      expect((await lancar(profB, id, [nota(ctx.ana.id, 60)])).status).toBe(409);
      const gestao = await lancar(ctx.gestorHeader, id, [nota(ctx.ana.id, 60)]);
      expect(gestao.status).toBe(200);
      expect(alunoNoDetalhe(gestao.body, ctx.ana.id).valor).toBe(60);
      expect(gestao.body.permissoes).toEqual({ lancar: true, enviar: false });
      expect((await lancar(ctx.gestorHeader, id, [nota(ctx.ana.id, null)])).status).toBe(400);
      expect((await lancar(ctx.gestorHeader, id, [], true)).status).toBe(409);
    });

    it("averages ignore absent students, per class and overall; enrollment must be valid on the date", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(DEPOIS);

      const res = await lancar(asTeacher(ctx.profA.id), id, [
        nota(ctx.ana.id, 70),
        nota(ctx.bia.id, null, true),
        nota(ctx.gabi.id, 80),
        nota(ctx.caio.id, 30)
      ]);
      expect(res.body.media).toBe(60);
      const [turmaA, turmaB] = res.body.turmasComAlunos;
      expect(turmaA).toMatchObject({ nome: "Turma A", media: 75 });
      expect(turmaA.alunos.map((a: any) => a.nome)).toEqual(["Ana", "Bia", "Gabi"]);
      expect(turmaB).toMatchObject({ nome: "Turma B", media: 30 });
      expect(turmaB.alunos.map((a: any) => a.nome)).toEqual(["Caio"]);
      expect((await request(app).get("/simulados").set(asTeacher(ctx.profC.id))).body[0]).toMatchObject({ media: 60, lancados: 4, total: 4 });
    });
  });

  describe("avisos e prazo", () => {
    it("shows the grader notice after the end with progress, until it is sent", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);

      setNow(DURANTE);
      expect(await correcoesDe(ctx.profA.id)).toEqual([]);

      setNow(DEPOIS);
      expect(await correcoesDe(ctx.profA.id)).toEqual([
        {
          eventoId: id,
          titulo: "Simulado ENEM 1",
          data: "2026-11-07",
          horarioInicio: "08:00",
          horarioFim: "12:00",
          prazoCorrecao: "2026-11-10",
          lancados: 0,
          total: 4
        }
      ]);
      expect(await correcoesDe(ctx.profC.id)).toEqual([]);

      await lancar(asTeacher(ctx.profB.id), id, [nota(ctx.ana.id, 10)]);
      setNow(ULTIMO_DIA);
      expect((await correcoesDe(ctx.profA.id))[0].lancados).toBe(1);

      const todos = [nota(ctx.bia.id, 10), nota(ctx.gabi.id, 10), nota(ctx.caio.id, 10)];
      expect((await lancar(asTeacher(ctx.profB.id), id, todos, true)).status).toBe(200);
      expect(await correcoesDe(ctx.profA.id)).toEqual([]);
      expect(await correcoesDe(ctx.profB.id)).toEqual([]);
    });

    it("after the deadline gives automatic zeros to ungraded students, closes it and warns management once", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(DEPOIS);
      await lancar(asTeacher(ctx.profA.id), id, [nota(ctx.ana.id, 70), nota(ctx.bia.id, null, true)]);

      setNow(VENCIDO);
      expect(await correcoesDe(ctx.profA.id)).toEqual([]);
      const body = await detalhe(ctx, id);
      expect(body.estado).toBe("ENCERRADO");
      expect(alunoNoDetalhe(body, ctx.ana.id)).toMatchObject({ valor: 70, automatica: false });
      expect(alunoNoDetalhe(body, ctx.bia.id)).toMatchObject({ valor: null, ausente: true, automatica: false });
      expect(alunoNoDetalhe(body, ctx.gabi.id)).toMatchObject({ valor: 0, automatica: true });
      expect(alunoNoDetalhe(body, ctx.caio.id)).toMatchObject({ valor: 0, automatica: true });
      // O zero automático entra na média; o "Não presente", não.
      expect(body.media).toBeCloseTo(23.33, 2);

      const avisos = await avisosDaGestao(ctx);
      expect(avisos).toEqual([
        expect.objectContaining({ id: `simulado:${id}`, tipo: "SIMULADO", titulo: "Simulado ENEM 1", eventoId: id, zerados: 2, prazoCorrecao: "2026-11-10" })
      ]);

      // Idempotente: novas leituras não duplicam nem mexem nos zeros.
      await request(app).get("/simulados").set(ctx.gestorHeader);
      await avisosDaGestao(ctx);
      expect(await prisma.notaSimulado.count({ where: { reuniaoId: id } })).toBe(4);
      expect(await prisma.notaSimulado.count({ where: { reuniaoId: id, automatica: true } })).toBe(2);

      expect((await lancar(asTeacher(ctx.profA.id), id, [nota(ctx.caio.id, 40)])).status).toBe(409);
      const gestao = await lancar(ctx.gestorHeader, id, [nota(ctx.caio.id, 40)]);
      expect(gestao.status).toBe(200);
      expect(alunoNoDetalhe(gestao.body, ctx.caio.id)).toMatchObject({ valor: 40, automatica: false });
      expect((await avisosDaGestao(ctx))[0].zerados).toBe(1);

      expect((await request(app).post(`/notices/simulado:${id}/ciente`).set(ctx.gestorHeader)).status).toBe(204);
      expect(await avisosDaGestao(ctx)).toEqual([]);
      expect((await request(app).post(`/notices/simulado:${id}/ciente`).set(ctx.gestorHeader)).status).toBe(404);
    });

    it("the deadline day still counts and a fully graded simulado closes without a notice", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(DEPOIS);
      const todos = [nota(ctx.ana.id, 1), nota(ctx.bia.id, 2), nota(ctx.gabi.id, 3), nota(ctx.caio.id, null, true)];
      await lancar(asTeacher(ctx.profA.id), id, todos);

      setNow(ULTIMO_DIA);
      expect((await detalhe(ctx, id)).estado).toBe("EM_CORRECAO");

      setNow(VENCIDO);
      expect((await detalhe(ctx, id)).estado).toBe("ENCERRADO");
      expect(await prisma.notaSimulado.count({ where: { reuniaoId: id, automatica: true } })).toBe(0);
      expect(await avisosDaGestao(ctx)).toEqual([]);
    });
  });

  describe("bordas", () => {
    it("requires a token", async () => {
      expect((await request(app).get("/simulados")).status).toBe(401);
      expect((await request(app).get("/simulados/x")).status).toBe(401);
      expect((await request(app).put("/simulados/x/notas").send({ notas: [] })).status).toBe(401);
    });

    it("opens exactly at the end time and keeps the deadline day open until 23:59 (SP)", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      const profA = () => asTeacher(ctx.profA.id);

      setNow("2026-11-07T14:59:00Z"); // 11:59 SP
      expect((await lancar(profA(), id, [nota(ctx.ana.id, 10)])).status).toBe(409);
      setNow("2026-11-07T15:00:00Z"); // 12:00 SP
      expect((await lancar(profA(), id, [nota(ctx.ana.id, 10)])).status).toBe(200);

      setNow("2026-11-11T02:59:00Z"); // 23:59 SP do dia 10
      expect((await lancar(profA(), id, [nota(ctx.bia.id, 10)])).status).toBe(200);
      expect((await detalhe(ctx, id)).estado).toBe("EM_CORRECAO");
      setNow("2026-11-11T03:00:00Z"); // 00:00 SP do dia 11
      expect((await detalhe(ctx, id)).estado).toBe("ENCERRADO");
      expect((await lancar(profA(), id, [nota(ctx.gabi.id, 10)])).status).toBe(409);
    });

    it("management can send while grading is open", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(DEPOIS);
      const todos = [nota(ctx.ana.id, 1), nota(ctx.bia.id, 2), nota(ctx.gabi.id, null, true), nota(ctx.caio.id, 3)];
      const res = await lancar(ctx.gestorHeader, id, todos, true);
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe("ENVIADO");
      expect(res.body.correcaoEnviadaPor).toEqual({ id: ctx.gestor.id, name: "Gestor" });
    });

    it("a simulado without students can be sent", async () => {
      const ctx = await setup();
      const vazia = await prisma.turma.create({ data: { nome: "Turma Vazia", anoLetivo: 2026 } });
      setNow(ANTES);
      const id = await criarSimulado(ctx, { turmaIds: [vazia.id] });
      setNow(DEPOIS);
      const res = await lancar(asTeacher(ctx.profA.id), id, [], true);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ estado: "ENVIADO", total: 0, lancados: 0, media: null });
    });

    it("an expired deadline not yet consolidated cannot be reopened by editing", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(VENCIDO);
      const put = (body: object) => request(app).put(`/meetings/${id}`).set(ctx.gestorHeader).send(body);
      expect((await put({ prazoCorrecao: "2026-11-12" })).status).toBe(409);
      expect((await put({ corretorIds: [ctx.profC.id] })).status).toBe(409);
      expect((await detalhe(ctx, id)).estado).toBe("ENCERRADO");
    });

    it("a new or changed deadline cannot be in the past", async () => {
      const ctx = await setup();
      setNow("2026-11-09T15:00:00Z"); // dia 9 (SP), depois do simulado
      const post = (extra: Record<string, unknown>) => request(app).post("/meetings").set(ctx.gestorHeader).send(payloadDe(ctx, extra));
      const passado = await post({ prazoCorrecao: "2026-11-08" });
      expect(passado.status).toBe(400);
      expect(passado.body.message).toBe("O prazo da correção não pode estar no passado");
      const id = (await post({ prazoCorrecao: "2026-11-09" })).body.id as string;

      const put = (body: object) => request(app).put(`/meetings/${id}`).set(ctx.gestorHeader).send(body);
      expect((await put({ prazoCorrecao: "2026-11-08" })).status).toBe(400);
      expect((await put({ prazoCorrecao: "2026-11-11" })).status).toBe(200);
      // O prazo que não muda não é revalidado.
      expect((await put({ titulo: "Simulado ENEM 1b", prazoCorrecao: "2026-11-11" })).status).toBe(200);
    });

    it("other event types do not require graders, deadline or max score", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const reuniao = await request(app)
        .post("/meetings")
        .set(ctx.gestorHeader)
        .send({ titulo: "Reunião", tipo: "REUNIAO", data: "2026-11-07", horarioInicio: "08:00", horarioFim: "09:00", semProfessores: true });
      expect(reuniao.status).toBe(201);
      expect(reuniao.body).toMatchObject({ corretores: [], prazoCorrecao: null, pontuacaoMaxima: null });
      expect((await request(app).put(`/meetings/${reuniao.body.id}`).set(ctx.gestorHeader).send({ titulo: "Reunião 2" })).status).toBe(200);
      expect((await request(app).get("/simulados").set(ctx.gestorHeader)).body).toEqual([]);
    });

    it("saving an unchanged grade keeps the record untouched", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(VENCIDO);
      await detalhe(ctx, id);
      const antes = await prisma.notaSimulado.findUniqueOrThrow({ where: { reuniaoId_alunoId: { reuniaoId: id, alunoId: ctx.ana.id } } });
      expect(antes).toMatchObject({ valor: 0, automatica: true, lancadaPorId: null });
      expect((await lancar(ctx.gestorHeader, id, [nota(ctx.ana.id, 0)])).status).toBe(200);
      const depois = await prisma.notaSimulado.findUniqueOrThrow({ where: { reuniaoId_alunoId: { reuniaoId: id, alunoId: ctx.ana.id } } });
      expect(depois).toMatchObject({ valor: 0, automatica: true, lancadaPorId: null });
    });
  });

  describe("aluno removido", () => {
    const remover = (ctx: Ctx, alunoId: string) => request(app).delete(`/students/${alunoId}`).set(ctx.gestorHeader);

    it("leaves a simulado still in correction: grade deleted, does not block sending", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(DEPOIS);
      const profA = asTeacher(ctx.profA.id);
      await lancar(profA, id, [nota(ctx.ana.id, 70), nota(ctx.caio.id, 50)]);

      expect((await remover(ctx, ctx.caio.id)).status).toBe(204);
      expect(await prisma.notaSimulado.count({ where: { alunoId: ctx.caio.id } })).toBe(0);
      const body = await detalhe(ctx, id);
      expect(alunoNoDetalhe(body, ctx.caio.id)).toBeUndefined();
      expect(body).toMatchObject({ lancados: 1, total: 3 });
      expect((await lancar(profA, id, [nota(ctx.caio.id, 40)])).status).toBe(400);

      const enviado = await lancar(profA, id, [nota(ctx.bia.id, 30), nota(ctx.gabi.id, 20)], true);
      expect(enviado.status).toBe(200);
      expect(enviado.body.estado).toBe("ENVIADO");
    });

    it("gets no automatic zero when the deadline closes after the removal", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(DEPOIS);
      await remover(ctx, ctx.caio.id);
      setNow(VENCIDO);
      const body = await detalhe(ctx, id);
      expect(body.estado).toBe("ENCERRADO");
      expect(alunoNoDetalhe(body, ctx.caio.id)).toBeUndefined();
      expect(await prisma.notaSimulado.count({ where: { reuniaoId: id } })).toBe(3);
      expect(await prisma.notaSimulado.count({ where: { alunoId: ctx.caio.id } })).toBe(0);
    });

    it("keeps the grade in a finalized simulado, marked as removed and read-only", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(DEPOIS);
      await lancar(asTeacher(ctx.profA.id), id, [nota(ctx.ana.id, 70), nota(ctx.bia.id, 30), nota(ctx.gabi.id, 20), nota(ctx.caio.id, 50)], true);

      const medias = async () => ({
        turmaA: (await request(app).get(`/simulados/turma/${ctx.turmaA.id}`).set(ctx.gestorHeader)).body,
        turmaB: (await request(app).get(`/simulados/turma/${ctx.turmaB.id}`).set(ctx.gestorHeader)).body,
        caio: (await request(app).get(`/simulados/aluno/${ctx.caio.id}`).set(ctx.gestorHeader)).body
      });
      const antes = await medias();
      expect(antes.caio.media).not.toBeNull();

      await remover(ctx, ctx.caio.id);
      expect(await medias()).toEqual(antes);
      const body = await detalhe(ctx, id);
      expect(alunoNoDetalhe(body, ctx.caio.id)).toMatchObject({ nome: "Caio", valor: 50, removido: true });
      expect(alunoNoDetalhe(body, ctx.ana.id).removido).toBe(false);
      expect(body).toMatchObject({ lancados: 4, total: 4, media: 42.5 });
      expect((await lancar(ctx.gestorHeader, id, [nota(ctx.caio.id, 60)])).status).toBe(400);
    });
  });

  describe("notas do aluno", () => {
    const notasDe = (ctx: Ctx, alunoId: string) => request(app).get(`/simulados/aluno/${alunoId}`).set(ctx.gestorHeader);
    const enviarTudo = (ctx: Ctx, id: string, notas: Nota[]) => lancar(ctx.gestorHeader, id, notas, true);

    it("lists only finalized simulados in date order, as percent, ignoring absent in averages", async () => {
      const ctx = await setup();
      setNow("2026-11-01T12:00:00Z");
      const velho = await criarSimulado(ctx, { titulo: "Antigo", data: "2026-11-03", pontuacaoMaxima: 50 });
      const novo = await criarSimulado(ctx, { titulo: "Novo", data: "2026-11-07", pontuacaoMaxima: 90 });
      const aberto = await criarSimulado(ctx, { titulo: "Aberto", data: "2026-11-07", horarioInicio: "13:00", horarioFim: "14:00" });
      setNow(DEPOIS);
      // Antigo: Ana 25/50 = 50%, Bia 40/50 = 80%, Gabi ausente, Caio 0. Média da Turma A = 65%.
      await enviarTudo(ctx, velho, [nota(ctx.ana.id, 25), nota(ctx.bia.id, 40), nota(ctx.gabi.id, null, true), nota(ctx.caio.id, 0)]);
      // Novo: Ana 54/90 = 60%, Bia ausente, Gabi 90, Caio 45.
      await enviarTudo(ctx, novo, [nota(ctx.ana.id, 54), nota(ctx.bia.id, null, true), nota(ctx.gabi.id, 90), nota(ctx.caio.id, 45)]);
      await lancar(ctx.gestorHeader, aberto, [nota(ctx.ana.id, 10)]);

      const ana = await notasDe(ctx, ctx.ana.id);
      expect(ana.status).toBe(200);
      expect(ana.body.aluno).toEqual({ id: ctx.ana.id, nome: "Ana" });
      expect(ana.body.simulados.map((s: any) => s.titulo)).toEqual(["Antigo", "Novo"]);
      expect(ana.body.simulados[0]).toMatchObject({ valor: 25, pontuacaoMaxima: 50, percentual: 50, mediaTurmaPercentual: 65, ausente: false, turma: { nome: "Turma A" } });
      expect(ana.body.simulados[1]).toMatchObject({ valor: 54, percentual: 60, mediaTurmaPercentual: 80 });
      expect(ana.body.media).toBe(55);

      // Ausente: sem percentual e fora da média.
      const bia = await notasDe(ctx, ctx.bia.id);
      expect(bia.body.simulados[1]).toMatchObject({ valor: null, ausente: true, percentual: null });
      expect(bia.body.media).toBe(80);
    });

    it("counts the automatic zero and returns null average when nothing was graded", async () => {
      const ctx = await setup();
      setNow(ANTES);
      const id = await criarSimulado(ctx);
      setNow(DEPOIS);
      await lancar(ctx.gestorHeader, id, [nota(ctx.ana.id, 45)]);
      expect((await notasDe(ctx, ctx.bia.id)).body).toMatchObject({ media: null, simulados: [] });

      setNow(VENCIDO);
      const bia = (await notasDe(ctx, ctx.bia.id)).body;
      expect(bia.simulados[0]).toMatchObject({ valor: 0, automatica: true, percentual: 0, mediaTurmaPercentual: 16.67 });
      expect(bia.media).toBe(0);
      // Aluno de outra turma sem registro fica de fora.
      expect((await notasDe(ctx, ctx.duda.id)).body.simulados).toEqual([]);
    });

    it("requires a token and an existing student", async () => {
      const ctx = await setup();
      expect((await request(app).get(`/simulados/aluno/${ctx.ana.id}`)).status).toBe(401);
      expect((await request(app).get("/simulados/aluno/inexistente").set(ctx.gestorHeader)).status).toBe(404);
      expect((await request(app).get(`/simulados/aluno/${ctx.ana.id}`).set(asTeacher(ctx.profC.id))).status).toBe(200);
    });
  });
  describe("notas da turma", () => {
    const daTurma = (ctx: Ctx, turmaId: string) => request(app).get(`/simulados/turma/${turmaId}`).set(ctx.gestorHeader);
    const enviarTudo = (ctx: Ctx, id: string, notas: Nota[]) => lancar(ctx.gestorHeader, id, notas, true);

    it("lists only finalized simulados, ignoring absent, counting the automatic zero, with the overall average", async () => {
      const ctx = await setup();
      setNow("2026-11-01T12:00:00Z");
      const velho = await criarSimulado(ctx, { titulo: "Antigo", data: "2026-11-03", pontuacaoMaxima: 50 });
      const aberto = await criarSimulado(ctx, { titulo: "Aberto", data: "2026-11-07", horarioInicio: "13:00", horarioFim: "14:00" });
      setNow(DEPOIS);
      // Turma A: Ana 50%, Bia 80%, Gabi ausente (fica na Turma A). Turma B: Caio 0%.
      await enviarTudo(ctx, velho, [nota(ctx.ana.id, 25), nota(ctx.bia.id, 40), nota(ctx.gabi.id, null, true), nota(ctx.caio.id, 0)]);
      await lancar(ctx.gestorHeader, aberto, [nota(ctx.ana.id, 10)]);

      const a = await daTurma(ctx, ctx.turmaA.id);
      expect(a.status).toBe(200);
      expect(a.body.turma).toEqual({ id: ctx.turmaA.id, nome: "Turma A" });
      expect(a.body.simulados).toHaveLength(1);
      // Média geral do simulado inclui a Turma B: (50 + 80 + 0) / 3.
      expect(a.body.simulados[0]).toEqual({
        id: velho, titulo: "Antigo", data: "2026-11-03", pontuacaoMaxima: 50,
        mediaTurmaPercentual: 65, mediaGeralPercentual: 43.33, avaliados: 2, ausentes: 1
      });
      expect(a.body.media).toBe(65);

      // Zero automático (prazo vencido) conta na média da turma.
      setNow(VENCIDO);
      const b = (await daTurma(ctx, ctx.turmaB.id)).body;
      expect(b.simulados.map((s: any) => s.titulo)).toEqual(["Antigo", "Aberto"]);
      expect(b.simulados[1]).toMatchObject({ mediaTurmaPercentual: 0, avaliados: 1, ausentes: 0 });
    });

    it("averages the per-simulado averages with equal weight, skipping simulados with everyone absent", async () => {
      const ctx = await setup();
      setNow("2026-11-01T12:00:00Z");
      const s1 = await criarSimulado(ctx, { titulo: "S1", data: "2026-11-03", pontuacaoMaxima: 50 });
      const s2 = await criarSimulado(ctx, { titulo: "S2", data: "2026-11-05", pontuacaoMaxima: 100 });
      const s3 = await criarSimulado(ctx, { titulo: "S3", data: "2026-11-06", pontuacaoMaxima: 10 });
      setNow(DEPOIS);
      // S1: Ana 100%, Bia 50% -> 75%. S2: só Ana (20%), os outros ausentes -> 20%. S3: todos ausentes.
      await enviarTudo(ctx, s1, [nota(ctx.ana.id, 50), nota(ctx.bia.id, 25), nota(ctx.gabi.id, null, true), nota(ctx.caio.id, null, true)]);
      await enviarTudo(ctx, s2, [nota(ctx.ana.id, 20), nota(ctx.bia.id, null, true), nota(ctx.gabi.id, null, true), nota(ctx.caio.id, null, true)]);
      await enviarTudo(ctx, s3, [nota(ctx.ana.id, null, true), nota(ctx.bia.id, null, true), nota(ctx.gabi.id, null, true), nota(ctx.caio.id, null, true)]);

      const a = (await daTurma(ctx, ctx.turmaA.id)).body;
      expect(a.simulados.map((s: any) => s.mediaTurmaPercentual)).toEqual([75, 20, null]);
      expect(a.simulados[2]).toMatchObject({ mediaGeralPercentual: null, avaliados: 0, ausentes: 3 });
      expect(a.simulados[1]).toMatchObject({ avaliados: 1, ausentes: 2 });
      // (75 + 20) / 2, sem o simulado sem avaliados.
      expect(a.media).toBe(47.5);
    });

    it("returns null average without finalized simulados, requires a token and an existing class", async () => {
      const ctx = await setup();
      expect((await daTurma(ctx, ctx.turmaC.id)).body).toMatchObject({ media: null, simulados: [] });
      expect((await request(app).get(`/simulados/turma/${ctx.turmaA.id}`)).status).toBe(401);
      expect((await request(app).get("/simulados/turma/inexistente").set(ctx.gestorHeader)).status).toBe(404);
      expect((await request(app).get(`/simulados/turma/${ctx.turmaA.id}`).set(asTeacher(ctx.profC.id))).status).toBe(200);
    });
  });
});
