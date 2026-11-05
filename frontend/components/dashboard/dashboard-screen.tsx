"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CalendarClock, CalendarX, ChevronRight, ClipboardList, LogOut, Plus, Trophy, User, UserMinus, UserX, Zap } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { eventTypeOf, toHHMM, type EventType, type MeetingDTO } from "@/components/meetings/meeting-types";
import { HelpButton } from "@/components/ui/help-button";

interface DashboardSummary {
  todayActivities: {
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
  }[];
}

// Aviso para a gestão: um professor informou que não poderá participar de uma aula ou de um evento.
interface IndisponibilidadeNotice {
  id: string;
  tipo: "AULA" | "EVENTO";
  professor: { id: string; name: string };
  titulo: string;
  turma: string | null;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  aulaId?: string;
  dataOriginal?: string;
  eventoId?: string;
}

// Aviso para a gestão: o prazo de correção de um simulado venceu e alunos ficaram com zero automático.
interface SimuladoEncerradoNotice {
  id: string;
  tipo: "SIMULADO";
  titulo: string;
  turma: string | null;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  eventoId: string;
  prazoCorrecao: string | null;
  zerados: number;
}

type ManagementNotice = IndisponibilidadeNotice | SimuladoEncerradoNotice;

// Avisos do próprio professor: aula em que foi escalado (precisa responder) e aula/evento de que foi retirado (só "Ciente").
interface ConvocacaoNotice {
  id: string;
  aulaId: string;
  dataOriginal: string;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  disciplina: string;
  turma: string;
  remarcada: boolean;
}

interface RetiradaNotice {
  id: string;
  tipo: "RETIRADO_AULA" | "RETIRADO_EVENTO" | "CANCELADO_AULA" | "CANCELADO_EVENTO";
  titulo: string;
  turma: string | null;
  data: string;
  horarioInicio: string;
  horarioFim: string;
}

// Simulado que o professor corrige: já terminou e ainda não foi enviado nem encerrado.
interface CorrecaoNotice {
  eventoId: string;
  titulo: string;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  prazoCorrecao: string;
  lancados: number;
  total: number;
}

interface MyNotices {
  convocacoes: ConvocacaoNotice[];
  retiradas: RetiradaNotice[];
  correcoes: CorrecaoNotice[];
}

const EMPTY_MY_NOTICES: MyNotices = { convocacoes: [], retiradas: [], correcoes: [] };
const dayMonth = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

const NOTICE_GONE_MESSAGE = "Esta convocação não vale mais (a aula mudou ou já começou).";
const REMOVAL_GONE_MESSAGE = "Este aviso não está mais disponível.";

const byDateAndTime = (a: { data: string; horarioInicio: string }, b: { data: string; horarioInicio: string }) =>
  a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio);

const formatNoticeDate = (data: string) =>
  new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

const STATUS_STYLE: Record<string, string> = {
  "em andamento": "bg-emerald-100 text-emerald-700",
  agendada: "bg-blue-100 text-blue-700",
  "concluída": "bg-slate-100 text-slate-600"
};

const AULA_TIPO_LABEL: Record<string, string> = { AULA: "Aula", PLANTAO: "Plantão", AULAO: "Aulão" };

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function DashboardScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [userName, setUserName] = useState("Usuário");
  // Vazio até /auth/me responder, para professores não verem por um instante as ferramentas do gestor.
  const [userRole, setUserRole] = useState("");
  const [events, setEvents] = useState<MeetingDTO[]>([]);
  const [notices, setNotices] = useState<ManagementNotice[]>([]);
  const [myNotices, setMyNotices] = useState<MyNotices>(EMPTY_MY_NOTICES);

  useEffect(() => {
    api.get<DashboardSummary>("/dashboard/summary").then(setSummary).catch(() => setSummary(null));
    api.get<MeetingDTO[]>("/meetings").then(setEvents).catch(() => setEvents([]));
    api.get<MyNotices>("/notices/mine").then(setMyNotices).catch(() => setMyNotices(EMPTY_MY_NOTICES));
    api
      .get<{ name: string; roles: ("GESTAO" | "PROFESSOR")[] }>("/auth/me")
      .then((me) => {
        setUserName(me.name);
        setUserRole(me.roles.includes("GESTAO") ? "gestão" : "professor");
        if (me.roles.includes("GESTAO")) api.get<ManagementNotice[]>("/notices").then(setNotices).catch(() => setNotices([]));
      })
      .catch(() => {});
  }, []);

  // "Ciente": a gestão dispensa o aviso. O card some já; se o servidor falhar, ele volta e aparece um erro.
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const dismissNotice = (notice: ManagementNotice) => {
    setNoticeError(null);
    setNotices((current) => current.filter((item) => item.id !== notice.id));
    api.post(`/notices/${notice.id}/ciente`).catch(() => {
      setNotices((current) =>
        [...current, notice].sort((a, b) => a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio))
      );
      setNoticeError("Não foi possível marcar o aviso como ciente. Tente novamente.");
    });
  };

  // Convocação de aula: Vou / Não vou. O card some já; se o servidor falhar, ele volta e aparece um erro.
  const answerConvocacao = (convocacao: ConvocacaoNotice, status: "CONFIRMADO" | "RECUSADO") => {
    setNoticeError(null);
    setMyNotices((current) => ({ ...current, convocacoes: current.convocacoes.filter((item) => item.id !== convocacao.id) }));
    api.put(`/notices/mine/convocacoes/${convocacao.id}`, { status }).catch((error) => {
      // 404/409: a convocação não vale mais (aula mudou ou começou); o card fica removido.
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        setNoticeError(NOTICE_GONE_MESSAGE);
        return;
      }
      setMyNotices((current) => ({ ...current, convocacoes: [...current.convocacoes, convocacao].sort(byDateAndTime) }));
      setNoticeError("Não foi possível registrar sua resposta. Tente novamente.");
    });
  };

  // Retirada: o professor dá ciente e o card some (volta se o servidor falhar).
  const dismissRetirada = (retirada: RetiradaNotice) => {
    setNoticeError(null);
    setMyNotices((current) => ({ ...current, retiradas: current.retiradas.filter((item) => item.id !== retirada.id) }));
    api.post(`/notices/mine/${retirada.id}/ciente`).catch((error) => {
      if (error instanceof ApiError && error.status === 404) {
        setNoticeError(REMOVAL_GONE_MESSAGE);
        return;
      }
      setMyNotices((current) => ({ ...current, retiradas: [...current.retiradas, retirada].sort(byDateAndTime) }));
      setNoticeError("Não foi possível marcar o aviso como ciente. Tente novamente.");
    });
  };

  const handleLogout = (event: React.MouseEvent) => {
    event.preventDefault();
    clearSession();
    router.push("/");
  };

  // Avisos: eventos futuros em que o usuário foi incluído e ainda não respondeu. Somem ao responder Vou/Não vou.
  const now = new Date();
  const startOf = (event: MeetingDTO) => new Date(`${event.data.slice(0, 10)}T${toHHMM(event.horarioInicio)}:00`);

  // Próximas atividades: eventos (exceto "Aula comum") que ainda vão começar nos próximos 7 dias — de agora até o fim
  // do dia que fica 7 dias à frente de hoje —, em ordem de horário. A gestão vê todos; o professor, só os que
  // confirmou presença.
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 7);
  windowEnd.setHours(23, 59, 59, 999);
  const upcoming = events
    .filter((event) => {
      const startsAt = startOf(event);
      return (
        event.tipo !== "AULA" &&
        startsAt > now &&
        startsAt <= windowEnd &&
        (userRole === "gestão" || event.meuStatus === "CONFIRMADO")
      );
    })
    .sort((a, b) => startOf(a).getTime() - startOf(b).getTime());

  const invites = events
    .filter((event) => {
      if (event.meuStatus !== "PENDENTE") return false;
      return startOf(event) > now;
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio));

  const noticeCount =
    invites.length + notices.length + myNotices.convocacoes.length + myNotices.retiradas.length + myNotices.correcoes.length;


  return (
    <div className="flex-1 bg-slate-50">
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 px-5 pb-6 pt-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-0.5 text-sm text-blue-200">Bem-vindo de volta 👋</p>
            <h1 className="capitalize text-white">{userName}</h1>
            <span className="mt-1 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs capitalize text-white/90">
              {userRole}
            </span>
          </div>
          <div className="flex gap-2">
            <HelpButton title="Como funciona essa tela">
              {userRole === "gestão" ? (
                <>
                  <p>Essa é a sua tela inicial. Aqui você vê um resumo do seu dia (aulas e reuniões) e os avisos mais importantes, como um professor avisando que não vai poder dar aula.</p>
                  <p>Os atalhos em destaque levam pras ferramentas principais, como gerar a grade de horários automaticamente.</p>
                </>
              ) : (
                <>
                  <p>Essa é a sua tela inicial. Aqui aparecem as aulas e reuniões do seu dia.</p>
                  <p>Quando a gestão te escalar pra dar uma aula ou te convidar pra uma reunião, o aviso aparece aqui mesmo, com botões pra confirmar ou recusar.</p>
                </>
              )}
            </HelpButton>
            <Link
              href="/profile/edit"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
            >
              <User size={17} />
            </Link>
            <Link
              href="/"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
            >
              <LogOut size={17} />
            </Link>
          </div>
        </div>
      </div>

      {/* Respiro entre o bloco azul e as seções abaixo. */}
      <div className="pt-6">
      {userRole === "gestão" && (
        <div className="mb-5 px-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-violet-400" />
            <span className="text-xs text-slate-500">Ferramentas do gestor</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/schedule/smart-builder"
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 p-4 text-left shadow-md transition-shadow hover:shadow-lg"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Zap size={20} className="text-white" />
              </div>
              <span className="text-sm leading-tight text-white">Grade Inteligente</span>
            </Link>
            <Link
              href="/schedule/create"
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-left shadow-md transition-shadow hover:shadow-lg"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Plus size={20} className="text-white" />
              </div>
              <span className="text-sm leading-tight text-white">Criar agendamento</span>
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-5 px-4 pb-6">
        {/* Avisos aparecem para todos os perfis (professor e gestão), mesmo vazios. */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-amber-500" />
            <h2 className="text-slate-700">Avisos</h2>
            {noticeCount > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{noticeCount}</span>}
          </div>

          {noticeError && <p className="mb-2 text-xs text-slate-500">{noticeError}</p>}
          {noticeCount === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
              Nenhum aviso no momento.
            </p>
          ) : (
            <div className="space-y-2.5">
              {notices.map((notice) => {
                if (notice.tipo === "SIMULADO") {
                  return (
                    <div key={notice.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white">
                          <Trophy size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-rose-900">
                            <strong>Simulado {notice.titulo}</strong>: prazo encerrado, {notice.zerados}{" "}
                            {notice.zerados === 1 ? "aluno ficou" : "alunos ficaram"} com zero por falta de correção
                          </p>
                          <p className="mt-0.5 text-xs text-rose-700">
                            {notice.turma ? `${notice.turma} · ` : ""}
                            {notice.prazoCorrecao ? `Prazo: ${dayMonth(notice.prazoCorrecao)}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Link
                          href={`/simulados/${notice.eventoId}`}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-rose-500 py-2.5 text-sm text-white transition-colors hover:bg-rose-600"
                        >
                          Ver notas <ChevronRight size={15} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => dismissNotice(notice)}
                          className="rounded-xl border border-rose-300 bg-white px-5 py-2.5 text-sm text-rose-700 transition-colors hover:bg-rose-100"
                        >
                          Ciente
                        </button>
                      </div>
                    </div>
                  );
                }
                const date = new Date(`${notice.data}T00:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit"
                });
                const editHref =
                  notice.tipo === "AULA"
                    ? `/calendar?aula=${notice.aulaId}&data=${notice.dataOriginal}&edit=1`
                    : `/calendar?event=${notice.eventoId}&edit=1`;
                return (
                  <div key={notice.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                        <UserX size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          <strong>{notice.professor.name}</strong> não poderá participar
                        </p>
                        <p className="mt-0.5 text-sm text-slate-700">
                          {notice.tipo === "AULA" ? "Aula" : "Evento"}: <strong>{notice.titulo}</strong>
                          {notice.turma ? ` · ${notice.turma}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          <span className="capitalize">{date}</span>, das {notice.horarioInicio} às {notice.horarioFim}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link
                        href={editHref}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-amber-500 py-2.5 text-sm text-white transition-colors hover:bg-amber-600"
                      >
                        {notice.tipo === "AULA" ? "Editar aula" : "Editar evento"} <ChevronRight size={15} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => dismissNotice(notice)}
                        className="rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-sm text-amber-700 transition-colors hover:bg-amber-100"
                      >
                        Ciente
                      </button>
                    </div>
                  </div>
                );
              })}
              {myNotices.correcoes.map((correcao) => (
                <div key={`correcao-${correcao.eventoId}`} className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
                      <ClipboardList size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        <strong>Corrija o simulado {correcao.titulo}</strong> até {dayMonth(correcao.prazoCorrecao)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {correcao.lancados} de {correcao.total} alunos lançados
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/simulados/${correcao.eventoId}`}
                    className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-orange-500 py-2.5 text-sm text-white transition-colors hover:bg-orange-600"
                  >
                    Lançar notas <ChevronRight size={15} />
                  </Link>
                </div>
              ))}
              {myNotices.convocacoes.map((convocacao) => (
                <div key={convocacao.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                      <CalendarClock size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        {convocacao.remarcada ? <strong>Aula remarcada:</strong> : <strong>Você foi escalado para uma aula</strong>}{convocacao.remarcada ? " " : ": "}{convocacao.disciplina}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {convocacao.turma} · <span className="capitalize">{formatNoticeDate(convocacao.data)}</span>, das{" "}
                        {convocacao.horarioInicio} às {convocacao.horarioFim}
                      </p>
                      <p className="mt-1.5 text-xs text-slate-600">{convocacao.remarcada ? "A data ou o horário mudou. Confirme se você continua disponível." : "Confirme se você vai dar esta aula."}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => answerConvocacao(convocacao, "CONFIRMADO")}
                      className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm text-white transition-colors hover:bg-amber-600"
                    >
                      Vou
                    </button>
                    <button
                      type="button"
                      onClick={() => answerConvocacao(convocacao, "RECUSADO")}
                      className="flex-1 rounded-xl border border-amber-300 bg-white py-2.5 text-sm text-amber-700 transition-colors hover:bg-amber-100"
                    >
                      Não vou
                    </button>
                  </div>
                  <Link
                    href={`/calendar?aula=${convocacao.aulaId}&data=${convocacao.dataOriginal}`}
                    className="mt-2 flex items-center justify-center gap-1 text-xs text-amber-700 hover:underline"
                  >
                    Ver na agenda <ChevronRight size={13} />
                  </Link>
                </div>
              ))}
              {myNotices.retiradas.map((retirada) => {
                const cancelado = retirada.tipo.startsWith("CANCELADO");
                return (
                <div
                  key={retirada.id}
                  className={`rounded-2xl border p-4 shadow-sm ${cancelado ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-100"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cancelado ? "bg-rose-500" : "bg-slate-500"} text-white`}>
                      {cancelado ? <CalendarX size={18} /> : <UserMinus size={18} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${cancelado ? "text-rose-900" : "text-slate-800"}`}>
                        {cancelado ? (
                          <>
                            <strong>{retirada.tipo === "CANCELADO_AULA" ? "Aula cancelada" : "Evento cancelado"}:</strong> {retirada.titulo}
                          </>
                        ) : (
                          <>
                            <strong>Você não está mais em</strong>: {retirada.titulo}
                          </>
                        )}
                      </p>
                      <p className={`mt-0.5 text-xs ${cancelado ? "text-rose-700" : "text-slate-600"}`}>
                        {retirada.turma ? `${retirada.turma} · ` : ""}
                        <span className="capitalize">{formatNoticeDate(retirada.data)}</span>, das {retirada.horarioInicio} às{" "}
                        {retirada.horarioFim}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissRetirada(retirada)}
                    className={`mt-3 w-full rounded-xl border bg-white py-2.5 text-sm transition-colors ${
                      cancelado ? "border-rose-300 text-rose-700 hover:bg-rose-100" : "border-slate-300 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Ciente
                  </button>
                </div>
                );
              })}
              {invites.map((event) => {
                const type = eventTypeOf(event.tipo);
                const date = new Date(`${event.data.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit"
                });
                return (
                  <div key={event.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                        <Bell size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          {event.meuRemarcado ? "Evento remarcado" : "Novo evento com a sua participação"}: <strong>{event.titulo}</strong>
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-600">
                          <span className={`inline-block h-2 w-2 rounded-full ${type.dot}`} />
                          {type.label} · <span className="capitalize">{date}</span>, das {toHHMM(event.horarioInicio)} às{" "}
                          {toHHMM(event.horarioFim)}
                          {event.local ? ` · ${event.local}` : ""}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-600">
                          {event.meuRemarcado
                            ? "A data ou o horário mudou. Confirme se você continua disponível."
                            : "Confirme se vai participar para a coordenação se organizar."}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/calendar?event=${event.id}`}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-amber-500 py-2.5 text-sm text-white transition-colors hover:bg-amber-600"
                    >
                      Responder na agenda <ChevronRight size={15} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-blue-500" />
              <h2 className="text-slate-700">Resumo do Dia</h2>
            </div>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
            </span>
          </div>

          <div className="space-y-2.5">
            {(summary?.todayActivities ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                {userRole === "gestão" ? "Nenhuma aula ou evento hoje no cursinho." : "Você não tem aulas nem eventos hoje."}
              </p>
            )}
            {(summary?.todayActivities ?? []).map((activity) => {
              const isEvent = activity.kind === "EVENTO";
              const type = isEvent ? eventTypeOf(activity.tipo as EventType) : null;
              const color = type ? type.dot : "bg-blue-500";
              const kindLabel = type ? type.label : (AULA_TIPO_LABEL[activity.tipo] ?? "Aula");
              const href = isEvent
                ? `/calendar?event=${activity.eventoId}`
                : `/calendar?aula=${activity.aulaId}&data=${activity.dataOriginal}`;
              const details = [kindLabel, activity.turmas.join(", "), activity.local].filter(Boolean).join(" · ");
              const done = activity.status === "concluída";
              return (
                <Link
                  key={activity.id}
                  href={href}
                  className={`flex items-stretch overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
                    activity.participo && userRole === "gestão" ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200"
                  } ${done ? "opacity-60" : ""}`}
                >
                  <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-slate-100 py-3">
                    <span className="text-base leading-none text-slate-800">{activity.horarioInicio}</span>
                    <span className="mt-1 text-xs leading-none text-slate-400">{activity.horarioFim}</span>
                  </div>
                  <div className={`w-1.5 shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm leading-tight text-slate-800">{activity.titulo}</p>
                      <span
                        className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[activity.status] ?? "bg-slate-100 text-slate-500"}`}
                      >
                        {activity.status === "em andamento" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
                        {activity.status}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{details}</p>
                    {userRole === "gestão" && activity.professores.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{activity.professores.join(", ")}</p>
                    )}
                    {activity.participo && userRole === "gestão" && (
                      <span className="mt-1.5 inline-block rounded-full bg-blue-600 px-2 py-0.5 text-[11px] text-white">Você participa</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-purple-500" />
              <h2 className="text-slate-700">Próximas Atividades</h2>
            </div>
            <Link href="/calendar" className="flex items-center gap-0.5 text-xs text-blue-600">
              Ver tudo <ChevronRight size={13} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {upcoming.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                Nenhuma atividade prevista para os próximos 7 dias.
              </p>
            )}
            {upcoming.map((event) => {
              const type = eventTypeOf(event.tipo);
              const date = startOf(event);
              return (
                <Link
                  key={event.id}
                  href={`/calendar?event=${event.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${type.dot}`}>
                    <span className="text-[15px] font-bold leading-none text-white">{String(date.getDate()).padStart(2, "0")}</span>
                    <span className="mt-0.5 text-[9px] leading-none text-white/80">{MONTHS[date.getMonth()]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800">{event.titulo}</p>
                    <p className="truncate text-xs text-slate-400">
                      {type.label} · <span className="capitalize">{date.toLocaleDateString("pt-BR", { weekday: "short" })}</span>{" "}
                      {toHHMM(event.horarioInicio)}–{toHHMM(event.horarioFim)}
                      {event.local ? ` · ${event.local}` : ""}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
