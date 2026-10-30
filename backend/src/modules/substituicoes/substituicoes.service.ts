import { hasRole, type Actor } from "../../shared/auth.js";
import { HttpError } from "../../shared/http.js";
import type { StatusSubstituicao } from "@prisma/client";
import { diaSemanaOfDateOnly, formatTimeHHMM, parseTimeToDate, todayInSaoPaulo } from "../../shared/time.js";
import { overlaps } from "../grade-horaria/grade-horaria.allocator.js";
import { gerarOcorrencias, isoDate, valoresEfetivos, type ExcecaoOcorrencia } from "../grade-horaria/ocorrencias.js";
import { rankCandidatos, type Candidato } from "./substituicoes.ranking.js";
import type { SubstituicoesRepository } from "./substituicoes.repository.js";
import type { CreateSubstituicaoInput, RespondSubstituicaoInput } from "./substituicoes.schemas.js";

type Horario = { horarioInicio: Date; horarioFim: Date };
type ExcecaoDaAula = Pick<ExcecaoOcorrencia, "dataOriginal" | "cancelada" | "data" | "horarioInicio" | "horarioFim" | "professorId">;
type AusenciaBruta = { id: string; data: Date; aula: Horario & { professorId: string; disciplinaId: string; excecoes: ExcecaoDaAula[] } };
// Falta vista pela ocorrência efetiva: data, horário e professor já com a exceção aplicada (data = data efetiva).
type Ausencia = Horario & { id: string; data: Date; professorId: string; disciplinaId: string };

function efetivar(ausencia: AusenciaBruta): Ausencia {
  const { aula } = ausencia;
  return { id: ausencia.id, disciplinaId: aula.disciplinaId, ...valoresEfetivos(aula, aula.excecoes, ausencia.data) };
}

// Compromissos em que a falta registrada tem data efetiva igual a `data` (substituições ativas do professor).
function comprometidosNaData(
  ativas: { ausencia: { data: Date; aula: Horario & { professorId: string; excecoes: ExcecaoDaAula[] } } }[],
  data: Date
): Horario[] {
  return ativas
    .map((item) => valoresEfetivos(item.ausencia.aula, item.ausencia.aula.excecoes, item.ausencia.data))
    .filter((efetiva) => !efetiva.cancelada && efetiva.data.getTime() === data.getTime());
}

type Substituto = { id: string; ativo: boolean; roles: string[] };

export class SubstituicoesService {
  constructor(private readonly substituicoesRepository: SubstituicoesRepository) {}

  create(input: CreateSubstituicaoInput, designadoPorId: string) {
    return this.substituicoesRepository.transaction(async (repository) => {
      const bruta = await repository.findAusenciaById(input.ausenciaId);

      if (!bruta) {
        throw new HttpError(404, "Absence not found");
      }

      const ausencia = efetivar(bruta);

      if (isoDate(ausencia.data) < todayInSaoPaulo()) {
        throw new HttpError(400, "Cannot assign a substitute to a past absence");
      }

      const substituto = await repository.findUserById(input.substitutoId);
      const motivo = await this.verificarElegibilidade(repository, ausencia, substituto);

      if (motivo) {
        throw motivo;
      }

      return repository.create({ ausenciaId: ausencia.id, substitutoId: input.substitutoId }, designadoPorId);
    });
  }

  findMine(status: StatusSubstituicao | undefined, actor: Actor) {
    return this.substituicoesRepository.findBySubstituto(actor.id, status);
  }

  respond(id: string, input: RespondSubstituicaoInput, actor: Actor) {
    return this.substituicoesRepository.transaction(async (repository) => {
      const substituicao = await repository.findByIdComAusencia(id);
      const isSubstituto = substituicao?.substitutoId === actor.id;

      if (!substituicao || (!isSubstituto && !hasRole(actor, "GESTAO"))) {
        throw new HttpError(404, "Substitution not found");
      }

      if (!isSubstituto) {
        throw new HttpError(403, "Only the designated substitute can respond");
      }

      if (substituicao.status !== "PENDENTE") {
        throw new HttpError(409, "Substitution already answered");
      }

      const ausencia = efetivar((await repository.findAusenciaById(substituicao.ausenciaId))!);

      if (isoDate(ausencia.data) < todayInSaoPaulo()) {
        throw new HttpError(400, "Cannot respond to a past absence");
      }

      if (input.status === "ACEITA") {
        const substituto = await repository.findUserById(substituicao.substitutoId);
        const motivo = await this.verificarElegibilidade(repository, ausencia, substituto, substituicao.id);

        if (motivo) {
          throw motivo;
        }
      }

      return repository.responder(id, input.status, new Date());
    });
  }

  async findCandidates(ausenciaId: string) {
    const repository = this.substituicoesRepository;
    const bruta = await repository.findAusenciaById(ausenciaId);

    if (!bruta) {
      throw new HttpError(404, "Absence not found");
    }

    const ausencia = efetivar(bruta);
    const dataEfetiva = isoDate(ausencia.data);

    if (dataEfetiva < todayInSaoPaulo()) {
      throw new HttpError(400, "Cannot list substitutes for a past absence");
    }

    if (await repository.findAtivaByAusencia(ausencia.id)) {
      throw new HttpError(409, "Absence already has a substitute");
    }

    const professores = await repository.findProfessoresAtivos();
    const ids = professores.map((professor) => professor.id);
    const inicioMes = new Date(Date.UTC(ausencia.data.getUTCFullYear(), ausencia.data.getUTCMonth(), 1));
    const fimMes = new Date(Date.UTC(ausencia.data.getUTCFullYear(), ausencia.data.getUTCMonth() + 1, 1));

    const [disponibilidades, aulas, ativas, recusadas, fontes] = await Promise.all([
      repository.findDisponibilidades(ids, diaSemanaOfDateOnly(dataEfetiva)),
      repository.findAulasDosProfessores(ids),
      repository.findAtivasDosSubstitutos(ids),
      repository.findRecusadasByAusencia(ausencia.id),
      repository.carregarFontesDoDia(dataEfetiva)
    ]);

    // Aulas efetivas na data da falta (considera aulas movidas/canceladas) como compromissos dos professores.
    const aulasNaData = gerarOcorrencias(fontes.aulas, fontes.excecoes, dataEfetiva, dataEfetiva);
    const recusaram = new Set(recusadas.map((item) => item.substitutoId));
    const inicio = formatTimeHHMM(ausencia.horarioInicio);
    const fim = formatTimeHHMM(ausencia.horarioFim);

    const candidatos: Candidato[] = [];

    for (const professor of professores) {
      if (recusaram.has(professor.id)) continue;

      const aulasDoProfessor = aulas.filter((aula) => aula.professorId === professor.id);
      const substituicoesDoProfessor = ativas.filter((item) => item.substitutoId === professor.id);
      const substituicoesMes = substituicoesDoProfessor.filter((item) => {
        const { data } = valoresEfetivos(item.ausencia.aula, item.ausencia.aula.excecoes, item.ausencia.data);
        return data >= inicioMes && data < fimMes;
      });
      const compromissos = [
        ...aulasNaData
          .filter((oc) => oc.professorId === professor.id)
          .map((oc) => ({ horarioInicio: parseTimeToDate(oc.horarioInicio), horarioFim: parseTimeToDate(oc.horarioFim) })),
        ...comprometidosNaData(substituicoesDoProfessor, ausencia.data)
      ];

      const motivo =
        this.verificarPerfil(ausencia, { ...professor, ativo: true, roles: ["PROFESSOR"] }) ?? this.verificarConflito(ausencia, compromissos);

      if (motivo) continue;

      candidatos.push({
        id: professor.id,
        name: professor.name,
        lecionaDisciplina: professor.disciplinas.some((disciplina) => disciplina.id === ausencia.disciplinaId),
        disponivel: disponibilidades.some(
          (item) =>
            item.professorId === professor.id &&
            formatTimeHHMM(item.horarioInicio) <= inicio &&
            formatTimeHHMM(item.horarioFim) >= fim
        ),
        carga: { aulasSemanais: aulasDoProfessor.length, substituicoesMes: substituicoesMes.length }
      });
    }

    return rankCandidatos(candidatos);
  }

  async remove(id: string) {
    const substituicao = await this.substituicoesRepository.findById(id);

    if (!substituicao) {
      throw new HttpError(404, "Substitution not found");
    }

    if (substituicao.status !== "PENDENTE") {
      throw new HttpError(409, "Only pending substitutions can be cancelled");
    }

    await this.substituicoesRepository.remove(id);
  }

  private async verificarElegibilidade(repository: SubstituicoesRepository, ausencia: Ausencia, substituto: Substituto | null, ignorarId?: string) {
    const motivo = this.verificarPerfil(ausencia, substituto);

    if (motivo) {
      return motivo;
    }

    if (await repository.findAtivaByAusencia(ausencia.id, ignorarId)) {
      return new HttpError(409, "Absence already has a substitute");
    }

    const dataEfetiva = isoDate(ausencia.data);
    const fontes = await repository.carregarFontesDoDia(dataEfetiva);
    const aulasDoSubstituto = gerarOcorrencias(fontes.aulas, fontes.excecoes, dataEfetiva, dataEfetiva)
      .filter((oc) => oc.professorId === substituto!.id)
      .map((oc) => ({ horarioInicio: parseTimeToDate(oc.horarioInicio), horarioFim: parseTimeToDate(oc.horarioFim) }));
    const substituicoesNaData = comprometidosNaData(await repository.findAtivasDoSubstituto(substituto!.id, ignorarId), ausencia.data);

    return this.verificarConflito(ausencia, [...aulasDoSubstituto, ...substituicoesNaData]);
  }

  private verificarPerfil(ausencia: Ausencia, substituto: Substituto | null) {
    if (!substituto || !substituto.ativo || !substituto.roles.includes("PROFESSOR")) {
      return new HttpError(400, "Substitute must be an active teacher");
    }

    if (substituto.id === ausencia.professorId) {
      return new HttpError(400, "Substitute cannot be the lesson's own teacher");
    }

    return null;
  }

  private verificarConflito(ausencia: Ausencia, compromissos: Horario[]) {
    if (compromissos.some((horario) => this.conflita(horario, ausencia))) {
      return new HttpError(409, "Substitute has a conflicting commitment at this time");
    }

    return null;
  }

  private conflita(a: Horario, b: Horario) {
    return overlaps(formatTimeHHMM(a.horarioInicio), formatTimeHHMM(a.horarioFim), formatTimeHHMM(b.horarioInicio), formatTimeHHMM(b.horarioFim));
  }
}
