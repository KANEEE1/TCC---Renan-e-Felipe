import { HttpError } from "../../shared/http.js";
import { normalizarNome } from "../../shared/normalizar-nome.js";
import type { CargaInput, CreateTurmaInput, UpdateTurmaInput } from "./turmas.schemas.js";
import type { LinhaMatriz, TurmasRepository } from "./turmas.repository.js";

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
