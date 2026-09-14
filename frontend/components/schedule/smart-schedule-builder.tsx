"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, BookOpen, Check, Plus, RotateCcw, Sparkles, Trash2, Users, Zap } from "lucide-react";
import { useSchedule } from "@/components/schedule/schedule-context";

const TIME_SLOTS = ["07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex"];
const WEEK_DAYS_FULL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const SUBJECTS = ["Matemática", "Física", "Química", "Biologia", "História", "Geografia", "Português", "Redação", "Inglês", "Filosofia", "Sociologia", "Literatura"];
const CLASSES_LIST = ["Extensivo", "Intensivo", "Reta Final", "Medicina", "Engenharia", "Semi-extensivo"];

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

const FALLBACK_TEACHERS = ["Ana Silva", "Carlos Santos", "Maria Oliveira", "João Costa", "Pedro Lima"];

interface TeacherEntry {
  id: string;
  teacherName: string;
  subject: string;
  turma: string;
  slots: Set<string>;
  colorIndex: number;
}

interface GeneratedItem {
  day: number;
  startTime: string;
  endTime: string;
  subject: string;
  class: string;
  teacher: string;
  room: string;
  color: string;
  type: "aula" | "plantao" | "aulao";
  duration: number;
}

interface ConflictInfo {
  teacher: string;
  slot: string;
  reason: string;
}

function addHours(time: string, h: number): string {
  const [hh, mm] = time.split(":").map(Number);
  return `${String(hh + h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(s1: string, e1: string, s2: string, e2: string) {
  return toMin(s1) < toMin(e2) && toMin(e1) > toMin(s2);
}

const SLOT_HOURS = 2;

export function SmartScheduleBuilder() {
  const router = useRouter();
  const { schedules, addSchedule } = useSchedule();

  const [step, setStep] = useState<"list" | "add" | "result">("list");
  const [entries, setEntries] = useState<TeacherEntry[]>([]);
  const [generated, setGenerated] = useState<GeneratedItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    teacherName: "",
    subject: "",
    turma: "",
    slots: new Set<string>()
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allTeachers, setAllTeachers] = useState<string[]>([]);

  useEffect(() => {
    const fromSched = schedules.map((s) => s.teacher);
    setAllTeachers([...new Set([...fromSched, ...FALLBACK_TEACHERS])]);
  }, [schedules]);

  const filteredSuggestions = allTeachers.filter(
    (t) => form.teacherName.length > 0 && t.toLowerCase().includes(form.teacherName.toLowerCase())
  );

  const toggleFormSlot = (day: number, time: string) => {
    const key = `${day}-${time}`;
    setForm((f) => {
      const next = new Set(f.slots);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...f, slots: next };
    });
  };

  const clearFormSlots = () => setForm((f) => ({ ...f, slots: new Set() }));

  const addEntry = () => {
    if (!form.teacherName.trim() || form.slots.size === 0) return;
    const colorIndex = entries.length % SLOT_COLORS.length;
    setEntries((prev) => [
      ...prev,
      {
        id: `e-${Date.now()}`,
        teacherName: form.teacherName.trim(),
        subject: form.subject,
        turma: form.turma,
        slots: new Set(form.slots),
        colorIndex
      }
    ]);
    setForm({ teacherName: "", subject: "", turma: "", slots: new Set() });
    setStep("list");
  };

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const generate = () => {
    const result: GeneratedItem[] = [];
    const conflictList: ConflictInfo[] = [];
    let roomCounter = 101;

    const occupiedByTeacher = schedules.map((s) => ({
      teacher: s.teacher,
      day: s.day,
      start: s.startTime,
      end: s.endTime,
      subject: s.subject
    }));

    for (const entry of entries) {
      const sortedSlots = Array.from(entry.slots)
        .map((k) => {
          const [d, t] = k.split("-");
          return { day: parseInt(d), time: t };
        })
        .sort((a, b) => a.day - b.day || toMin(a.time) - toMin(b.time));

      for (const { day, time } of sortedSlots) {
        const end = addHours(time, SLOT_HOURS);

        const existingConflict = occupiedByTeacher.find(
          (o) => o.teacher === entry.teacherName && o.day === day && overlaps(o.start, o.end, time, end)
        );
        if (existingConflict) {
          conflictList.push({
            teacher: entry.teacherName,
            slot: `${WEEK_DAYS_FULL[day]} ${time}`,
            reason: `Já tem "${existingConflict.subject}" das ${existingConflict.start}–${existingConflict.end}`
          });
          continue;
        }

        const generatedConflict = result.find(
          (g) => g.teacher === entry.teacherName && g.day === day && overlaps(g.startTime, g.endTime, time, end)
        );
        if (generatedConflict) {
          conflictList.push({
            teacher: entry.teacherName,
            slot: `${WEEK_DAYS_FULL[day]} ${time}`,
            reason: `Já alocado em "${generatedConflict.subject}" neste horário`
          });
          continue;
        }

        result.push({
          day,
          startTime: time,
          endTime: end,
          subject: entry.subject || "A definir",
          class: entry.turma || "Extensivo",
          teacher: entry.teacherName,
          room: `Sala ${roomCounter++}`,
          color: SLOT_COLORS[entry.colorIndex],
          type: "aula",
          duration: SLOT_HOURS
        });
      }
    }

    setGenerated(result);
    setConflicts(conflictList);
    setStep("result");
  };

  const handleConfirm = () => {
    generated.forEach((item) => addSchedule(item));
    setSaved(true);
    setTimeout(() => router.push("/schedule/weekly"), 1500);
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-5 pb-6 pt-5 text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (step === "add") {
                setStep("list");
                return;
              }
              if (step === "result") {
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
            <h1 className="text-white">{step === "add" ? "Adicionar Professor" : step === "result" ? "Resultado da Grade" : "Grade Inteligente"}</h1>
            <p className="mt-0.5 text-xs text-purple-200">
              {step === "add"
                ? "Defina os horários disponíveis"
                : step === "result"
                  ? `${generated.length} aulas geradas · ${conflicts.length} conflitos`
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
            {entries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
                  <Users size={28} className="text-violet-400" />
                </div>
                <p className="text-sm text-slate-600">Nenhum professor adicionado</p>
                <p className="mt-1 max-w-56 text-xs text-slate-400">Adicione professores com seus horários disponíveis e matérias para montar a grade</p>
              </div>
            )}

            {entries.map((entry, idx) => (
              <div key={entry.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`}>
                    <span className="text-sm font-bold text-white">{entry.teacherName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800">{entry.teacherName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {entry.subject && <span className="text-xs text-slate-500">{entry.subject}</span>}
                      {entry.turma && (
                        <>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{entry.turma}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-violet-600">{entry.slots.size}</p>
                    <p className="text-[10px] text-slate-400">slots</p>
                  </div>
                  <button type="button" onClick={() => removeEntry(entry.id)} className="ml-1 rounded-lg p-1.5 transition-colors hover:bg-red-50">
                    <Trash2 size={15} className="text-slate-400 hover:text-red-500" />
                  </button>
                </div>

                <div className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1">
                    {Array.from(entry.slots)
                      .sort()
                      .map((k) => {
                        const [d, t] = k.split("-");
                        return (
                          <span key={k} className={`rounded-full px-2 py-0.5 text-[10px] text-white ${SLOT_COLORS[entry.colorIndex]}`}>
                            {WEEK_DAYS[parseInt(d)]} {t}
                          </span>
                        );
                      })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="fixed bottom-16 left-0 right-0 z-40 space-y-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setStep("add")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-3 text-sm text-slate-500 transition-colors hover:border-violet-300 hover:text-violet-500"
            >
              <Plus size={17} />
              Adicionar professor
            </button>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={generate}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 text-white shadow-md shadow-violet-200 transition-colors hover:bg-violet-700"
              >
                <Zap size={18} />
                Gerar Grade com {entries.length} professor{entries.length !== 1 ? "es" : ""}
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
                    setForm((f) => ({ ...f, teacherName: e.target.value }));
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
                        key={t}
                        type="button"
                        onMouseDown={() => {
                          setForm((f) => ({ ...f, teacherName: t }));
                          setShowSuggestions(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-violet-50"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 flex items-center gap-1 text-xs text-slate-500">
                  <BookOpen size={11} /> Matéria <span className="ml-0.5 text-slate-300">(opt.)</span>
                </label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Selecionar...</option>
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 flex items-center gap-1 text-xs text-slate-500">
                  <Users size={11} /> Turma <span className="ml-0.5 text-slate-300">(opt.)</span>
                </label>
                <select
                  value={form.turma}
                  onChange={(e) => setForm((f) => ({ ...f, turma: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Selecionar...</option>
                  {CLASSES_LIST.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm text-slate-700">Horários disponíveis</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Toque nos horários em que este professor pode dar aulas</p>
                </div>
                {form.slots.size > 0 && (
                  <button type="button" onClick={clearFormSlots} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                    <RotateCcw size={11} /> Limpar
                  </button>
                )}
              </div>

              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[280px] border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="w-12 pb-2 pl-1 text-left text-slate-400">Hora</th>
                      {WEEK_DAYS.map((d) => (
                        <th key={d} className="pb-2 text-center text-slate-600">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((time) => (
                      <tr key={time}>
                        <td className="whitespace-nowrap py-0.5 pl-1 pr-2 text-slate-400">{time}</td>
                        {WEEK_DAYS.map((_, dayIdx) => {
                          const key = `${dayIdx}-${time}`;
                          const selected = form.slots.has(key);
                          const end = addHours(time, SLOT_HOURS);
                          const hasConflict = schedules.some(
                            (s) => s.teacher === form.teacherName && s.day === dayIdx && overlaps(s.startTime, s.endTime, time, end)
                          );
                          return (
                            <td key={dayIdx} className="px-0.5 py-0.5">
                              <button
                                type="button"
                                onClick={() => !hasConflict && toggleFormSlot(dayIdx, time)}
                                disabled={hasConflict}
                                title={hasConflict ? "Professor já alocado aqui" : ""}
                                className={`flex h-8 w-full items-center justify-center rounded-lg transition-all ${
                                  hasConflict
                                    ? "cursor-not-allowed border border-red-100 bg-red-50"
                                    : selected
                                      ? "bg-violet-600 shadow-sm"
                                      : "border border-transparent bg-slate-100 hover:border-violet-200 hover:bg-violet-100"
                                }`}
                              >
                                {hasConflict ? <AlertTriangle size={10} className="text-red-400" /> : selected ? <Check size={12} className="text-white" /> : null}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded bg-violet-600" />
                  <span className="text-xs text-slate-500">Disponível</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex h-4 w-4 items-center justify-center rounded border border-red-100 bg-red-50">
                    <AlertTriangle size={8} className="text-red-400" />
                  </div>
                  <span className="text-xs text-slate-500">Já ocupado</span>
                </div>
                {form.slots.size > 0 && <span className="ml-auto text-xs text-violet-600">{form.slots.size} selecionado{form.slots.size !== 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>

          <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-md">
            <button
              type="button"
              onClick={addEntry}
              disabled={!form.teacherName.trim() || form.slots.size === 0}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 transition-all ${
                form.teacherName.trim() && form.slots.size > 0 ? "bg-violet-600 text-white shadow-md shadow-violet-200 hover:bg-violet-700" : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
            >
              <Plus size={18} />
              Adicionar {form.teacherName.trim() ? form.teacherName.trim().split(" ")[0] : "professor"} à grade
              {form.slots.size > 0 && ` · ${form.slots.size} horários`}
            </button>
          </div>
        </>
      )}

      {step === "result" && (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-40">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-violet-600">{generated.length}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Aulas geradas</p>
              </div>
              <div className={`rounded-2xl border p-3 text-center shadow-sm ${conflicts.length > 0 ? "border-red-100 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                <p className={`text-2xl font-bold ${conflicts.length > 0 ? "text-red-500" : "text-slate-400"}`}>{conflicts.length}</p>
                <p className={`mt-0.5 text-[10px] ${conflicts.length > 0 ? "text-red-400" : "text-slate-400"}`}>Conflitos</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-indigo-500">{entries.length}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Professores</p>
              </div>
            </div>

            {generated.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm text-slate-700">Prévia da Grade</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[340px] border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="w-14 py-2 pl-3 pr-2 text-left text-slate-500">Hora</th>
                        {WEEK_DAYS.map((d) => (
                          <th key={d} className="py-2 text-center text-slate-600">
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TIME_SLOTS.map((time) => {
                        const hasAny = generated.some((g) => g.startTime === time);
                        if (!hasAny) return null;
                        return (
                          <tr key={time} className="border-t border-slate-100">
                            <td className="whitespace-nowrap py-1.5 pl-3 pr-2 align-top pt-2 text-slate-400">{time}</td>
                            {WEEK_DAYS.map((_, dayIdx) => {
                              const item = generated.find((g) => g.day === dayIdx && g.startTime === time);
                              return (
                                <td key={dayIdx} className="px-1 py-1 align-top">
                                  {item ? (
                                    <div className={`${item.color} rounded-lg p-1.5 text-white`}>
                                      <p className="truncate text-[10px] font-semibold">{item.subject}</p>
                                      <p className="truncate text-[9px] opacity-80">{item.teacher.split(" ")[0]}</p>
                                    </div>
                                  ) : (
                                    <div className="h-10" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {generated.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <Check size={14} className="text-emerald-500" />
                  <h3 className="text-sm text-slate-700">Aulas a inserir na grade</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {generated.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className={`h-9 w-2 shrink-0 rounded-full ${item.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">{item.subject}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {WEEK_DAYS_FULL[item.day]} · {item.startTime}–{item.endTime}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="max-w-24 truncate text-xs text-slate-600">{item.teacher}</p>
                        <p className="text-[10px] text-slate-400">{item.class}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-red-100 px-4 py-3">
                  <AlertTriangle size={14} className="text-red-500" />
                  <h3 className="text-sm text-red-700">Conflitos detectados e ignorados</h3>
                </div>
                <div className="divide-y divide-red-50">
                  {conflicts.map((c, i) => (
                    <div key={i} className="px-4 py-3">
                      <p className="text-sm text-slate-700">
                        {c.teacher} — {c.slot}
                      </p>
                      <p className="mt-0.5 text-xs text-red-500">{c.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {generated.length === 0 && (
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-6 text-center">
                <AlertTriangle size={32} className="mx-auto mb-2 text-orange-400" />
                <p className="text-sm text-orange-700">Nenhuma aula pôde ser gerada</p>
                <p className="mt-1 text-xs text-orange-500">Todos os horários conflitam com a agenda existente.</p>
              </div>
            )}

            {saved && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <Check size={20} className="text-emerald-500" />
                <p className="text-sm text-emerald-700">Grade salva com sucesso! Redirecionando...</p>
              </div>
            )}
          </div>

          <div className="fixed bottom-16 left-0 right-0 z-40 space-y-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-md">
            {generated.length > 0 && !saved && (
              <button
                type="button"
                onClick={handleConfirm}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-white shadow-md shadow-emerald-200 transition-colors hover:bg-emerald-700"
              >
                <Check size={18} />
                Confirmar e salvar grade ({generated.length} aulas)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setStep("list");
                setSaved(false);
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
