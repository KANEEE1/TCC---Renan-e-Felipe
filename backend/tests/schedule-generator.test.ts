import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/shared/prisma.js";
import { parseTimeToDate } from "../src/shared/time.js";
import { app, asGestao, asTeacher, createUser, resetDb } from "./helpers.js";

async function setup() {
  const mat = await prisma.disciplina.create({ data: { nome: "Matemática", nomeNormalizado: "matematica" } });
  const fis = await prisma.disciplina.create({ data: { nome: "Física", nomeNormalizado: "fisica" } });
  const turma = await prisma.turma.create({ data: { nome: "T1", anoLetivo: 2026, gradeInicio: new Date("2026-08-03"), gradeFim: new Date("2026-12-18") } });
  const outra = await prisma.turma.create({ data: { nome: "T2", anoLetivo: 2026, gradeInicio: new Date("2026-08-03"), gradeFim: new Date("2026-12-18") } });
  await prisma.cargaDisciplinaTurma.createMany({
    data: [
      { turmaId: turma.id, disciplinaId: mat.id, aulasPorSemana: 2, duracaoMinutos: 60 },
      { turmaId: turma.id, disciplinaId: fis.id, aulasPorSemana: 1, duracaoMinutos: 60 }
    ]
  });
  const mk = async (email: string, name: string, disciplinaId: string) => {
    const user = await createUser({ email, name, roles: ["PROFESSOR"] });
    await prisma.user.update({ where: { id: user.id }, data: { disciplinas: { connect: { id: disciplinaId } } } });
    for (const dia of ["SEGUNDA", "TERCA"]) {
      await prisma.disponibilidade.create({
        data: {
          professorId: user.id,
          diaSemana: dia,
          horarioInicio: parseTimeToDate("08:00"),
          horarioFim: parseTimeToDate("12:00")
        }
      });
    }
    return user.id;
  };
  const p1 = await mk("p1@t.com", "Prof Um", mat.id);
  const p2 = await mk("p2@t.com", "Prof Dois", mat.id);
  const p3 = await mk("p3@t.com", "Prof Tres", fis.id);
  return { mat: mat.id, fis: fis.id, turmaId: turma.id, outraId: outra.id, p1, p2, p3 };
}

const janelas = [
  { diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "12:00" },
  { diaSemana: "TERCA", horarioInicio: "08:00", horarioFim: "12:00" }
];

function aula(disciplinaId: string, professorId: string, diaSemana = "SEGUNDA", horarioInicio = "08:00", horarioFim = "09:00") {
  return { disciplinaId, professorId, diaSemana, horarioInicio, horarioFim };
}

describe("janelas da turma", () => {
  beforeEach(resetDb);

  it("saves, replaces and lists ordered", async () => {
    const { turmaId } = await setup();
    const put = await request(app)
      .put(`/classes/${turmaId}/janelas`)
      .set(asGestao())
      .send({ janelas: [janelas[1], janelas[0]] });
    expect(put.status).toBe(200);
    expect(put.body).toEqual(janelas);

    const get = await request(app).get(`/classes/${turmaId}/janelas`);
    expect(get.body).toEqual(janelas);

    const clear = await request(app).put(`/classes/${turmaId}/janelas`).set(asGestao()).send({ janelas: [] });
    expect(clear.body).toEqual([]);
  });

  it("rejects overlap and invalid range, 404 and auth", async () => {
    const { turmaId, p1 } = await setup();
    const overlap = await request(app)
      .put(`/classes/${turmaId}/janelas`)
      .set(asGestao())
      .send({ janelas: [janelas[0], { diaSemana: "SEGUNDA", horarioInicio: "11:00", horarioFim: "13:00" }] });
    expect(overlap.status).toBe(400);

    const inverted = await request(app)
      .put(`/classes/${turmaId}/janelas`)
      .set(asGestao())
      .send({ janelas: [{ diaSemana: "SEGUNDA", horarioInicio: "12:00", horarioFim: "08:00" }] });
    expect(inverted.status).toBe(400);

    expect((await request(app).put(`/classes/${turmaId}/janelas`).send({ janelas: [] })).status).toBe(401);
    expect((await request(app).put(`/classes/${turmaId}/janelas`).set(asTeacher(p1)).send({ janelas: [] })).status).toBe(403);
    expect((await request(app).get("/classes/clxxxxxxxxxxxxxxxxxxxxxxx/janelas")).status).toBe(404);
  });
});

describe("POST /schedule/generate", () => {
  beforeEach(resetDb);

  const generate = (body: object) => request(app).post("/schedule/generate").set(asGestao()).send(body);

  it("requires gestao, matrix and windows", async () => {
    const { turmaId, outraId, p1 } = await setup();
    expect((await request(app).post("/schedule/generate").send({ turmaId })).status).toBe(401);
    expect(
      (await request(app).post("/schedule/generate").set(asTeacher(p1)).send({ turmaId })).status
    ).toBe(403);
    expect((await generate({ turmaId: "clxxxxxxxxxxxxxxxxxxxxxxx" })).status).toBe(404);
    expect((await generate({ turmaId })).status).toBe(400);
    await prisma.janelaTurma.create({
      data: { turmaId: outraId, diaSemana: "SEGUNDA", horarioInicio: parseTimeToDate("08:00"), horarioFim: parseTimeToDate("12:00") }
    });
    expect((await generate({ turmaId: outraId })).status).toBe(400);
  });

  it("returns 400 when the class has no grade period", async () => {
    const { turmaId } = await setup();
    await request(app).put(`/classes/${turmaId}/janelas`).set(asGestao()).send({ janelas });
    await prisma.turma.update({ where: { id: turmaId }, data: { gradeInicio: null, gradeFim: null } });
    const res = await generate({ turmaId });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Defina o período da grade");
  });

  it("proposes lessons without saving and honors excluded professors", async () => {
    const { turmaId, mat, p1, p2, p3 } = await setup();
    await request(app).put(`/classes/${turmaId}/janelas`).set(asGestao()).send({ janelas });

    const res = await generate({ turmaId });
    expect(res.status).toBe(200);
    expect(res.body.naoAlocados).toEqual([]);
    expect(res.body.aulasAtuais).toBe(0);
    expect(res.body.propostas).toHaveLength(3);
    const matProf = res.body.propostas.filter((p: { disciplinaId: string }) => p.disciplinaId === mat);
    expect([p1, p2]).toContain(matProf[0].professorId);
    expect(matProf[0].disciplinaNome).toBe("Matemática");
    expect(res.body.propostas.find((p: { professorId: string }) => p.professorId === p3).professorNome).toBe("Prof Tres");
    expect(await prisma.aula.count()).toBe(0);

    const excl = await generate({ turmaId, professoresExcluidos: [p1, p2] });
    expect(excl.body.naoAlocados).toEqual([
      { disciplinaId: mat, disciplinaNome: "Matemática", faltantes: 2, motivo: "SEM_PROFESSOR" }
    ]);
    expect(excl.body.propostas).toHaveLength(1);
  });
});

describe("POST /schedule/replace", () => {
  beforeEach(resetDb);

  const replace = (body: object) => request(app).post("/schedule/replace").set(asGestao()).send(body);

  it("replaces the current grid", async () => {
    const { turmaId, mat, fis, p1, p3 } = await setup();
    await prisma.aula.create({
      data: { turmaId, disciplinaId: mat, professorId: p1, diaSemana: "TERCA", horarioInicio: parseTimeToDate("10:00"), horarioFim: parseTimeToDate("11:00") }
    });

    const res = await replace({ turmaId, aulas: [aula(mat, p1), aula(fis, p3, "TERCA")] });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ criadas: 2 });
    const aulas = await prisma.aula.findMany({ where: { turmaId } });
    expect(aulas).toHaveLength(2);
    expect(aulas.some((a) => a.diaSemana === "TERCA" && a.professorId === p1)).toBe(false);
  });

  it("auth and 404", async () => {
    const { turmaId, mat, p1 } = await setup();
    const body = { turmaId, aulas: [aula(mat, p1)] };
    expect((await request(app).post("/schedule/replace").send(body)).status).toBe(401);
    expect((await request(app).post("/schedule/replace").set(asTeacher(p1)).send(body)).status).toBe(403);
    expect((await replace({ ...body, turmaId: "clxxxxxxxxxxxxxxxxxxxxxxx" })).status).toBe(404);
  });

  it("409 when current grid has attendance", async () => {
    const { turmaId, mat, p1 } = await setup();
    const existente = await prisma.aula.create({
      data: { turmaId, disciplinaId: mat, professorId: p1, diaSemana: "TERCA", horarioInicio: parseTimeToDate("10:00"), horarioFim: parseTimeToDate("11:00") }
    });
    const aluno = await prisma.aluno.create({ data: { nome: "Aluno", email: "al@t.com" } as never });
    await prisma.presenca.create({ data: { alunoId: aluno.id, aulaId: existente.id, presente: true, data: new Date("2026-08-04") } });

    const res = await replace({ turmaId, aulas: [aula(mat, p1)] });
    expect(res.status).toBe(409);
    expect(res.body.aulasComRegistro).toBe(1);
    expect(await prisma.aula.count({ where: { turmaId } })).toBe(1);
  });

  it("409 when current grid has absences", async () => {
    const { turmaId, mat, p1 } = await setup();
    const existente = await prisma.aula.create({
      data: { turmaId, disciplinaId: mat, professorId: p1, diaSemana: "TERCA", horarioInicio: parseTimeToDate("10:00"), horarioFim: parseTimeToDate("11:00") }
    });
    await prisma.ausenciaAula.create({ data: { aulaId: existente.id, data: new Date("2026-08-04"), registradoPorId: p1 } });

    const res = await replace({ turmaId, aulas: [aula(mat, p1)] });
    expect(res.status).toBe(409);
    expect(res.body.aulasComRegistro).toBe(1);
  });

  it("409 on conflict with another class, changing nothing", async () => {
    const { turmaId, outraId, mat, fis, p1, p3 } = await setup();
    await prisma.aula.create({
      data: { turmaId, disciplinaId: fis, professorId: p3, diaSemana: "TERCA", horarioInicio: parseTimeToDate("10:00"), horarioFim: parseTimeToDate("11:00") }
    });
    await prisma.aula.create({
      data: { turmaId: outraId, disciplinaId: mat, professorId: p1, diaSemana: "SEGUNDA", horarioInicio: parseTimeToDate("08:30"), horarioFim: parseTimeToDate("09:30") }
    });

    const res = await replace({ turmaId, aulas: [aula(mat, p1)] });
    expect(res.status).toBe(409);
    const aulas = await prisma.aula.findMany({ where: { turmaId } });
    expect(aulas).toHaveLength(1);
    expect(aulas[0].professorId).toBe(p3);
  });

  it("409 on overlap among new lessons and 400 for discipline outside the matrix", async () => {
    const { turmaId, mat, p1, p2 } = await setup();
    const overlap = await replace({ turmaId, aulas: [aula(mat, p1), aula(mat, p2, "SEGUNDA", "08:30", "09:30")] });
    expect(overlap.status).toBe(409);

    const outra = await prisma.disciplina.create({ data: { nome: "Arte", nomeNormalizado: "arte" } });
    const res = await replace({ turmaId, aulas: [aula(outra.id, p1)] });
    expect(res.status).toBe(400);
  });

  it("400 when the professor does not teach the discipline or is inactive", async () => {
    const { turmaId, mat, fis, p1, p3 } = await setup();
    expect((await replace({ turmaId, aulas: [aula(fis, p1)] })).status).toBe(400);

    await prisma.user.update({ where: { id: p3 }, data: { ativo: false } });
    expect((await replace({ turmaId, aulas: [aula(fis, p3)] })).status).toBe(400);
    expect(await prisma.aula.count({ where: { turmaId } })).toBe(0);
    expect((await replace({ turmaId, aulas: [aula(mat, p1)] })).status).toBe(201);
  });
});

describe("geração de grade: cenários integrados", () => {
  beforeEach(resetDb);

  const generate = (body: object) => request(app).post("/schedule/generate").set(asGestao()).send(body);
  const disp = (professorId: string, dia: string, ini: string, fim: string) =>
    prisma.disponibilidade.create({
      data: { professorId, diaSemana: dia, horarioInicio: parseTimeToDate(ini), horarioFim: parseTimeToDate(fim) }
    });
  const mkProf = async (email: string, disciplinaId: string) => {
    const u = await createUser({ email, name: email, roles: ["PROFESSOR"] });
    await prisma.user.update({ where: { id: u.id }, data: { disciplinas: { connect: { id: disciplinaId } } } });
    return u.id;
  };

  it("full flow: classes -> janelas -> teachers -> generate -> replace -> by-class", async () => {
    const mat = await prisma.disciplina.create({ data: { nome: "Matemática", nomeNormalizado: "matematica" } });
    const turma = await prisma.turma.create({ data: { nome: "T1", anoLetivo: 2026, gradeInicio: new Date("2026-08-03"), gradeFim: new Date("2026-12-18") } });
    const put = await request(app)
      .put(`/classes/${turma.id}`)
      .set(asGestao())
      .send({ disciplinas: [{ disciplinaId: mat.id, aulasPorSemana: 2, duracaoMinutos: 60 }] });
    expect(put.status).toBe(200);
    expect((await request(app).put(`/classes/${turma.id}/janelas`).set(asGestao()).send({ janelas })).status).toBe(200);

    const prof = await createUser({ email: "f@t.com", name: "Fluxo", roles: ["PROFESSOR"] });
    const upd = await request(app).put(`/teachers/${prof.id}`).set(asGestao()).send({ disciplinaIds: [mat.id] });
    expect(upd.status).toBe(200);
    const av = await request(app)
      .post(`/teachers/${prof.id}/availability`)
      .set(asTeacher(prof.id))
      .send({ diaSemana: "SEGUNDA", horarioInicio: "08:00", horarioFim: "12:00" });
    expect(av.status).toBe(201);

    const gen = await generate({ turmaId: turma.id });
    expect(gen.status).toBe(200);
    expect(gen.body.naoAlocados).toEqual([]);
    expect(gen.body.propostas).toHaveLength(2);

    const rep = await request(app).post("/schedule/replace").set(asGestao()).send({ turmaId: turma.id, aulas: gen.body.propostas });
    expect(rep.status).toBe(201);
    expect(rep.body).toEqual({ criadas: 2 });

    const list = await request(app).get(`/schedule/by-class/${turma.id}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    const key = (a: { diaSemana: string; horarioInicio: string; horarioFim: string; professorId: string; disciplinaId: string }) =>
      `${a.diaSemana}|${a.horarioInicio.slice(-8, -3) || a.horarioInicio}|${a.professorId}|${a.disciplinaId}`;
    for (const p of gen.body.propostas) {
      expect(list.body.some((a: { diaSemana: string; professorId: string; disciplinaId: string }) =>
        a.diaSemana === p.diaSemana && a.professorId === p.professorId && a.disciplinaId === p.disciplinaId)).toBe(true);
    }
    void key;
  });

  it("avoids times when the professor already teaches another class", async () => {
    const { turmaId, outraId, mat, fis, p1, p2 } = await setup();
    await prisma.cargaDisciplinaTurma.deleteMany({ where: { turmaId, disciplinaId: fis } });
    await prisma.cargaDisciplinaTurma.updateMany({ where: { turmaId }, data: { aulasPorSemana: 1 } });
    await prisma.user.update({ where: { id: p2 }, data: { ativo: false } });
    await request(app).put(`/classes/${turmaId}/janelas`).set(asGestao()).send({ janelas: [janelas[0]] });
    await prisma.aula.create({
      data: { turmaId: outraId, disciplinaId: mat, professorId: p1, diaSemana: "SEGUNDA", horarioInicio: parseTimeToDate("08:00"), horarioFim: parseTimeToDate("09:00") }
    });
    const res = await generate({ turmaId });
    expect(res.body.propostas).toHaveLength(1);
    expect(res.body.propostas[0].professorId).toBe(p1);
    expect(res.body.propostas[0].horarioInicio).not.toBe("08:00");
  });

  it("ignores inactive and excluded professors", async () => {
    const { turmaId, mat, p1, p2 } = await setup();
    await request(app).put(`/classes/${turmaId}/janelas`).set(asGestao()).send({ janelas });
    await prisma.user.update({ where: { id: p1 }, data: { ativo: false } });
    const res = await generate({ turmaId });
    const m = res.body.propostas.filter((p: { disciplinaId: string }) => p.disciplinaId === mat);
    expect(m.length).toBe(2);
    expect(m.every((p: { professorId: string }) => p.professorId === p2)).toBe(true);

    const both = await generate({ turmaId, professoresExcluidos: [p2] });
    expect(both.body.naoAlocados[0]).toMatchObject({ disciplinaId: mat, motivo: "SEM_PROFESSOR", faltantes: 2 });
  });

  it("splits a discipline between professors when one only fits one lesson", async () => {
    const mat = await prisma.disciplina.create({ data: { nome: "Matemática", nomeNormalizado: "matematica" } });
    const turma = await prisma.turma.create({ data: { nome: "T1", anoLetivo: 2026, gradeInicio: new Date("2026-08-03"), gradeFim: new Date("2026-12-18") } });
    await prisma.cargaDisciplinaTurma.create({ data: { turmaId: turma.id, disciplinaId: mat.id, aulasPorSemana: 3, duracaoMinutos: 60 } });
    await request(app).put(`/classes/${turma.id}/janelas`).set(asGestao()).send({ janelas });
    const a = await mkProf("a@t.com", mat.id);
    const b = await mkProf("b@t.com", mat.id);
    await disp(a, "SEGUNDA", "08:00", "09:00");
    await disp(b, "SEGUNDA", "09:00", "10:00");
    await disp(b, "TERCA", "08:00", "09:00");

    const res = await generate({ turmaId: turma.id });
    expect(res.body.naoAlocados).toEqual([]);
    expect(res.body.propostas).toHaveLength(3);
    const ids = res.body.propostas.map((p: { professorId: string }) => p.professorId);
    expect(new Set(ids)).toEqual(new Set([a, b]));
    expect(ids.filter((i: string) => i === a)).toHaveLength(1);
  });

  it("window ending at 23:59 allows a lesson up to 23:59", async () => {
    const mat = await prisma.disciplina.create({ data: { nome: "Matemática", nomeNormalizado: "matematica" } });
    const turma = await prisma.turma.create({ data: { nome: "T1", anoLetivo: 2026, gradeInicio: new Date("2026-08-03"), gradeFim: new Date("2026-12-18") } });
    await prisma.cargaDisciplinaTurma.create({ data: { turmaId: turma.id, disciplinaId: mat.id, aulasPorSemana: 1, duracaoMinutos: 59 } });
    const put = await request(app)
      .put(`/classes/${turma.id}/janelas`)
      .set(asGestao())
      .send({ janelas: [{ diaSemana: "SEGUNDA", horarioInicio: "23:00", horarioFim: "23:59" }] });
    expect(put.status).toBe(200);
    const p = await mkProf("n@t.com", mat.id);
    await disp(p, "SEGUNDA", "23:00", "23:59");

    const res = await generate({ turmaId: turma.id });
    expect(res.status).toBe(200);
    expect(res.body.naoAlocados).toEqual([]);
    expect(res.body.propostas).toHaveLength(1);
    expect(res.body.propostas[0]).toMatchObject({ horarioInicio: "23:00", horarioFim: "23:59" });
  });
});
