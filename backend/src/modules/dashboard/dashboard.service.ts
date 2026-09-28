import { currentDiaSemana, currentTimeOfDay } from "../../shared/time.js";
import type { GradeHorariaRepository } from "../grade-horaria/grade-horaria.repository.js";
import type { SimuladosRepository } from "../simulados/simulados.repository.js";
import type { TurmasRepository } from "../turmas/turmas.repository.js";

function statusFor(horarioInicio: Date, horarioFim: Date, now: Date) {
  if (now < horarioInicio) return "agendada";
  if (now > horarioFim) return "concluída";
  return "em andamento";
}

export class DashboardService {
  constructor(
    private readonly turmasRepository: TurmasRepository,
    private readonly gradeHorariaRepository: GradeHorariaRepository,
    private readonly simuladosRepository: SimuladosRepository
  ) {}

  async summary() {
    const [turmas, aulas, simulados] = await Promise.all([
      this.turmasRepository.list(),
      this.gradeHorariaRepository.list(),
      this.simuladosRepository.list()
    ]);

    const today = currentDiaSemana();
    const now = currentTimeOfDay();

    const todayActivities = aulas
      .filter((aula) => aula.diaSemana === today)
      .map((aula) => ({
        id: aula.id,
        subject: aula.disciplina.nome,
        class: aula.turma.nome,
        teacher: aula.professor.name,
        tipo: aula.tipo,
        time: aula.horarioInicio,
        endTime: aula.horarioFim,
        status: statusFor(aula.horarioInicio, aula.horarioFim, now)
      }))
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    const upcomingSimulados = simulados
      .filter((simulado) => simulado.data >= new Date(new Date().toDateString()))
      .slice(0, 5);

    return {
      stats: {
        turmas: turmas.length,
        aulasHoje: todayActivities.length,
        auloesHoje: todayActivities.filter((a) => a.tipo === "AULAO").length
      },
      todayActivities,
      upcomingSimulados
    };
  }
}
