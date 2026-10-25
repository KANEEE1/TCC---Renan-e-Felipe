import { HttpError } from "../../shared/http.js";
import { formatTimeHHMM, periodoLetivoOf, todayInSaoPaulo } from "../../shared/time.js";
import { overlaps } from "../grade-horaria/grade-horaria.allocator.js";
import { rankCandidatos, type Candidato } from "./substituicoes.ranking.js";
import type { SubstituicoesRepository } from "./substituicoes.repository.js";
import type { CreateSubstituicaoInput } from "./substituicoes.schemas.js";

type Horario = { horarioInicio: Date; horarioFim: Date };
type Ausencia = { id: string; data: Date; aula: Horario & { professorId: string; disciplinaId: string; diaSemana: string } };
type Substituto = { id: string; ativo: boolean; roles: string[] };

export class SubstituicoesService {
  constructor(private readonly substituicoesRepository: SubstituicoesRepository) {}

  create(input: CreateSubstituicaoInput, designadoPorId: string) {
    return this.substituicoesRepository.transaction(async (repository) => {
      const ausencia = await repository.findAusenciaById(input.ausenciaId);

      if (!ausencia) {
        throw new HttpError(404, "Absence not found");
      }

      if (ausencia.data.toISOString().slice(0, 10) < todayInSaoPaulo()) {
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

  async findCandidates(ausenciaId: string) {
    const repository = this.substituicoesRepository;
    const ausencia = await repository.findAusenciaById(ausenciaId);

    if (!ausencia) {
      throw new HttpError(404, "Absence not found");
    }

    if (ausencia.data.toISOString().slice(0, 10) < todayInSaoPaulo()) {
      throw new HttpError(400, "Cannot list substitutes for a past absence");
    }

    if (await repository.findAtivaByAusencia(ausencia.id)) {
      throw new HttpError(409, "Absence already has a substitute");
    }

    const professores = await repository.findProfessoresAtivos();
    const ids = professores.map((professor) => professor.id);
    const inicioMes = new Date(Date.UTC(ausencia.data.getUTCFullYear(), ausencia.data.getUTCMonth(), 1));
    const fimMes = new Date(Date.UTC(ausencia.data.getUTCFullYear(), ausencia.data.getUTCMonth() + 1, 1));

    const [disponibilidades, aulas, substituicoesMes, recusadas] = await Promise.all([
      repository.findDisponibilidades(ids, ausencia.aula.diaSemana, periodoLetivoOf(ausencia.data)),
      repository.findAulasDosProfessores(ids),
      repository.findAtivasDosSubstitutosNoPeriodo(ids, inicioMes, fimMes),
      repository.findRecusadasByAusencia(ausencia.id)
    ]);

    const recusaram = new Set(recusadas.map((item) => item.substitutoId));
    const inicio = formatTimeHHMM(ausencia.aula.horarioInicio);
    const fim = formatTimeHHMM(ausencia.aula.horarioFim);

    const candidatos: Candidato[] = [];

    for (const professor of professores) {
      if (recusaram.has(professor.id)) continue;

      const aulasDoProfessor = aulas.filter((aula) => aula.professorId === professor.id);
      const substituicoesDoProfessor = substituicoesMes.filter((item) => item.substitutoId === professor.id);
      const compromissos = [
        ...aulasDoProfessor.filter((aula) => aula.diaSemana === ausencia.aula.diaSemana),
        ...substituicoesDoProfessor.filter((item) => item.ausencia.data.getTime() === ausencia.data.getTime()).map((item) => item.ausencia.aula)
      ];

      const motivo =
        this.verificarPerfil(ausencia, { ...professor, ativo: true, roles: ["PROFESSOR"] }) ?? this.verificarConflito(ausencia, compromissos);

      if (motivo) continue;

      candidatos.push({
        id: professor.id,
        name: professor.name,
        lecionaDisciplina: professor.disciplinas.some((disciplina) => disciplina.id === ausencia.aula.disciplinaId),
        disponivel: disponibilidades.some(
          (item) =>
            item.professorId === professor.id &&
            formatTimeHHMM(item.horarioInicio) <= inicio &&
            formatTimeHHMM(item.horarioFim) >= fim
        ),
        carga: { aulasSemanais: aulasDoProfessor.length, substituicoesMes: substituicoesDoProfessor.length }
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

  private async verificarElegibilidade(repository: SubstituicoesRepository, ausencia: Ausencia, substituto: Substituto | null) {
    const motivo = this.verificarPerfil(ausencia, substituto);

    if (motivo) {
      return motivo;
    }

    if (await repository.findAtivaByAusencia(ausencia.id)) {
      return new HttpError(409, "Absence already has a substitute");
    }

    const aulasDoSubstituto = await repository.findAulasOfProfessorNoDia(substituto!.id, ausencia.aula.diaSemana);
    const substituicoesNaData = (await repository.findAtivasDoSubstitutoNaData(substituto!.id, ausencia.data)).map(
      (item) => item.ausencia.aula
    );

    return this.verificarConflito(ausencia, [...aulasDoSubstituto, ...substituicoesNaData]);
  }

  private verificarPerfil(ausencia: Ausencia, substituto: Substituto | null) {
    if (!substituto || !substituto.ativo || !substituto.roles.includes("PROFESSOR")) {
      return new HttpError(400, "Substitute must be an active teacher");
    }

    if (substituto.id === ausencia.aula.professorId) {
      return new HttpError(400, "Substitute cannot be the lesson's own teacher");
    }

    return null;
  }

  private verificarConflito(ausencia: Ausencia, compromissos: Horario[]) {
    if (compromissos.some((horario) => this.conflita(horario, ausencia.aula))) {
      return new HttpError(409, "Substitute has a conflicting commitment at this time");
    }

    return null;
  }

  private conflita(a: Horario, b: Horario) {
    return overlaps(formatTimeHHMM(a.horarioInicio), formatTimeHHMM(a.horarioFim), formatTimeHHMM(b.horarioInicio), formatTimeHHMM(b.horarioFim));
  }
}
