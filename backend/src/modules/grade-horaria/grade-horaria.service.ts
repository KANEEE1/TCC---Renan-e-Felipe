import { HttpError } from "../../shared/http.js";
import { formatTimeHHMM } from "../../shared/time.js";
import type { DisponibilidadeService } from "../disponibilidade/disponibilidade.service.js";
import { allocate, overlaps } from "./grade-horaria.allocator.js";
import type { ConfirmScheduleInput, CreateAulaInput, SuggestScheduleInput, UpdateAulaInput } from "./grade-horaria.schemas.js";
import type { GradeHorariaRepository } from "./grade-horaria.repository.js";

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

export class GradeHorariaService {
  constructor(
    private readonly gradeHorariaRepository: GradeHorariaRepository,
    private readonly disponibilidadeService: DisponibilidadeService
  ) {}

  list() {
    return this.gradeHorariaRepository.list();
  }

  async getById(id: string) {
    const aula = await this.gradeHorariaRepository.findById(id);

    if (!aula) {
      throw new HttpError(404, "Class schedule entry not found");
    }

    return aula;
  }

  listByTurma(turmaId: string) {
    return this.gradeHorariaRepository.listByTurma(turmaId);
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

    return this.gradeHorariaRepository.update(id, input);
  }

  async remove(id: string) {
    await this.getById(id);
    await this.gradeHorariaRepository.remove(id);
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
        .filter((item) => item.periodoLetivo === input.periodoLetivo)
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

  private async assertNoConflicts(aulas: CreateAulaInput[], ignoreId?: string) {
    const existing: ExistingAula[] = (
      await this.gradeHorariaRepository.listForConflicts(
        [...new Set(aulas.map((aula) => aula.professorId))],
        [...new Set(aulas.map((aula) => aula.turmaId))]
      )
    ).filter((aula) => aula.id !== ignoreId);

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

      for (const outra of existing) {
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
}
