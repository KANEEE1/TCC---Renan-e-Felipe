import { HttpError } from "../../shared/http.js";
import type { AssignStudentsInput, CreateMatriculaInput } from "./matriculas.schemas.js";
import type { MatriculasRepository } from "./matriculas.repository.js";

export class MatriculasService {
  constructor(private readonly matriculasRepository: MatriculasRepository) {}

  list() {
    return this.matriculasRepository.list();
  }

  async create(input: CreateMatriculaInput) {
    await this.recusarRemovidos([input.alunoId]);
    return this.matriculasRepository.create(input);
  }

  async assignStudents(turmaId: string, input: AssignStudentsInput) {
    await this.recusarRemovidos(input.studentIds);
    await this.matriculasRepository.createMany(turmaId, input.studentIds);
    return this.matriculasRepository.listByTurma(turmaId);
  }

  // Aluno removido (exclusão lógica) não volta a ser matriculado.
  private async recusarRemovidos(alunoIds: string[]) {
    if (await this.matriculasRepository.algumRemovido(alunoIds)) throw new HttpError(409, "Aluno removido");
  }
}
