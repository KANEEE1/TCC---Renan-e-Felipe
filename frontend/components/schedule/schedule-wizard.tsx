"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  CalendarRange,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
  UserCheck,
  Users
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { todayInSaoPaulo } from "@/lib/date";
import { GradeCreatedDialog } from "@/components/schedule/grade-created-dialog";
import { PeriodPicker, formatPeriodo } from "@/components/schedule/period-picker";
import { CurriculumEditor, formatHours, makeRow, toDisciplinasPayload, type CargaRow } from "@/components/classes/curriculum-editor";
import {
  DAYS,
  SLOTS,
  WeekGrid,
  emptyGrid,
  formatHours as formatSlots,
  intervalsOf,
  slotToApiTime,
  timeToSlot,
  type Grid,
  type WeekGridEvent
} from "@/components/schedule/week-grid";

const SHIFTS = ["Manhã", "Tarde", "Noite", "Integral"];
const PALETTE = ["#2563eb", "#059669", "#7c3aed", "#d97706", "#e11d48", "#0891b2", "#4f46e5", "#65a30d"];

const STEPS = [
  { label: "Turma", icon: Users },
  { label: "Período", icon: CalendarRange },
  { label: "Disciplinas", icon: BookOpen },
  { label: "Horários", icon: Clock },
  { label: "Professores", icon: UserCheck },
  { label: "Gerar", icon: Sparkles }
];

const MOTIVOS: Record<string, string> = {
  SEM_PROFESSOR: "Nenhum professor disponível que lecione a disciplina",
  SEM_DISPONIBILIDADE: "Professores sem disponibilidade dentro dos horários da turma",
  CONFLITO: "Horários possíveis já ocupados"
};

interface ClassSummary {
  id: string;
  nome: string;
  turno?: string | null;
  gradeInicio?: string | null;
  gradeFim?: string | null;
  cargas?: { aulasPorSemana: number; duracaoMinutos: number }[];
}

interface Carga {
  aulasPorSemana: number;
  duracaoMinutos: number;
  disciplina: { id: string; nome: string };
}

interface ClassDetail {
  id: string;
  nome: string;
  turno: string | null;
  sala: string | null;
  coordenador: string | null;
  gradeInicio: string | null;
  gradeFim: string | null;
  cargas: Carga[];
}

interface Discipline {
  id: string;
  nome: string;
}

interface Teacher {
  id: string;
  name: string;
  ativo: boolean;
  disciplinas: Discipline[];
}

interface Janela {
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

interface Proposta {
  disciplinaId: string;
  disciplinaNome: string;
  professorId: string;
  professorNome: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

interface NaoAlocado {
  disciplinaId: string;
  disciplinaNome: string;
  faltantes: number;
  motivo: string;
}

interface GenerateResult {
  propostas: Proposta[];
  naoAlocados: NaoAlocado[];
  aulasAtuais: number;
}

const cardClass = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100";

// O fim do dia chega como 23:59 e é exibido como 24:00.
function endToSlot(time: string) {
  return time >= "23:59" ? SLOTS : timeToSlot(time);
}

function displayTime(time: string) {
  return time >= "23:59" ? "24:00" : time;
}

function cargaMinutes(cargas: { aulasPorSemana: number; duracaoMinutos: number }[]) {
  return cargas.reduce((sum, c) => sum + c.aulasPorSemana * c.duracaoMinutos, 0);
}

function rowsOf(cargas: Carga[]): CargaRow[] {
  return cargas.map((c) => makeRow(c.disciplina.nome, c.aulasPorSemana, c.duracaoMinutos));
}

function Spinner({ text }: { text: string }) {
  return (
    <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
      <Loader2 size={18} className="animate-spin" /> {text}
    </p>
  );
}

export function ScheduleWizard() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [catalog, setCatalog] = useState<Discipline[]>([]);
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);

  const [classId, setClassId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [loadingClass, setLoadingClass] = useState(false);
  const [shift, setShift] = useState("");
  const [gradeInicio, setGradeInicio] = useState<string | null>(null);
  const [gradeFim, setGradeFim] = useState<string | null>(null);
  const [rows, setRows] = useState<CargaRow[]>([]);

  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [janelasFor, setJanelasFor] = useState<string | null>(null);

  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const [result, setResult] = useState<GenerateResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Grade ativa da turma escolhida (aulas na grade e data final >= hoje): pede confirmação antes de seguir.
  const [activeGrade, setActiveGrade] = useState<{ aulas: number } | null>(null);
  const [checkingActive, setCheckingActive] = useState(false);
  const [created, setCreated] = useState<number | null>(null);

  const loadBase = () => {
    api.get<ClassSummary[]>("/classes").then(setClasses).catch(() => setError("Não foi possível carregar as turmas."));
    api.get<Discipline[]>("/disciplinas").then(setCatalog).catch(() => setCatalog([]));
    api.get<Teacher[]>("/teachers").then(setTeachers).catch(() => setTeachers([]));
  };

  useEffect(loadBase, []);

  // Janelas da turma: carregadas uma vez por turma, ao entrar no passo 3.
  useEffect(() => {
    if (step !== 4 || !classId || janelasFor === classId) return;
    let cancelled = false;
    api
      .get<Janela[]>(`/classes/${classId}/janelas`)
      .then((list) => {
        if (cancelled) return;
        const next = emptyGrid();
        for (const janela of list) {
          const day = DAYS.findIndex((d) => d.key === janela.diaSemana);
          if (day === -1) continue;
          const from = Math.max(0, timeToSlot(janela.horarioInicio));
          const to = Math.min(SLOTS, endToSlot(janela.horarioFim));
          for (let i = from; i < to; i++) next[day][i] = true;
        }
        setGrid(next);
        setJanelasFor(classId);
      })
      .catch(() => !cancelled && setError("Não foi possível carregar os horários da turma."));
    return () => {
      cancelled = true;
    };
  }, [step, classId, janelasFor]);

  const applyDetail = (cls: ClassDetail) => {
    setDetail(cls);
    setShift(cls.turno ?? "");
    setGradeInicio(cls.gradeInicio ?? null);
    setGradeFim(cls.gradeFim ?? null);
    setRows(rowsOf(cls.cargas ?? []));
  };

  const continueFromClass = async () => {
    if (!classId || !detail) return;
    if (detail.gradeFim && detail.gradeFim >= todayInSaoPaulo()) {
      setCheckingActive(true);
      try {
        const aulas = await api.get<unknown[]>(`/schedule/by-class/${classId}`);
        if (aulas.length > 0) {
          setActiveGrade({ aulas: aulas.length });
          return;
        }
      } catch {
        // Sem a contagem, segue: a confirmação final de substituição ainda protege a grade atual.
      } finally {
        setCheckingActive(false);
      }
    }
    setStep(2);
  };

  const goTo = (next: number) => {
    setError(null);
    if (next < 6) setResult(null);
    setStep(next);
  };

  const selectClass = async (id: string) => {
    setError(null);
    if (id === classId && detail) {
      setStep(2);
      return;
    }
    setLoadingClass(true);
    try {
      const cls = await api.get<ClassDetail>(`/classes/${id}`);
      setClassId(id);
      applyDetail(cls);
      setJanelasFor(null);
      setGrid(emptyGrid());
      setExcluded(new Set());
      setResult(null);
      setCreated(null);
      setStep(2);
    } catch {
      setError("Não foi possível carregar a turma.");
    } finally {
      setLoadingClass(false);
    }
  };

  const savePeriod = async () => {
    if (!classId || !gradeInicio || !gradeFim) return;
    setBusy(true);
    setError(null);
    try {
      // Update parcial: só o período, sem `disciplinas`, para não substituir a matriz.
      await api.put(`/classes/${classId}`, { gradeInicio, gradeFim });
      setDetail((prev) => (prev ? { ...prev, gradeInicio, gradeFim } : prev));
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o período.");
    } finally {
      setBusy(false);
    }
  };

  const saveCurriculum = async () => {
    if (!detail || !classId) return;
    setBusy(true);
    setError(null);
    try {
      await api.put(`/classes/${classId}`, {
        nome: detail.nome,
        anoLetivo: new Date().getFullYear(),
        turno: shift || undefined,
        sala: detail.sala || undefined,
        coordenador: detail.coordenador || undefined,
        disciplinas: toDisciplinasPayload(rows, catalog)
      });
      const [cls, disciplinas] = await Promise.all([
        api.get<ClassDetail>(`/classes/${classId}`),
        api.get<Discipline[]>("/disciplinas")
      ]);
      setCatalog(disciplinas);
      applyDetail(cls);
      setStep(4);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar as disciplinas.");
    } finally {
      setBusy(false);
    }
  };

  const saveJanelas = async () => {
    if (!classId) return;
    setBusy(true);
    setError(null);
    try {
      const janelas = DAYS.flatMap((day, index) =>
        intervalsOf(grid[index]).map((i) => ({
          diaSemana: day.key,
          horarioInicio: i.inicio,
          horarioFim: slotToApiTime(i.to)
        }))
      );
      await api.put(`/classes/${classId}/janelas`, { janelas });
      setStep(5);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar os horários.");
    } finally {
      setBusy(false);
    }
  };

  const cargas = useMemo(() => detail?.cargas ?? [], [detail]);

  const eligibleTeachers = useMemo(() => {
    const ids = new Set(cargas.map((c) => c.disciplina.id));
    return (teachers ?? []).filter((t) => t.ativo && t.disciplinas.some((d) => ids.has(d.id)));
  }, [teachers, cargas]);

  const uncovered = useMemo(() => {
    const covered = new Set(
      eligibleTeachers.filter((t) => !excluded.has(t.id)).flatMap((t) => t.disciplinas.map((d) => d.id))
    );
    return cargas.filter((c) => !covered.has(c.disciplina.id));
  }, [eligibleTeachers, excluded, cargas]);

  const colorOf = (disciplinaId: string) => {
    const index = cargas.findIndex((c) => c.disciplina.id === disciplinaId);
    return PALETTE[(index === -1 ? 0 : index) % PALETTE.length];
  };

  const generate = async () => {
    if (!classId) return;
    setBusy(true);
    setError(null);
    try {
      const professoresExcluidos = eligibleTeachers.filter((t) => excluded.has(t.id)).map((t) => t.id);
      const data = await api.post<GenerateResult>("/schedule/generate", {
        turmaId: classId,
        ...(professoresExcluidos.length > 0 ? { professoresExcluidos } : {})
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível gerar a grade.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!classId || !result) return;
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ criadas: number }>("/schedule/replace", {
        turmaId: classId,
        aulas: result.propostas.map((p) => ({
          disciplinaId: p.disciplinaId,
          professorId: p.professorId,
          diaSemana: p.diaSemana,
          horarioInicio: p.horarioInicio,
          horarioFim: p.horarioFim
        }))
      });
      setCreated(res.criadas);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a grade.");
    } finally {
      setBusy(false);
    }
  };

  const requiredMinutes = cargaMinutes(cargas);
  const availableMinutes = grid.reduce((sum, col) => sum + col.filter(Boolean).length, 0) * 30;
  const hasWindows = availableMinutes > 0;

  const events: WeekGridEvent[] = (result?.propostas ?? []).map((p) => ({
    day: DAYS.findIndex((d) => d.key === p.diaSemana),
    from: timeToSlot(p.horarioInicio),
    to: endToSlot(p.horarioFim),
    title: p.disciplinaNome,
    subtitle: p.professorNome,
    color: colorOf(p.disciplinaId)
  }));

  // Controle do rodapé (Voltar / Continuar) por passo.
  const next: { label: string; onClick: () => void; disabled: boolean } | null =
    step === 1
      ? { label: "Continuar", onClick: continueFromClass, disabled: !classId || !detail || checkingActive }
      : step === 2
        ? { label: "Salvar e continuar", onClick: savePeriod, disabled: busy || !gradeInicio || !gradeFim || gradeFim < gradeInicio }
        : step === 3
          ? { label: "Salvar e continuar", onClick: saveCurriculum, disabled: busy || rows.length === 0 }
          : step === 4
            ? { label: "Salvar e continuar", onClick: saveJanelas, disabled: busy || !hasWindows || janelasFor !== classId }
            : step === 5
              ? { label: "Continuar", onClick: () => goTo(6), disabled: eligibleTeachers.length === 0 }
              : null;

  const openConfirm = () => {
    if (result && result.aulasAtuais > 0) setConfirming(true);
    else confirm();
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-teal-600 p-4 text-white">
        <Link href="/dashboard" className="mr-3" aria-label="Voltar ao início">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1>Gerar grade horária</h1>
          {detail && <p className="text-xs text-teal-100">{detail.nome}</p>}
        </div>
      </div>

      <Stepper step={step} onGo={(n) => n < step && goTo(n)} />

      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-40">
        {created !== null && detail && (
          <GradeCreatedDialog turma={detail.nome} aulas={created} gradeInicio={detail.gradeInicio} gradeFim={detail.gradeFim} />
        )}

            {step === 1 && (
              <section className="space-y-3">
                <Intro title="Qual turma?" text="Escolha a turma que terá a grade gerada." />
                {classes === null && !error && <Spinner text="Carregando turmas..." />}
                {classes?.length === 0 && (
                  <p className={`${cardClass} text-center text-sm text-gray-500`}>Nenhuma turma cadastrada ainda.</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {classes?.map((cls) => {
                    const minutes = cargaMinutes(cls.cargas ?? []);
                    const active = cls.id === classId;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        disabled={loadingClass}
                        onClick={() => selectClass(cls.id)}
                        className={`${cardClass} flex items-center gap-3 text-left transition hover:shadow-md disabled:opacity-60 ${
                          active ? "ring-2 ring-teal-500" : ""
                        }`}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                          <Users size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-800">{cls.nome}</p>
                          <p className="text-xs text-gray-500">
                            {cls.turno || "Sem turno"} · {cls.cargas?.length ?? 0} disciplina
                            {(cls.cargas?.length ?? 0) !== 1 ? "s" : ""}
                            {minutes > 0 ? ` · ${formatHours(minutes)}/semana` : ""}
                          </p>
                          {cls.gradeInicio && cls.gradeFim && (
                            <p className="text-xs text-teal-700">Período: {formatPeriodo(cls.gradeInicio, cls.gradeFim)}</p>
                          )}
                        </div>
                        <ChevronRight size={18} className="text-gray-400" />
                      </button>
                    );
                  })}
                </div>
                {loadingClass && <Spinner text="Abrindo turma..." />}
              </section>
            )}

            {step === 2 && detail && (
              <>
                <Intro title="Período da grade" text="Escolha o intervalo em que esta grade vale." />
                <section className={cardClass}>
                  <PeriodPicker
                    inicio={gradeInicio}
                    fim={gradeFim}
                    onChange={(a, b) => {
                      setGradeInicio(a);
                      setGradeFim(b);
                    }}
                  />
                </section>
              </>
            )}

            {step === 3 && detail && (
              <>
                <Intro title="Disciplinas e turno" text="Defina o turno e a carga semanal de cada disciplina da turma." />
                <section className={`${cardClass} space-y-3`}>
                  <span className="block text-sm font-medium text-gray-700">Turno</span>
                  <div className="grid grid-cols-4 gap-2">
                    {SHIFTS.map((s) => {
                      const active = shift === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setShift(active ? "" : s)}
                          className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                            active
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-gray-300 bg-white text-gray-700 hover:border-teal-400"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <CurriculumEditor rows={rows} onChange={setRows} catalog={catalog} onError={setError} />
                {rows.length === 0 && <p className="text-sm text-amber-600">Adicione ao menos uma disciplina para continuar.</p>}
              </>
            )}

            {step === 4 && (
              <>
                <Intro title="Horários da turma" text="Marque quando a turma pode ter aula." />
                <section className={`${cardClass} space-y-2`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600">
                      <strong className="text-teal-700">{formatSlots(availableMinutes / 30)}</strong> disponíveis/semana
                    </span>
                    <span className="text-gray-600">
                      <strong className="text-gray-800">{formatHours(requiredMinutes)}</strong> necessárias
                    </span>
                  </div>
                  {hasWindows && availableMinutes < requiredMinutes && (
                    <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      Os horários marcados são menores que a carga semanal da matriz; algumas aulas podem ficar sem alocação.
                    </p>
                  )}
                  <WeekGrid
                    value={grid}
                    onChange={setGrid}
                    ready={janelasFor === classId}
                    className="h-[28rem] rounded-xl border border-slate-200"
                  >
                    {janelasFor !== classId && !error && <Spinner text="Carregando horários..." />}
                  </WeekGrid>
                  {!hasWindows && janelasFor === classId && (
                    <p className="text-sm text-amber-600">Marque ao menos um horário para continuar.</p>
                  )}
                </section>
              </>
            )}

            {step === 5 && (
              <>
                <Intro title="Professores" text="Escolha quem pode entrar na grade. Por padrão, todos estão incluídos." />
                {teachers === null && <Spinner text="Carregando professores..." />}
                {teachers && eligibleTeachers.length === 0 && (
                  <p className={`${cardClass} text-center text-sm text-gray-500`}>
                    Nenhum professor ativo leciona as disciplinas desta turma.
                  </p>
                )}
                {uncovered.length > 0 && eligibleTeachers.length > 0 && (
                  <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <span>
                      Sem professor incluído para: {uncovered.map((c) => c.disciplina.nome).join(", ")}.
                    </span>
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {eligibleTeachers.map((teacher) => {
                    const included = !excluded.has(teacher.id);
                    const matrixIds = new Set(cargas.map((c) => c.disciplina.id));
                    return (
                      <div key={teacher.id} className={`${cardClass} ${included ? "" : "opacity-60"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate font-medium text-gray-800">{teacher.name}</p>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={included}
                            aria-label={`${included ? "Excluir" : "Incluir"} ${teacher.name}`}
                            onClick={() =>
                              setExcluded((prev) => {
                                const copy = new Set(prev);
                                if (included) copy.add(teacher.id);
                                else copy.delete(teacher.id);
                                return copy;
                              })
                            }
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                              included ? "bg-teal-600" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                                included ? "left-[22px]" : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {teacher.disciplinas
                            .filter((d) => matrixIds.has(d.id))
                            .map((d) => (
                              <span
                                key={d.id}
                                className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                              >
                                {d.nome}
                              </span>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {step === 6 && (
              <>
                {!result ? (
                  <section className={`${cardClass} space-y-4 py-8 text-center`}>
                    <Sparkles size={44} className="mx-auto text-teal-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">Tudo pronto</h2>
                      <p className="mt-1 text-sm text-gray-600">
                        Vamos montar a grade de {detail?.nome}
                        {gradeInicio && gradeFim ? ` (${formatPeriodo(gradeInicio, gradeFim)})` : ""} com a matriz, os horários da turma e os professores escolhidos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={generate}
                      disabled={busy}
                      className="mx-auto flex w-full max-w-xs items-center justify-center rounded-full bg-teal-600 py-4 text-lg text-white shadow transition-colors hover:bg-teal-700 disabled:opacity-60"
                    >
                      {busy ? <Loader2 size={22} className="mr-2 animate-spin" /> : <Sparkles size={22} className="mr-2" />}
                      {busy ? "Gerando..." : "Gerar grade horária"}
                    </button>
                  </section>
                ) : (
                  <>
                    <Intro
                      title="Revise a grade"
                      text={`${result.propostas.length} aula${result.propostas.length !== 1 ? "s" : ""} proposta${
                        result.propostas.length !== 1 ? "s" : ""
                      }${gradeInicio && gradeFim ? ` Período: ${formatPeriodo(gradeInicio, gradeFim)}.` : ""}`}
                    />
                    <section className={`${cardClass} space-y-3`}>
                      <WeekGrid
                        value={grid}
                        readOnly
                        events={events}
                        className="h-[28rem] rounded-xl border border-slate-200"
                      />
                      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {cargas.map((c) => (
                          <li key={c.disciplina.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                            <span className="h-3 w-3 rounded" style={{ backgroundColor: colorOf(c.disciplina.id) }} />
                            {c.disciplina.nome}
                          </li>
                        ))}
                      </ul>
                    </section>

                    {result.naoAlocados.length > 0 && (
                      <section className="space-y-2 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                        <h3 className="flex items-center gap-2 font-semibold text-amber-900">
                          <AlertTriangle size={18} /> Não alocadas
                        </h3>
                        <ul className="space-y-2">
                          {result.naoAlocados.map((n) => (
                            <li key={n.disciplinaId} className="text-sm text-amber-900">
                              <p className="font-medium">
                                {n.disciplinaNome}: {n.faltantes} aula{n.faltantes !== 1 ? "s" : ""} faltando
                              </p>
                              <p className="text-xs text-amber-800">{MOTIVOS[n.motivo] ?? n.motivo}</p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      </div>

      {created === null && (
        <div className="fixed bottom-16 left-0 right-0 z-40 flex gap-3 border-t bg-white p-4">
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={step === 1 || busy}
            className="rounded-full border border-gray-300 px-5 py-3 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Voltar
          </button>
          {step === 6 ? (
            result && (
              <>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-teal-600 px-4 py-3 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Gerar novamente
                </button>
                <button
                  type="button"
                  onClick={openConfirm}
                  disabled={busy || result.propostas.length === 0}
                  className="flex flex-1 items-center justify-center rounded-full bg-teal-600 py-3 text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  <Check size={18} className="mr-1.5" /> Confirmar grade
                </button>
              </>
            )
          ) : (
            next && (
              <button
                type="button"
                onClick={next.onClick}
                disabled={next.disabled}
                className="flex flex-1 items-center justify-center rounded-full bg-teal-600 py-3 text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {busy ? <Loader2 size={18} className="mr-2 animate-spin" /> : null}
                {busy ? "Salvando..." : next.label}
              </button>
            )
          )}
        </div>
      )}

      {activeGrade && detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <h3 className="font-semibold text-gray-800">Você tem certeza?</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Já existe uma grade horária ativa para a turma <strong>{detail.nome}</strong>
                  {detail.gradeInicio && detail.gradeFim && <>, válida de {formatPeriodo(detail.gradeInicio, detail.gradeFim)}</>}, com{" "}
                  {activeGrade.aulas} aula{activeGrade.aulas !== 1 ? "s" : ""} por semana.
                </p>
                <p className="mt-2 text-sm text-gray-600">Ao confirmar a nova grade, ela substituirá a atual.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActiveGrade(null)}
                className="flex-1 rounded-full border border-gray-300 py-2.5 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveGrade(null);
                  setStep(2);
                }}
                className="flex-1 rounded-full bg-teal-600 py-2.5 text-white hover:bg-teal-700"
              >
                Criar nova grade
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming && result && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <h3 className="font-semibold text-gray-800">Substituir a grade atual?</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Isso substituirá as {result.aulasAtuais} aulas atuais da turma.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-full border border-gray-300 py-2.5 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                className="flex-1 rounded-full bg-teal-600 py-2.5 text-white hover:bg-teal-700"
              >
                Substituir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Intro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <p className="text-sm text-gray-600">{text}</p>
    </div>
  );
}

function Stepper({ step, onGo }: { step: number; onGo: (step: number) => void }) {
  return (
    <div className="border-b bg-white px-4 py-3">
      <ol className="mx-auto flex max-w-xl items-center">
        {STEPS.map((s, index) => {
          const number = index + 1;
          const done = number < step;
          const current = number === step;
          const Icon = s.icon;
          return (
            <li key={s.label} className={`flex items-center ${index < STEPS.length - 1 ? "flex-1" : ""}`}>
              <button
                type="button"
                onClick={() => onGo(number)}
                disabled={!done}
                aria-current={current ? "step" : undefined}
                className="flex flex-col items-center gap-1 disabled:cursor-default"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                    done
                      ? "bg-teal-600 text-white"
                      : current
                        ? "bg-teal-600 text-white ring-4 ring-teal-100"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {done ? <Check size={18} /> : <Icon size={18} />}
                </span>
                <span className={`text-[10px] ${current ? "font-medium text-teal-700" : "text-gray-500"}`}>{s.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <span className={`mx-1 mb-4 h-0.5 flex-1 rounded ${done ? "bg-teal-600" : "bg-gray-200"}`} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
