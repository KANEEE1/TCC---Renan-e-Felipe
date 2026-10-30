import { currentTimeOfDay, parseTimeToDate, todayInSaoPaulo } from "../../shared/time.js";
import type { GradeHorariaRepository } from "../grade-horaria/grade-horaria.repository.js";
import { gerarOcorrencias } from "../grade-horaria/ocorrencias.js";
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

    const now = currentTimeOfDay();
    const hoje = todayInSaoPaulo();

    // Ocorrências efetivas de hoje (respeitam período da grade, aulas movidas e canceladas).
    const aulaPorId = new Map(aulas.map((aula) => [aula.id, aula]));
    const professores = new Map(
      aulas.flatMap((aula) => [aula.professor, ...aula.excecoes.flatMap((e) => (e.professor ? [e.professor] : []))]).map((p) => [p.id, p.name])
    );
    const todayActivities = gerarOcorrencias(aulas, aulas.flatMap((aula) => aula.excecoes), hoje, hoje)
      .map((oc) => {
        const aula = aulaPorId.get(oc.aulaId)!;
        const time = parseTimeToDate(oc.horarioInicio);
        const endTime = parseTimeToDate(oc.horarioFim);
        return {
          id: aula.id,
          subject: aula.disciplina.nome,
          class: aula.turma.nome,
          teacher: professores.get(oc.professorId) ?? aula.professor.name,
          tipo: aula.tipo,
          time,
          endTime,
          status: statusFor(time, endTime, now)
        };
      })
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
