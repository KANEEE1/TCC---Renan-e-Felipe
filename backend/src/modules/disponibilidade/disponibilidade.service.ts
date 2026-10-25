import { HttpError } from "../../shared/http.js";
import type { CreateDisponibilidadeInput, UpdateDisponibilidadeInput } from "./disponibilidade.schemas.js";
import type { DisponibilidadeRepository } from "./disponibilidade.repository.js";

function toHHMM(date: Date) {
  return date.toISOString().slice(11, 16);
}

function assertValidRange(horarioInicio: string, horarioFim: string) {
  if (horarioFim <= horarioInicio) {
    throw new HttpError(400, "Availability end time must be after start time");
  }
}

export class DisponibilidadeService {
  constructor(private readonly disponibilidadeRepository: DisponibilidadeRepository) {}

  list() {
    return this.disponibilidadeRepository.list();
  }

  listByProfessor(professorId: string) {
    return this.disponibilidadeRepository.listByProfessor(professorId);
  }

  async getById(id: string, professorId?: string) {
    const disponibilidade = await this.disponibilidadeRepository.findById(id);

    if (!disponibilidade || (professorId && disponibilidade.professorId !== professorId)) {
      throw new HttpError(404, "Availability not found");
    }

    return disponibilidade;
  }

  create(input: CreateDisponibilidadeInput) {
    assertValidRange(input.horarioInicio, input.horarioFim);
    return this.disponibilidadeRepository.create(input);
  }

  async update(id: string, input: UpdateDisponibilidadeInput, professorId?: string) {
    const current = await this.getById(id, professorId);

    assertValidRange(input.horarioInicio ?? toHHMM(current.horarioInicio), input.horarioFim ?? toHHMM(current.horarioFim));

    return this.disponibilidadeRepository.update(id, input);
  }

  async remove(id: string, professorId?: string) {
    await this.getById(id, professorId);
    await this.disponibilidadeRepository.delete(id);
  }
}
