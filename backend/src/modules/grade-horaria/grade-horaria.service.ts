import { createHash, randomInt } from "node:crypto";
import { HttpError } from "../../shared/http.js";
import { agora } from "../../shared/clock.js";
import { diaSemanaOfDateOnly, formatTimeHHMM, parseDateOnly, parseTimeToDate, timeOfDayInSaoPaulo, todayInSaoPaulo } from "../../shared/time.js";
import type { DisponibilidadeService } from "../disponibilidade/disponibilidade.service.js";
import { allocate, overlaps } from "./grade-horaria.allocator.js";
import { allocateTurma, criarAleatorio, type PropostaTurma } from "./grade-horaria.turma-allocator.js";

// Quantas variações sorteadas tentar ao pedir uma grade diferente das já mostradas.
const TENTATIVAS_VARIACAO = 40;

// Identifica uma grade pelo conjunto de aulas (independe da ordem).
function assinaturaDaGrade(propostas: PropostaTurma[]) {
  const chave = propostas
    .map((p) => `${p.disciplinaId}|${p.professorId}|${p.diaSemana}|${p.horarioInicio}|${p.horarioFim}`)
    .sort()
    .join(";");
  return createHash("sha1").update(chave).digest("hex").slice(0, 16);
}

const faltantesDe = (naoAlocados: { faltantes: number }[]) => naoAlocados.reduce((soma, item) => soma + item.faltantes, 0);
import type {
  ConfirmScheduleInput,
  CreateAulaInput,
  GenerateScheduleInput,
  ReplaceScheduleInput,
  SuggestScheduleInput,
  UpdateAulaInput,
  UpdateOcorrenciaInput
} from "./grade-horaria.schemas.js";
import type { GradeHorariaRepository } from "./grade-horaria.repository.js";
import { dataDaSerie, dataNoPeriodo, gerarOcorrencias, isoDate, resolverOcorrencia, type AulaOcorrivel, type ExcecaoOcorrencia } from "./ocorrencias.js";

interface ExistingAula {
  id: string;
  professorId: string;
  turmaId: string;
  diaSemana: string;
  horarioInicio: Date;
  horarioFim: Date;
}

interface Conflito {
  aulaIndex: number;
  recurso: "PROFESSOR" | "TURMA";
  origem: "EXISTENTE" | "PROPOSTA";
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

function assertValidRange(horarioInicio: string, horarioFim: string) {
  if (horarioFim <= horarioInicio) {
    throw new HttpError(400, "Class end time must be after start time");
  }
}

interface ExcecaoComProfessor extends ExcecaoOcorrencia {
  professor: { id: string; name: string } | null;
}

function toExcecaoResponse(excecao: ExcecaoComProfessor) {
  return {
    dataOriginal: isoDate(excecao.dataOriginal),
    cancelada: excecao.cancelada,
    data: excecao.data ? isoDate(excecao.data) : null,
    horarioInicio: excecao.horarioInicio ? formatTimeHHMM(excecao.horarioInicio) : null,
    horarioFim: excecao.horarioFim ? formatTimeHHMM(excecao.horarioFim) : null,
    professor: excecao.professor
  };
}

export class GradeHorariaService {
  constructor(
    private readonly gradeHorariaRepository: GradeHorariaRepository,
    private readonly disponibilidadeService: DisponibilidadeService
  ) {}

  private withExcecoes<T extends { excecoes: ExcecaoComProfessor[] }>(aulas: T[]) {
    return aulas.map((aula) => ({ ...aula, excecoes: aula.excecoes.map(toExcecaoResponse) }));
  }

  async list() {
    return this.withExcecoes(await this.gradeHorariaRepository.list());
  }

  async getById(id: string) {
    const aula = await this.gradeHorariaRepository.findById(id);

    if (!aula) {
      throw new HttpError(404, "Class schedule entry not found");
    }

    return aula;
  }

  async listByTurma(turmaId: string) {
    return this.withExcecoes(await this.gradeHorariaRepository.listByTurma(turmaId));
  }

  listByProfessor(professorId: string) {
    return this.gradeHorariaRepository.listByProfessor(professorId);
  }

  async create(input: CreateAulaInput) {
    assertValidRange(input.horarioInicio, input.horarioFim);
    await this.assertNoConflicts([input]);

    return this.gradeHorariaRepository.create(input);
  }

  async update(id: string, input: UpdateAulaInput) {
    const current = await this.getById(id);

    if (input.horarioInicio && input.horarioFim) {
      assertValidRange(input.horarioInicio, input.horarioFim);
    }

    const merged: CreateAulaInput = {
      turmaId: input.turmaId ?? current.turmaId,
      disciplinaId: input.disciplinaId ?? current.disciplinaId,
      professorId: input.professorId ?? current.professorId,
      diaSemana: input.diaSemana ?? (current.diaSemana as CreateAulaInput["diaSemana"]),
      horarioInicio: input.horarioInicio ?? formatTimeHHMM(current.horarioInicio),
      horarioFim: input.horarioFim ?? formatTimeHHMM(current.horarioFim)
    };
    assertValidRange(merged.horarioInicio, merged.horarioFim);
    await this.assertNoConflicts([merged], id);
    if (input.turmaId || input.professorId || input.diaSemana || input.horarioInicio || input.horarioFim) {
      await this.assertSemConflitoComOcorrenciasMovidas(merged, id);
    }

    return this.gradeHorariaRepository.update(id, input);
  }

  async remove(id: string) {
    await this.getById(id);
    await this.gradeHorariaRepository.remove(id);
  }

  // Altera uma única ocorrência da série (data, horário e/ou professor). Grava um snapshot completo.
  editarOcorrencia(id: string, dataOriginal: string, input: UpdateOcorrenciaInput) {
    return this.gradeHorariaRepository.transaction(async (repository) => {
      const aula = await repository.findAulaParaOcorrencia(id);
      if (!aula) throw new HttpError(404, "Class schedule entry not found");

      const excecao = await repository.findExcecao(id, parseDateOnly(dataOriginal));
      this.assertOcorrenciaDaSerie(aula, excecao, dataOriginal);
      if (excecao?.cancelada) throw new HttpError(409, "A ocorrência está cancelada");

      const atual = resolverOcorrencia(aula, excecao ?? undefined, dataOriginal)!;
      this.assertNaoComecou(atual);
      const original = parseDateOnly(dataOriginal);
      if ((await repository.countPresencas(id, original)) > 0) {
        throw new HttpError(409, "A ocorrência já tem presença registrada e não pode ser alterada");
      }
      if ((await repository.countAusencias(id, original)) > 0) {
        throw new HttpError(409, "A ocorrência tem uma falta registrada e não pode ser alterada; cancele a falta antes");
      }
      const data = input.data ?? atual.data;
      const horarioInicio = input.horarioInicio ?? atual.horarioInicio;
      const horarioFim = input.horarioFim ?? atual.horarioFim;
      const professorId = input.professorId ?? atual.professorId;

      assertValidRange(horarioInicio, horarioFim);
      if (!dataNoPeriodo(aula.turma, data)) throw new HttpError(400, "A data está fora do período da grade");

      const professor = await repository.findProfessor(professorId);
      if (input.professorId && (!professor || !professor.ativo || !professor.roles.includes("PROFESSOR"))) {
        throw new HttpError(400, "Professor must be an active teacher");
      }

      // Conflitos com as demais ocorrências efetivas da data (do professor ou da turma).
      const fontes = await repository.carregarFontesDoDia(data);
      const outras = gerarOcorrencias(fontes.aulas, fontes.excecoes, data, data).filter(
        (oc) => !(oc.aulaId === id && oc.dataOriginal === dataOriginal)
      );
      if (outras.some((oc) => oc.aulaId === id)) {
        throw new HttpError(409, "Já existe outra ocorrência desta aula nesta data");
      }
      const conflitos = outras
        .filter((oc) => overlaps(horarioInicio, horarioFim, oc.horarioInicio, oc.horarioFim))
        .flatMap((oc) => [
          ...(oc.professorId === professorId ? [{ recurso: "PROFESSOR" as const, data, horarioInicio: oc.horarioInicio, horarioFim: oc.horarioFim }] : []),
          ...(oc.turmaId === aula.turmaId ? [{ recurso: "TURMA" as const, data, horarioInicio: oc.horarioInicio, horarioFim: oc.horarioFim }] : [])
        ]);
      if (conflitos.length > 0) {
        throw new HttpError(409, "Schedule conflicts with existing classes", { conflitos });
      }

      const salva = await repository.upsertExcecao(id, parseDateOnly(dataOriginal), {
        cancelada: false,
        data: parseDateOnly(data),
        horarioInicio: parseTimeToDate(horarioInicio),
        horarioFim: parseTimeToDate(horarioFim),
        professorId
      });
      const efetiva = resolverOcorrencia(aula, salva, dataOriginal)!;
      return {
        aulaId: efetiva.aulaId,
        dataOriginal: efetiva.dataOriginal,
        data: efetiva.data,
        horarioInicio: efetiva.horarioInicio,
        horarioFim: efetiva.horarioFim,
        professor: salva.professor,
        alterada: true
      };
    });
  }

  // Cancela uma única ocorrência da série (ex.: feriado). Presença registrada pelo professor impede.
  cancelarOcorrencia(id: string, dataOriginal: string) {
    return this.gradeHorariaRepository.transaction(async (repository) => {
      const aula = await repository.findAulaParaOcorrencia(id);
      if (!aula) throw new HttpError(404, "Class schedule entry not found");

      const data = parseDateOnly(dataOriginal);
      const excecao = await repository.findExcecao(id, data);
      this.assertOcorrenciaDaSerie(aula, excecao, dataOriginal);
      if (excecao?.cancelada) return;
      this.assertNaoComecou(resolverOcorrencia(aula, excecao ?? undefined, dataOriginal)!);

      if ((await repository.countSubstituicoesAceitas(id, data)) > 0) {
        throw new HttpError(409, "Há um substituto confirmado para esta aula; cancele a substituição antes");
      }
      if ((await repository.countPresencasManuais(id, data)) > 0) {
        throw new HttpError(409, "A ocorrência já tem presença registrada pelo professor e não pode ser cancelada");
      }

      await repository.limparRegistrosDaOcorrencia(id, data);
      await repository.upsertExcecao(id, data, { cancelada: true, data: null, horarioInicio: null, horarioFim: null, professorId: null });
    });
  }

  private assertNaoComecou(ocorrencia: { data: string; horarioInicio: string }) {
    const now = agora();
    const hoje = todayInSaoPaulo(now);
    if (ocorrencia.data < hoje || (ocorrencia.data === hoje && ocorrencia.horarioInicio <= timeOfDayInSaoPaulo(now))) {
      throw new HttpError(409, "Não é possível alterar uma aula que já aconteceu");
    }
  }

  // A data original precisa ser um dia da série (dia da semana + período) ou já ter exceção (série reeditada depois).
  private assertOcorrenciaDaSerie(aula: AulaOcorrivel, excecao: unknown, dataOriginal: string) {
    if (!excecao && !dataDaSerie(aula, dataOriginal)) {
      throw new HttpError(400, "A data não é uma ocorrência desta aula");
    }
  }

  async suggest(input: SuggestScheduleInput) {
    const professorIds = [...new Set(input.pedidos.map((pedido) => pedido.professorId))];
    const turmaIds = [...new Set(input.pedidos.map((pedido) => pedido.turmaId))];

    const pares = [...new Map(input.pedidos.map((p) => [`${p.turmaId}:${p.disciplinaId}`, { turmaId: p.turmaId, disciplinaId: p.disciplinaId }])).values()];
    const cargas = await this.gradeHorariaRepository.listCargas(pares);
    const duracoes = new Map(cargas.map((carga) => [`${carga.turmaId}:${carga.disciplinaId}`, carga.duracaoMinutos]));
    const semCarga = pares.filter((par) => !duracoes.has(`${par.turmaId}:${par.disciplinaId}`));
    if (semCarga.length > 0) {
      throw new HttpError(400, "Disciplina sem carga cadastrada na matriz da turma", { semCarga });
    }

    const [disponibilidades, aulas] = await Promise.all([
      Promise.all(professorIds.map((id) => this.disponibilidadeService.listByProfessor(id))),
      this.gradeHorariaRepository.listForConflicts(professorIds, turmaIds)
    ]);

    const { propostas, naoAlocados } = allocate(
      input.pedidos.map((pedido) => ({
        professorId: pedido.professorId,
        turmaId: pedido.turmaId,
        quantidade: pedido.quantidade,
        duracaoMinutos: duracoes.get(`${pedido.turmaId}:${pedido.disciplinaId}`) as number
      })),
      disponibilidades
        .flat()
        .map((item) => ({
          professorId: item.professorId,
          diaSemana: item.diaSemana,
          horarioInicio: formatTimeHHMM(item.horarioInicio),
          horarioFim: formatTimeHHMM(item.horarioFim)
        })),
      aulas.map((aula) => ({
        professorId: aula.professorId,
        turmaId: aula.turmaId,
        diaSemana: aula.diaSemana,
        horarioInicio: formatTimeHHMM(aula.horarioInicio),
        horarioFim: formatTimeHHMM(aula.horarioFim)
      }))
    );

    return {
      propostas: propostas.map((proposta) => {
        const pedido = input.pedidos[proposta.pedidoIndex];
        return {
          ...proposta,
          disciplinaId: pedido.disciplinaId,
          sala: pedido.sala ?? null,
          tipo: pedido.tipo ?? "AULA"
        };
      }),
      naoAlocados
    };
  }

  async confirm(input: ConfirmScheduleInput) {
    input.aulas.forEach((aula) => assertValidRange(aula.horarioInicio, aula.horarioFim));
    await this.assertNoConflicts(input.aulas);

    return this.gradeHorariaRepository.createMany(input.aulas);
  }

  async generate(input: GenerateScheduleInput) {
    const turma = await this.gradeHorariaRepository.findTurma(input.turmaId);
    if (!turma) {
      throw new HttpError(404, "Class not found");
    }
    if (!turma.gradeInicio || !turma.gradeFim) {
      throw new HttpError(400, "Defina o período da grade");
    }

    const [cargas, janelas] = await Promise.all([
      this.gradeHorariaRepository.listCargasDaTurma(input.turmaId),
      this.gradeHorariaRepository.listJanelasDaTurma(input.turmaId)
    ]);
    if (cargas.length === 0) {
      throw new HttpError(400, "A turma não tem matriz de disciplinas cadastrada");
    }
    if (janelas.length === 0) {
      throw new HttpError(400, "A turma não tem janelas de horário cadastradas");
    }

    const professores = await this.gradeHorariaRepository.listProfessoresAtivosDasDisciplinas(
      cargas.map((carga) => carga.disciplinaId),
      input.professoresExcluidos ?? []
    );
    const professorIds = professores.map((professor) => professor.id);
    const [disponibilidades, aulas, aulasAtuais] = await Promise.all([
      this.gradeHorariaRepository.listDisponibilidadesDosProfessores(professorIds),
      this.gradeHorariaRepository.listAulasDosProfessoresForaDaTurma(professorIds, input.turmaId),
      this.gradeHorariaRepository.countAulasDaTurma(input.turmaId)
    ]);

    const alocar = (aleatorio?: () => number) => allocateTurma(
      cargas.map((carga) => ({
        disciplinaId: carga.disciplinaId,
        quantidade: carga.aulasPorSemana,
        duracaoMinutos: carga.duracaoMinutos,
        professoresElegiveis: professores
          .filter((professor) => professor.disciplinas.some((disciplina) => disciplina.id === carga.disciplinaId))
          .map((professor) => professor.id)
      })),
      janelas.map((janela) => ({
        diaSemana: janela.diaSemana,
        horarioInicio: formatTimeHHMM(janela.horarioInicio),
        horarioFim: formatTimeHHMM(janela.horarioFim)
      })),
      disponibilidades.map((item) => ({
        professorId: item.professorId,
        diaSemana: item.diaSemana,
        horarioInicio: formatTimeHHMM(item.horarioInicio),
        horarioFim: formatTimeHHMM(item.horarioFim)
      })),
      aulas.map((aula) => ({
        professorId: aula.professorId,
        diaSemana: aula.diaSemana,
        horarioInicio: formatTimeHHMM(aula.horarioInicio),
        horarioFim: formatTimeHHMM(aula.horarioFim)
      })),
      { aleatorio }
    );

    // Primeira geração: resultado determinístico. "Gerar novamente" (evitar preenchido): sorteia variações e
    // devolve a primeira diferente de todas as já mostradas que não aloque menos aulas que a determinística.
    const padrao = alocar();
    const evitar = new Set(input.evitar ?? []);
    let escolhido = padrao;
    let repetida = false;
    if (evitar.size > 0) {
      const limite = faltantesDe(padrao.naoAlocados);
      const candidatos = [padrao, ...Array.from({ length: TENTATIVAS_VARIACAO }, () => alocar(criarAleatorio(randomInt(2 ** 31))))];
      const nova = candidatos.find(
        (opcao) => faltantesDe(opcao.naoAlocados) <= limite && !evitar.has(assinaturaDaGrade(opcao.propostas))
      );
      escolhido = nova ?? padrao;
      repetida = !nova;
    }
    const { propostas, naoAlocados } = escolhido;

    const disciplinaNome = new Map(cargas.map((carga) => [carga.disciplinaId, carga.disciplina.nome]));
    const professorNome = new Map(professores.map((professor) => [professor.id, professor.name]));
    return {
      propostas: propostas.map((proposta) => ({
        ...proposta,
        disciplinaNome: disciplinaNome.get(proposta.disciplinaId) as string,
        professorNome: professorNome.get(proposta.professorId) as string
      })),
      naoAlocados: naoAlocados.map((item) => ({
        ...item,
        disciplinaNome: disciplinaNome.get(item.disciplinaId) as string
      })),
      aulasAtuais,
      assinatura: assinaturaDaGrade(propostas),
      repetida
    };
  }

  async replace(input: ReplaceScheduleInput) {
    input.aulas.forEach((aula) => assertValidRange(aula.horarioInicio, aula.horarioFim));

    return this.gradeHorariaRepository.transaction(async (repository) => {
      if (!(await repository.findTurma(input.turmaId))) {
        throw new HttpError(404, "Class not found");
      }

      const cargas = await repository.listCargasDaTurma(input.turmaId);
      const daMatriz = new Set(cargas.map((carga) => carga.disciplinaId));
      if (input.aulas.some((aula) => !daMatriz.has(aula.disciplinaId))) {
        throw new HttpError(400, "Disciplina fora da matriz da turma");
      }

      // O professor precisa estar ativo e lecionar a disciplina da aula (a prévia já garante; aqui o servidor revalida).
      const professores = await repository.listProfessoresAtivosDasDisciplinas([...daMatriz], []);
      const leciona = new Map(professores.map((professor) => [professor.id, new Set(professor.disciplinas.map((d) => d.id))]));
      if (input.aulas.some((aula) => !leciona.get(aula.professorId)?.has(aula.disciplinaId))) {
        throw new HttpError(400, "Professor inativo ou que não leciona a disciplina da aula");
      }

      const aulasComRegistro = await repository.countAulasComRegistro(input.turmaId);
      if (aulasComRegistro > 0) {
        throw new HttpError(409, "A grade atual tem presenças ou faltas registradas e não pode ser substituída", {
          aulasComRegistro
        });
      }

      const aulas = input.aulas.map((aula) => ({ ...aula, turmaId: input.turmaId }));
      const existentes = await repository.listAulasDosProfessoresForaDaTurma(
        [...new Set(aulas.map((aula) => aula.professorId))],
        input.turmaId
      );
      this.assertSemConflitos(aulas, existentes);

      return repository.replaceAulasDaTurma(input.turmaId, input.aulas);
    });
  }

  private assertSemConflitos(aulas: CreateAulaInput[], existentes: ExistingAula[]) {
    const conflitos: Conflito[] = [];

    aulas.forEach((aula, aulaIndex) => {
      const registrar = (
        outra: { professorId: string; turmaId: string; diaSemana: string; horarioInicio: string; horarioFim: string },
        origem: Conflito["origem"]
      ) => {
        if (outra.diaSemana !== aula.diaSemana || !overlaps(aula.horarioInicio, aula.horarioFim, outra.horarioInicio, outra.horarioFim)) {
          return;
        }

        const base = { aulaIndex, origem, diaSemana: outra.diaSemana, horarioInicio: outra.horarioInicio, horarioFim: outra.horarioFim };
        if (outra.professorId === aula.professorId) conflitos.push({ ...base, recurso: "PROFESSOR" });
        if (outra.turmaId === aula.turmaId) conflitos.push({ ...base, recurso: "TURMA" });
      };

      for (const outra of existentes) {
        registrar(
          { ...outra, horarioInicio: formatTimeHHMM(outra.horarioInicio), horarioFim: formatTimeHHMM(outra.horarioFim) },
          "EXISTENTE"
        );
      }

      aulas.slice(0, aulaIndex).forEach((anterior) => registrar(anterior, "PROPOSTA"));
    });

    if (conflitos.length > 0) {
      throw new HttpError(409, "Schedule conflicts with existing classes", { conflitos });
    }
  }

  // A série passa a cair em datas futuras onde uma ocorrência de outra aula foi movida para o mesmo professor/turma.
  private async assertSemConflitoComOcorrenciasMovidas(aula: CreateAulaInput, ignoreId: string) {
    const [turma, movidas] = await Promise.all([
      this.gradeHorariaRepository.findTurma(aula.turmaId),
      this.gradeHorariaRepository.listExcecoesDeOutrasAulas(ignoreId, aula.professorId, aula.turmaId, parseDateOnly(todayInSaoPaulo(agora())))
    ]);
    const conflitos = movidas.flatMap((excecao) => {
      const data = excecao.data!.toISOString().slice(0, 10);
      const inicio = formatTimeHHMM(excecao.horarioInicio!);
      const fim = formatTimeHHMM(excecao.horarioFim!);
      if (diaSemanaOfDateOnly(data) !== aula.diaSemana || !overlaps(aula.horarioInicio, aula.horarioFim, inicio, fim)) return [];
      if (turma && !dataNoPeriodo(turma, data)) return [];
      const base = { origem: "OCORRENCIA_MOVIDA", data, horarioInicio: inicio, horarioFim: fim };
      return [
        ...(excecao.professorId === aula.professorId ? [{ ...base, recurso: "PROFESSOR" }] : []),
        ...(excecao.aula.turmaId === aula.turmaId ? [{ ...base, recurso: "TURMA" }] : [])
      ];
    });
    if (conflitos.length > 0) {
      throw new HttpError(409, "Schedule conflicts with moved classes", { conflitos });
    }
  }

  private async assertNoConflicts(aulas: CreateAulaInput[], ignoreId?: string) {
    const existing: ExistingAula[] = (
      await this.gradeHorariaRepository.listForConflicts(
        [...new Set(aulas.map((aula) => aula.professorId))],
        [...new Set(aulas.map((aula) => aula.turmaId))]
      )
    ).filter((aula) => aula.id !== ignoreId);

    this.assertSemConflitos(aulas, existing);
  }
}
