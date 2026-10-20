"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, BookOpen, Check, Plus, Sparkles, Trash2, Users, Zap } from "lucide-react";
import { useSchedule } from "@/components/schedule/schedule-context";
import { currentPeriodoLetivo } from "@/lib/periodo-letivo";
import { api, ApiError } from "@/lib/api";

const WEEK_DAYS_FULL: Record<string, string> = {
  SEGUNDA: "Segunda",
  TERCA: "Terça",
  QUARTA: "Quarta",
  QUINTA: "Quinta",
  SEXTA: "Sexta",
  SABADO: "Sábado",
  DOMINGO: "Domingo"
};

const MOTIVOS: Record<string, string> = {
  SEM_DISPONIBILIDADE: "Professor sem disponibilidade cadastrada no período",
  JANELA_INSUFICIENTE: "Nenhuma janela de disponibilidade comporta uma aula de 2h",
  CONFLITO: "Horários disponíveis conflitam com outras aulas do professor ou da turma"
};

const SLOT_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500",
  "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-pink-500",
  "bg-cyan-500", "bg-amber-500", "bg-lime-500", "bg-fuchsia-500"
];

const AVATAR_GRADIENTS = [
  "from-blue-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
  "from-orange-400 to-rose-500",
  "from-pink-400 to-fuchsia-500",
  "from-cyan-400 to-blue-500",
  "from-amber-400 to-orange-500",
  "from-lime-400 to-green-500"
];

interface Option {
  id: string;
  nome?: string;
  name?: string;
}

interface Pedido {
  id: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subject: string;
  classId: string;
  turma: string;
  quantidade: number;
}

interface Proposta {
  pedidoIndex: number;
  professorId: string;
  disciplinaId: string;
  turmaId: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
  sala: string | null;
  tipo: "AULA" | "PLANTAO" | "AULAO";
}

interface NaoAlocado {
  pedidoIndex: number;
  faltantes: number;
  motivo: string;
}

interface Conflito {
  aulaIndex: number;
  recurso: "PROFESSOR" | "TURMA";
  origem: "EXISTENTE" | "PROPOSTA";
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

const PERIODO_LETIVO = currentPeriodoLetivo();

export function SmartScheduleBuilder() {
  const router = useRouter();
  const { refresh } = useSchedule();

  const [step, setStep] = useState<"list" | "add" | "result">("list");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [naoAlocados, setNaoAlocados] = useState<NaoAlocado[]>([]);
  const [conflitos, setConflitos] = useState<Conflito[]>([]);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    teacherId: "",
    teacherName: "",
    subjectId: "",
    subject: "",
    classId: "",
    turma: "",
    quantidade: 1
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [teacherOptions, setTeacherOptions] = useState<Option[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<Option[]>([]);
  const [classOptions, setClassOptions] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    api.get<Option[]>("/teachers").then(setTeacherOptions).catch(() => setTeacherOptions([]));
    api.get<Option[]>("/disciplinas").then(setSubjectOptions).catch(() => setSubjectOptions([]));
    api.get<Option[]>("/classes").then(setClassOptions).catch(() => setClassOptions([]));
  }, []);

  const filteredSuggestions = teacherOptions.filter(
    (t) => form.teacherName.length > 0 && (t.name ?? "").toLowerCase().includes(form.teacherName.toLowerCase())
  );

  const canAdd = Boolean(form.teacherId && form.subjectId && form.classId && form.quantidade >= 1 && form.quantidade <= 20);

  const addPedido = () => {
    if (!canAdd) return;
    setPedidos((prev) => [
      ...prev,
      {
        id: `e-${Date.now()}`,
        teacherId: form.teacherId,
        teacherName: form.teacherName.trim(),
        subjectId: form.subjectId,
        subject: form.subject,
        classId: form.classId,
        turma: form.turma,
        quantidade: form.quantidade
      }
    ]);
    setForm({ teacherId: "", teacherName: "", subjectId: "", subject: "", classId: "", turma: "", quantidade: 1 });
    setStep("list");
  };

  const removePedido = (id: string) => setPedidos((prev) => prev.filter((p) => p.id !== id));

  const removeProposta = (index: number) => setPropostas((prev) => prev.filter((_, i) => i !== index));

  const generate = async () => {
    setSuggesting(true);
    setError(null);
    setConflitos([]);
    try {
      const result = await api.post<{ propostas: Proposta[]; naoAlocados: NaoAlocado[] }>("/schedule/suggest", {
        periodoLetivo: PERIODO_LETIVO,
        pedidos: pedidos.map((p) => ({
          professorId: p.teacherId,
          disciplinaId: p.subjectId,
          turmaId: p.classId,
          quantidade: p.quantidade
        }))
      });
      setPropostas(result.propostas);
      setNaoAlocados(result.naoAlocados);
      setStep("result");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível gerar a sugestão de grade.");
    } finally {
      setSuggesting(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    setConflitos([]);
    try {
      await api.post("/schedule/confirm", {
        aulas: propostas.map((p) => ({
          turmaId: p.turmaId,
          disciplinaId: p.disciplinaId,
          professorId: p.professorId,
          diaSemana: p.diaSemana,
          horarioInicio: p.horarioInicio,
          horarioFim: p.horarioFim,
          ...(p.sala ? { sala: p.sala } : {}),
          tipo: p.tipo
        }))
      });
      await refresh();
      setSaved(true);
      setTimeout(() => router.push("/schedule/weekly"), 1500);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflitos((err.body as { conflitos?: Conflito[] } | null)?.conflitos ?? []);
      }
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a grade.");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-5 pb-6 pt-5 text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (step === "add" || step === "result") {
                setStep("list");
                return;
              }
              router.push("/dashboard");
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-white">{step === "add" ? "Adicionar Pedido" : step === "result" ? "Resultado da Grade" : "Grade Inteligente"}</h1>
            <p className="mt-0.5 text-xs text-purple-200">
              {step === "add"
                ? "Defina professor, matéria, turma e quantidade de aulas"
                : step === "result"
                  ? `${propostas.length} aulas sugeridas · ${naoAlocados.length} pedidos não atendidos`
                  : "Monte a grade sem conflitos de horários"}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Sparkles size={18} />
          </div>
        </div>
      </div>

      {step === "list" && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-40">
            {pedidos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
                  <Users size={28} className="text-violet-400" />
                </div>
                <p className="text-sm text-slate-600">Nenhum pedido adicionado</p>
                <p className="mt-1 max-w-56 text-xs text-slate-400">Informe professor, matéria, turma e quantidade de aulas. Os horários são sugeridos a partir da disponibilidade cadastrada.</p>
              </div>
            )}

            {pedidos.map((pedido, idx) => (
              <div key={pedido.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`}>
                    <span className="text-sm font-bold text-white">{pedido.teacherName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800">{pedido.teacherName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {pedido.subject && <span className="text-xs text-slate-500">{pedido.subject}</span>}
                      {pedido.turma && (
                        <>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{pedido.turma}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-violet-600">{pedido.quantidade}</p>
                    <p className="text-[10px] text-slate-400">aulas</p>
                  </div>
                  <button type="button" onClick={() => removePedido(pedido.id)} className="ml-1 rounded-lg p-1.5 transition-colors hover:bg-red-50">
                    <Trash2 size={15} className="text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))}

            {error && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
                <AlertTriangle size={20} className="text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          <div className="fixed bottom-16 left-0 right-0 z-40 space-y-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setStep("add")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-3 text-sm text-slate-500 transition-colors hover:border-violet-300 hover:text-violet-500"
            >
              <Plus size={17} />
              Adicionar pedido
            </button>
            {pedidos.length > 0 && (
              <button
                type="button"
                onClick={generate}
                disabled={suggesting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 text-white shadow-md shadow-violet-200 transition-colors hover:bg-violet-700 disabled:opacity-60"
              >
                <Zap size={18} />
                {suggesting ? "Gerando..." : `Sugerir grade para ${pedidos.length} pedido${pedidos.length !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </>
      )}

      {step === "add" && (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-36">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-2 flex items-center gap-1 text-xs text-slate-500">
                <Users size={11} /> Nome do professor
              </label>
              <div className="relative">
                <input
                  value={form.teacherName}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, teacherName: e.target.value, teacherId: "" }));
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Ex: Ana Silva"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {filteredSuggestions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onMouseDown={() => {
                          setForm((f) => ({ ...f, teacherId: t.id, teacherName: t.name ?? "" }));
                          setShowSuggestions(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-violet-50"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 flex items-center gap-1 text-xs text-slate-500">
                  <BookOpen size={11} /> Matéria
                </label>
                <select
                  value={form.subjectId}
                  onChange={(e) => {
                    const opt = subjectOptions.find((s) => s.id === e.target.value);
                    setForm((f) => ({ ...f, subjectId: e.target.value, subject: opt?.nome ?? "" }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Selecionar...</option>
                  {subjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 flex items-center gap-1 text-xs text-slate-500">
                  <Users size={11} /> Turma
                </label>
                <select
                  value={form.classId}
                  onChange={(e) => {
                    const opt = classOptions.find((c) => c.id === e.target.value);
                    setForm((f) => ({ ...f, classId: e.target.value, turma: opt?.nome ?? "" }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Selecionar...</option>
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-2 flex items-center gap-1 text-xs text-slate-500">Quantidade de aulas (2h cada)</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.quantidade}
                onChange={(e) => setForm((f) => ({ ...f, quantidade: Math.floor(Number(e.target.value)) }))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          </div>

          <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-md">
            <button
              type="button"
              onClick={addPedido}
              disabled={!canAdd}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 transition-all ${
                canAdd
                  ? "bg-violet-600 text-white shadow-md shadow-violet-200 hover:bg-violet-700"
                  : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
            >
              <Plus size={18} />
              Adicionar pedido{canAdd ? ` · ${form.quantidade} aula${form.quantidade !== 1 ? "s" : ""}` : ""}
            </button>
          </div>
        </>
      )}

      {step === "result" && (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-40">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-violet-600">{propostas.length}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Aulas sugeridas</p>
              </div>
              <div className={`rounded-2xl border p-3 text-center shadow-sm ${naoAlocados.length > 0 ? "border-red-100 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                <p className={`text-2xl font-bold ${naoAlocados.length > 0 ? "text-red-500" : "text-slate-400"}`}>{naoAlocados.length}</p>
                <p className={`mt-0.5 text-[10px] ${naoAlocados.length > 0 ? "text-red-400" : "text-slate-400"}`}>Não atendidos</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-indigo-500">{pedidos.length}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Pedidos</p>
              </div>
            </div>

            {propostas.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <Check size={14} className="text-emerald-500" />
                  <h3 className="text-sm text-slate-700">Aulas a inserir na grade</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {propostas.map((item, i) => {
                    const pedido = pedidos[item.pedidoIndex];
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className={`h-9 w-2 shrink-0 rounded-full ${SLOT_COLORS[item.pedidoIndex % SLOT_COLORS.length]}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-800">{pedido?.subject}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {WEEK_DAYS_FULL[item.diaSemana]} · {item.horarioInicio}–{item.horarioFim}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="max-w-24 truncate text-xs text-slate-600">{pedido?.teacherName}</p>
                          <p className="text-[10px] text-slate-400">{pedido?.turma}</p>
                        </div>
                        <button type="button" onClick={() => removeProposta(i)} className="rounded-lg p-1.5 transition-colors hover:bg-red-50">
                          <Trash2 size={15} className="text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {naoAlocados.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-red-100 px-4 py-3">
                  <AlertTriangle size={14} className="text-red-500" />
                  <h3 className="text-sm text-red-700">Aulas não alocadas</h3>
                </div>
                <div className="divide-y divide-red-50">
                  {naoAlocados.map((n, i) => {
                    const pedido = pedidos[n.pedidoIndex];
                    return (
                      <div key={i} className="px-4 py-3">
                        <p className="text-sm text-slate-700">
                          {pedido?.teacherName} · {pedido?.subject} · {pedido?.turma} — {n.faltantes} aula{n.faltantes !== 1 ? "s" : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-red-500">{MOTIVOS[n.motivo] ?? n.motivo}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {propostas.length === 0 && (
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-6 text-center">
                <AlertTriangle size={32} className="mx-auto mb-2 text-orange-400" />
                <p className="text-sm text-orange-700">Nenhuma aula pôde ser sugerida</p>
                <p className="mt-1 text-xs text-orange-500">Verifique a disponibilidade dos professores e a agenda existente.</p>
              </div>
            )}

            {conflitos.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-red-100 px-4 py-3">
                  <AlertTriangle size={14} className="text-red-500" />
                  <h3 className="text-sm text-red-700">Conflitos detectados ao salvar</h3>
                </div>
                <div className="divide-y divide-red-50">
                  {conflitos.map((c, i) => {
                    const item = propostas[c.aulaIndex];
                    const pedido = item ? pedidos[item.pedidoIndex] : undefined;
                    return (
                      <div key={i} className="px-4 py-3">
                        <p className="text-sm text-slate-700">
                          {pedido?.teacherName} · {pedido?.subject}
                          {item ? ` — ${WEEK_DAYS_FULL[item.diaSemana]} ${item.horarioInicio}–${item.horarioFim}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-red-500">
                          {c.recurso === "PROFESSOR" ? "Professor" : "Turma"} em conflito com {c.origem === "EXISTENTE" ? "aula existente" : "outra aula desta grade"} (
                          {WEEK_DAYS_FULL[c.diaSemana]} {c.horarioInicio}–{c.horarioFim})
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {saved && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <Check size={20} className="text-emerald-500" />
                <p className="text-sm text-emerald-700">Grade salva com sucesso! Redirecionando...</p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
                <AlertTriangle size={20} className="text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          <div className="fixed bottom-16 left-0 right-0 z-40 space-y-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-md">
            {propostas.length > 0 && !saved && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-white shadow-md shadow-emerald-200 transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                <Check size={18} />
                {saving ? "Salvando..." : `Confirmar e salvar grade (${propostas.length} aulas)`}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setStep("list");
                setSaved(false);
                setError(null);
                setConflitos([]);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              Voltar e ajustar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
