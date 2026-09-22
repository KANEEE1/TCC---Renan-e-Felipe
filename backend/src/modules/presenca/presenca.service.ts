import type { CreatePresencaInput, MarkAttendanceInput } from "./presenca.schemas.js";
import type { PresencaRepository } from "./presenca.repository.js";

export class PresencaService {
  constructor(private readonly presencaRepository: PresencaRepository) {}

  list() {
    return this.presencaRepository.list();
  }

  listByTurma(turmaId: string) {
    return this.presencaRepository.listByTurma(turmaId);
  }

  create(input: CreatePresencaInput) {
    return this.presencaRepository.create(input);
  }

  markBulk(input: MarkAttendanceInput) {
    return this.presencaRepository.markBulk(input);
  }

  async report(alunoId: string) {
    const presencas = await this.presencaRepository.listByAluno(alunoId);
    const totalClasses = presencas.length;
    const present = presencas.filter((p) => p.presente).length;
    const absent = totalClasses - present;
    const percentage = totalClasses === 0 ? 0 : Math.round((present / totalClasses) * 100);

    return { totalClasses, present, absent, percentage, history: presencas };
  }
}
