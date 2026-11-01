import { agora } from "../../shared/clock.js";
import type { Actor } from "../../shared/auth.js";
import { hasRole } from "../../shared/auth.js";
import { formatTimeHHMM, parseDateOnly, timeOfDayInSaoPaulo, todayInSaoPaulo } from "../../shared/time.js";
import type { GradeHorariaRepository } from "../grade-horaria/grade-horaria.repository.js";
import { gerarOcorrencias, indisponibilidadeVigente, isoDate } from "../grade-horaria/ocorrencias.js";
import type { MeetingsRepository } from "../meetings/meetings.repository.js";

function statusFor(inicio: string, fim: string, agoraHHMM: string) {
  if (agoraHHMM < inicio) return "agendada";
  if (agoraHHMM > fim) return "concluída";
  return "em andamento";
}

interface ResumoItem {
  kind: "AULA" | "EVENTO";
  id: string;
  titulo: string;
  tipo: string;
  disciplina: string | null;
  turmas: string[];
  professores: string[];
  local: string | null;
  horarioInicio: string;
  horarioFim: string;
  status: "agendada" | "em andamento" | "concluída";
  participo: boolean;
  aulaId?: string;
  dataOriginal?: string;
  eventoId?: string;
}

export class DashboardService {
  constructor(
    private readonly gradeHorariaRepository: GradeHorariaRepository,
    private readonly meetingsRepository: MeetingsRepository
  ) {}

  async summary(actor: Actor) {
    const hoje = todayInSaoPaulo(agora());
    const [aulas, eventos] = await Promise.all([
      this.gradeHorariaRepository.list(),
      this.meetingsRepository.listByDate(parseDateOnly(hoje))
    ]);

    const gestao = hasRole(actor, "GESTAO");
    const horaAgora = timeOfDayInSaoPaulo(agora());

    // Aulas: ocorrências efetivas de hoje (respeitam período da grade, aulas movidas e canceladas).
    const aulaPorId = new Map(aulas.map((aula) => [aula.id, aula]));
    const professores = new Map(
      aulas.flatMap((aula) => [aula.professor, ...aula.excecoes.flatMap((e) => (e.professor ? [e.professor] : []))]).map((p) => [p.id, p.name])
    );
    const itensAula: ResumoItem[] = [];
    for (const oc of gerarOcorrencias(aulas, aulas.flatMap((aula) => aula.excecoes), hoje, hoje)) {
      const aula = aulaPorId.get(oc.aulaId)!;
      const meu = oc.professorId === actor.id;
      if (!gestao) {
        if (!meu) continue;
        // "Não vou" vigente do professor nesta ocorrência: ele não participa.
        const excecao = aula.excecoes.find((e) => isoDate(e.dataOriginal) === oc.dataOriginal);
        const indisponivel = aula.indisponibilidades.some(
          (i) => isoDate(i.dataOriginal) === oc.dataOriginal && i.professorId === actor.id && indisponibilidadeVigente(aula, excecao, i)
        );
        if (indisponivel) continue;
      }
      itensAula.push({
        kind: "AULA",
        id: `aula:${oc.aulaId}:${oc.dataOriginal}`,
        titulo: aula.disciplina.nome,
        tipo: aula.tipo,
        disciplina: aula.disciplina.nome,
        turmas: [aula.turma.nome],
        professores: [professores.get(oc.professorId) ?? aula.professor.name],
        local: aula.sala,
        horarioInicio: oc.horarioInicio,
        horarioFim: oc.horarioFim,
        status: statusFor(oc.horarioInicio, oc.horarioFim, horaAgora),
        participo: meu,
        aulaId: oc.aulaId,
        dataOriginal: oc.dataOriginal
      });
    }

    const itensEvento: ResumoItem[] = [];
    for (const evento of eventos) {
      const participantes = evento.participacoes.filter((p) => p.status !== "RECUSADO");
      const participo = participantes.some((p) => p.userId === actor.id);
      if (!gestao && !participo) continue;
      const horarioInicio = formatTimeHHMM(evento.horarioInicio);
      const horarioFim = formatTimeHHMM(evento.horarioFim);
      itensEvento.push({
        kind: "EVENTO",
        id: `evento:${evento.id}`,
        titulo: evento.titulo,
        tipo: evento.tipo,
        disciplina: evento.disciplina?.nome ?? null,
        turmas: evento.turmas.map((t) => t.nome),
        professores: participantes.map((p) => p.user.name),
        local: evento.local,
        horarioInicio,
        horarioFim,
        status: statusFor(horarioInicio, horarioFim, horaAgora),
        participo,
        eventoId: evento.id
      });
    }

    const todayActivities = [...itensAula, ...itensEvento].sort(
      (a, b) => a.horarioInicio.localeCompare(b.horarioInicio) || a.horarioFim.localeCompare(b.horarioFim)
    );

    return { todayActivities };
  }
}
