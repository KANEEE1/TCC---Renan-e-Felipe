import { HttpError } from "../../shared/http.js";
import { formatTimeHHMM } from "../../shared/time.js";
import { normalizarNome } from "../../shared/normalizar-nome.js";
import type { CargaInput, CreateTurmaInput, PutJanelasInput, UpdateTurmaInput } from "./turmas.schemas.js";
import type { JanelaHorario, LinhaMatriz, TurmasRepository } from "./turmas.repository.js";

export class TurmasService {
  constructor(private readonly turmasRepository: TurmasRepository) {}

  list() {
    return this.turmasRepository.list();
  }

  async getById(id: string) {
    const turma = await this.turmasRepository.findById(id);

    if (!turma) {
      throw new HttpError(404, "Class not found");
    }

    return turma;
  }

  async create(input: CreateTurmaInput) {
    const { disciplinas, ...data } = input;

    const turmaId = await this.turmasRepository.transaction(async (repository) => {
      const turma = await repository.create(data);
      if (disciplinas) {
        await repository.substituirMatriz(turma.id, await this.resolverMatriz(repository, disciplinas));
      }
      return turma.id;
    });

    return this.getById(turmaId);
  }

  async update(id: string, input: UpdateTurmaInput) {
    await this.getById(id);
    const { disciplinas, ...data } = input;

    await this.turmasRepository.transaction(async (repository) => {
      await repository.update(id, data);
      if (disciplinas) {
        await repository.substituirMatriz(id, await this.resolverMatriz(repository, disciplinas));
      }
    });

    return this.getById(id);
  }

  async listJanelas(turmaId: string): Promise<JanelaHorario[]> {
    if (!(await this.turmasRepository.exists(turmaId))) {
      throw new HttpError(404, "Class not found");
    }

    const janelas = (await this.turmasRepository.listJanelas(turmaId)).map((janela) => ({
      diaSemana: janela.diaSemana,
      horarioInicio: formatTimeHHMM(janela.horarioInicio),
      horarioFim: formatTimeHHMM(janela.horarioFim)
    }));
    return ordenarJanelas(janelas);
  }

  async replaceJanelas(turmaId: string, input: PutJanelasInput) {
    if (!(await this.turmasRepository.exists(turmaId))) {
      throw new HttpError(404, "Class not found");
    }

    const janelas = ordenarJanelas(input.janelas);
    janelas.forEach((janela, index) => {
      if (janela.horarioFim <= janela.horarioInicio) {
        throw new HttpError(400, "O fim da janela deve ser depois do início");
      }
      const anterior = janelas[index - 1];
      if (anterior && anterior.diaSemana === janela.diaSemana && janela.horarioInicio < anterior.horarioFim) {
        throw new HttpError(400, "Janelas sobrepostas no mesmo dia");
      }
    });

    await this.turmasRepository.transaction((repository) => repository.substituirJanelas(turmaId, janelas));
    return this.listJanelas(turmaId);
  }

  private async resolverMatriz(repository: TurmasRepository, cargas: CargaInput[]) {
    const linhas: LinhaMatriz[] = [];
    const vistas = new Set<string>();

    for (const carga of cargas) {
      let disciplinaId: string;

      if (carga.disciplinaId) {
        const disciplina = await repository.findDisciplinaById(carga.disciplinaId);
        if (!disciplina) {
          throw new HttpError(400, "Disciplina não encontrada");
        }
        disciplinaId = disciplina.id;
      } else {
        const nome = (carga.nome as string).trim().replace(/\s+/g, " ");
        const nomeNormalizado = normalizarNome(nome);
        const disciplina =
          (await repository.findDisciplinaPorNomeNormalizado(nomeNormalizado)) ??
          (await repository.criarDisciplina({ nome, nomeNormalizado }));
        disciplinaId = disciplina.id;
      }

      if (vistas.has(disciplinaId)) {
        throw new HttpError(400, "Disciplina repetida na matriz da turma");
      }
      vistas.add(disciplinaId);

      linhas.push({ disciplinaId, aulasPorSemana: carga.aulasPorSemana, duracaoMinutos: carga.duracaoMinutos });
    }

    return linhas;
  }
}

const ORDEM_DIAS = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"];

function ordenarJanelas<T extends JanelaHorario>(janelas: T[]) {
  return [...janelas].sort(
    (a, b) =>
      ORDEM_DIAS.indexOf(a.diaSemana) - ORDEM_DIAS.indexOf(b.diaSemana) || a.horarioInicio.localeCompare(b.horarioInicio)
  );
}
