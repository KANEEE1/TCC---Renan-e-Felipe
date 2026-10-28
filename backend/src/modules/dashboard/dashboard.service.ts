import { currentDiaSemana, currentTimeOfDay, todayInSaoPaulo } from "../../shared/time.js";
import type { GradeHorariaRepository } from "../grade-horaria/grade-horaria.repository.js";
import type { SimuladosRepository } from "../simulados/simulados.repository.js";
import type { TurmasRepository } from "../turmas/turmas.repository.js";

// A aula só acontece dentro do período da grade da turma; turma sem período não restringe.
function emVigencia(turma: { gradeInicio: Date | null; gradeFim: Date | null }, hoje: string) {
  const inicio = turma.gradeInicio?.toISOString().slice(0, 10);
  const fim = turma.gradeFim?.toISOString().slice(0, 10);
  return (!inicio || inicio <= hoje) && (!fim || fim >= hoje);
}

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
    const hoje = todayInSaoPaulo();

    const todayActivities = aulas
      .filter((aula) => aula.diaSemana === today && emVigencia(aula.turma, hoje))
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
