import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { app, asGestao, asTeacher, createUser, resetDb } from "./helpers.js";

const importar = (csv: string) => request(app).post("/students/importar").set(asGestao()).send({ csv });
const validar = (csv: string) => request(app).post("/students/importar/validacao").set(asGestao()).send({ csv });
const nomes = async () => (await prisma.aluno.findMany({ orderBy: { nome: "asc" } })).map((a) => a.nome);

describe("importação de alunos por planilha", () => {
  let turmaA: string;
  let turmaB: string;

  beforeEach(async () => {
    await resetDb();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    turmaA = (await prisma.turma.create({ data: { nome: "Turma A", anoLetivo: 2026 } })).id;
    turmaB = (await prisma.turma.create({ data: { nome: "Turma B", anoLetivo: 2026 } })).id;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is restricted to GESTAO", async () => {
    const prof = await createUser({ email: "p@imp.com", roles: ["PROFESSOR"] });
    const body = { csv: "aluno;numero;turma\nAna;1;Turma A" };
    for (const rota of ["/students/importar", "/students/importar/validacao"]) {
      expect((await request(app).post(rota).send(body)).status).toBe(401);
      expect((await request(app).post(rota).set(asTeacher(prof.id)).send(body)).status).toBe(403);
    }
    expect(await nomes()).toEqual([]);
  });

  it("validates without creating, then creates each student enrolled in the right class", async () => {
    const csv = "aluno;numero;turma\nAna Souza;01;Turma A\nBia Lima;;Turma B\n";

    const conferencia = await validar(csv);
    expect(conferencia.status).toBe(200);
    expect(conferencia.body).toEqual({ total: 2, erros: [] });
    expect(await nomes()).toEqual([]);

    const res = await importar(csv);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ importados: 2 });

    const alunos = await prisma.aluno.findMany({ include: { matriculas: true }, orderBy: { nome: "asc" } });
    expect(alunos[0]).toMatchObject({ nome: "Ana Souza", numero: "01" });
    expect(alunos[0].matriculas.map((m) => m.turmaId)).toEqual([turmaA]);
    expect(alunos[1]).toMatchObject({ nome: "Bia Lima", numero: null });
    expect(alunos[1].matriculas.map((m) => m.turmaId)).toEqual([turmaB]);
  });

  it.each([
    ["comma separator", "aluno,numero,turma\nAna,1,Turma A"],
    ["BOM and CRLF (Excel)", "\uFEFFaluno;numero;turma\r\nAna;1;Turma A\r\n"],
    ["CR line breaks (old Excel for Mac)", "aluno;numero;turma\rAna;1;Turma A\r"],
    ["accent and case in the header, other order", "TURMA;Número;Aluno\nTurma A;1;Ana"],
    ["blank rows at the end", "aluno;numero;turma\nAna;1;Turma A\n;;\n\n;;\n"],
    ["extra spaces around values", "aluno;numero;turma\n  Ana ;1; Turma  A \n"],
    ["empty extra fields", "aluno;numero;turma\nAna;1;Turma A;;"]
  ])("reads a file with %s", async (_caso, csv) => {
    expect((await importar(csv)).status).toBe(201);
    expect(await nomes()).toEqual(["Ana"]);
  });

  it("keeps separators, quotes and line numbers right in quoted fields", async () => {
    expect((await importar('aluno,numero,turma\n"Silva, Ana ""Aninha""",1,Turma A')).status).toBe(201);
    expect(await nomes()).toEqual(['Silva, Ana "Aninha"']);

    const res = await validar('aluno,numero,turma\n"Bia\nLima",1,Turma A\nCaio,2,Turma Z');
    expect(res.body.erros).toEqual(['Linha 4: a turma "Turma Z" não existe em 2026.']);
  });

  it("blocks everything and reports every problem with its line", async () => {
    await prisma.aluno.create({ data: { nome: "Já Existe" } });
    const csv = [
      "aluno;numero;turma",
      "Ok Um;1;Turma A",
      "Já Existe;2;Turma A",
      "Sem Sala;3;Turma Z",
      ";4;Turma A",
      "Sem Turma;5;",
      "Dobrado;6;Turma A",
      "Dobrado;7;Turma B",
      "Já Existe;8;Turma Z"
    ].join("\n");

    const res = await importar(csv);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("A planilha tem problemas; nenhum aluno foi cadastrado.");
    expect(res.body.erros).toEqual([
      'Linha 3: já existe um aluno chamado "Já Existe".',
      'Linha 4: a turma "Turma Z" não existe em 2026.',
      "Linha 5: o nome do aluno está vazio.",
      "Linha 6: a turma está vazia.",
      'Linha 8: "Dobrado" está repetido na planilha (já aparece na linha 7).',
      'Linha 9: já existe um aluno chamado "Já Existe"; a turma "Turma Z" não existe em 2026.'
    ]);
    expect(await nomes()).toEqual(["Já Existe"]);
    expect((await validar(csv)).body.erros).toEqual(res.body.erros);
  });

  it("compares student names exactly, ignoring only extra spaces", async () => {
    await prisma.aluno.create({ data: { nome: "Ana Souza" } });
    expect((await validar("aluno;numero;turma\n  Ana   Souza ;;Turma A")).body.erros).toHaveLength(1);
    expect((await validar("aluno;numero;turma\nANA SOUZA;;Turma A\nAna Sóuza;;Turma A")).body.erros).toEqual([]);
  });

  it("does not count a removed student as existing", async () => {
    await prisma.aluno.create({ data: { nome: "Ana Souza", removidoEm: new Date("2026-10-01T12:00:00Z") } });
    expect((await importar("aluno;numero;turma\nAna Souza;;Turma A")).status).toBe(201);
    expect(await prisma.aluno.count({ where: { nome: "Ana Souza", removidoEm: null } })).toBe(1);
  });

  it("only finds classes of the current school year", async () => {
    await prisma.turma.create({ data: { nome: "Turma Antiga", anoLetivo: 2025 } });
    const res = await validar("aluno;numero;turma\nAna;;Turma Antiga");
    expect(res.body.erros).toEqual(['Linha 2: a turma "Turma Antiga" não existe em 2026.']);
  });

  it("rejects unusable files", async () => {
    const colunas = "A primeira linha da planilha precisa ter as colunas aluno, numero e turma.";
    expect((await validar("nome;numero;sala\nAna;1;Turma A")).body.erros).toEqual([colunas]);
    expect((await validar("Ana;1;Turma A")).body.erros).toEqual([colunas]);
    expect((await validar("aluno;numero;turma\n;;\n")).body.erros).toEqual(["A planilha não tem nenhum aluno preenchido."]);
    expect((await validar('aluno;numero;turma\n"Ana;1;Turma A')).body.erros).toEqual(["A planilha tem aspas que não foram fechadas."]);
    expect((await validar("aluno,numero,turma\nSilva, Ana,1,Turma A")).body.erros).toEqual([
      'Linha 2: tem mais colunas que o cabeçalho. Se o nome tiver ",", coloque-o entre aspas.'
    ]);
    expect((await request(app).post("/students/importar").set(asGestao()).send({ csv: "" })).status).toBe(400);
  });

  it("does not create the same name twice when two imports run together", async () => {
    const csv = "aluno;numero;turma\nAna Souza;;Turma A";
    const respostas = await Promise.all([importar(csv), importar(csv)]);
    const status = respostas.map((r) => r.status).sort();
    expect(status[0]).toBe(201);
    expect([400, 409]).toContain(status[1]);
    expect(await prisma.aluno.count({ where: { nome: "Ana Souza" } })).toBe(1);
    expect(await prisma.matricula.count()).toBe(1);
  });

  it("imports the second time only what is not there yet, once the file is fixed", async () => {
    await importar("aluno;numero;turma\nAna;;Turma A");
    expect((await importar("aluno;numero;turma\nAna;;Turma A\nBia;;Turma A")).status).toBe(400);
    expect((await importar("aluno;numero;turma\nBia;;Turma A")).status).toBe(201);
    expect(await nomes()).toEqual(["Ana", "Bia"]);
  });
});
