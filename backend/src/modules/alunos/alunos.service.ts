import { agora } from "../../shared/clock.js";
import { HttpError } from "../../shared/http.js";
import type { CreateAlunoInput, UpdateAlunoInput } from "./alunos.schemas.js";
import type { AlunosRepository } from "./alunos.repository.js";

export class AlunosService {
  constructor(private readonly alunosRepository: AlunosRepository) {}

  list() {
    return this.alunosRepository.list();
  }

  async getById(id: string) {
    const aluno = await this.alunosRepository.findById(id);

    if (!aluno) {
      throw new HttpError(404, "Student not found");
    }

    return aluno;
  }

  async create(input: CreateAlunoInput) {
    if (!(await this.alunosRepository.turmaExists(input.turmaId))) {
      throw new HttpError(400, "Turma não encontrada");
    }
    return this.alunosRepository.create(input);
  }

  async update(id: string, input: UpdateAlunoInput) {
    if ((await this.getById(id)).removidoEm) throw new HttpError(409, "Aluno removido");
    return this.alunosRepository.update(id, input);
  }

  // Idempotente: aluno já removido mantém a data da primeira remoção.
  async remove(id: string) {
    const aluno = await this.getById(id);
    if (!aluno.removidoEm) await this.alunosRepository.remover(id, agora());
  }
}
