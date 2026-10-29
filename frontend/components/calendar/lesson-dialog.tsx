"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, GraduationCap, MapPin, Tag, User, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useSchedule, type ScheduleItem } from "@/components/schedule/schedule-context";

interface Teacher {
  id: string;
  name: string;
  ativo: boolean;
  disciplinas: { id: string; nome: string }[];
}

interface Props {
  lesson: ScheduleItem;
  onClose: () => void;
  // Chamado após salvar ou excluir; a agenda já foi recarregada pelo schedule-context.
  onSaved: () => void;
}

const DAY_CHIPS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAY_FULL = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const TYPE_LABELS: Record<ScheduleItem["type"], string> = { aula: "Aula", plantao: "Plantão", aulao: "Aulão" };

// Na edição de uma aula a gestão muda só o dia da semana, o horário e o professor; disciplina, turma, sala e
// tipo aparecem apenas para consulta.
export function LessonDialog({ lesson, onClose, onSaved }: Props) {
  const { updateSchedule, removeSchedule } = useSchedule();

  const [day, setDay] = useState(lesson.day);
  const [startTime, setStartTime] = useState(lesson.startTime);
  const [endTime, setEndTime] = useState(lesson.endTime);
  const [teacherId, setTeacherId] = useState(lesson.teacherId);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Teacher[]>("/teachers").then(setTeachers).catch(() => setError("Não foi possível carregar os professores."));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Professores ativos que lecionam a disciplina primeiro; depois os demais (inclui o atual, mesmo inativo).
  const { teaching, others } = useMemo(() => {
    const teachesSubject = (t: Teacher) => t.disciplinas.some((d) => d.id === lesson.subjectId);
    const usable = teachers.filter((t) => t.ativo || t.id === teacherId);
    return {
      teaching: usable.filter((t) => t.ativo && teachesSubject(t)),
      others: usable.filter((t) => !(t.ativo && teachesSubject(t)))
    };
  }, [teachers, lesson.subjectId, teacherId]);

  const handleSave = async () => {
    if (saving || deleting) return;
    if (!teacherId) return setError("Selecione o professor.");
    if (!startTime || !endTime || endTime <= startTime) return setError("O horário de término deve ser depois do início.");

    setError(null);
    setSaving(true);
    try {
      await updateSchedule(lesson.id, { day, startTime, endTime, teacherId });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a aula.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || saving || !confirm("Excluir esta aula de todas as semanas?")) return;
    setError(null);
    setDeleting(true);
    try {
      await removeSchedule(lesson.id);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir a aula.");
      setDeleting(false);
    }
  };

  const inputClass = "rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${
      active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar aula"
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end px-3 pt-3">
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 pb-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
            <span className={`h-4 w-4 shrink-0 rounded ${lesson.color}`} />
            <h2 className="text-2xl text-slate-800">{lesson.subject}</h2>
          </div>

          <div className="flex items-start gap-4">
            <Clock size={18} className="mt-2.5 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {DAY_CHIPS.map((label, index) => (
                  <button key={label} type="button" onClick={() => setDay(index)} className={chipClass(day === index)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  aria-label="Início"
                  autoFocus
                  className={inputClass}
                />
                <span className="text-slate-400">–</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="Fim" className={inputClass} />
              </div>
              <p className="text-sm text-slate-600">Repete toda {DAY_FULL[day]}</p>
              <p className="text-xs text-slate-400">As alterações valem para todas as semanas desta aula.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <User size={18} className="shrink-0 text-slate-400" />
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Professor" className={`${inputClass} flex-1`}>
              {!teachers.some((t) => t.id === teacherId) && <option value={teacherId}>{lesson.teacher}</option>}
              {teaching.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.ativo ? "não leciona esta disciplina" : "inativo"})
                </option>
              ))}
            </select>
          </div>

          <ul className="space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <li className="flex items-center gap-4">
              <GraduationCap size={18} className="shrink-0 text-slate-400" />
              {lesson.class}
            </li>
            {lesson.room && (
              <li className="flex items-center gap-4">
                <MapPin size={18} className="shrink-0 text-slate-400" />
                {lesson.room}
              </li>
            )}
            <li className="flex items-center gap-4">
              <Tag size={18} className="shrink-0 text-slate-400" />
              {TYPE_LABELS[lesson.type] ?? lesson.type}
            </li>
          </ul>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "Excluindo..." : "Excluir"}
          </button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
