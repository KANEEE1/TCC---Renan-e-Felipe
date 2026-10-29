"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, GraduationCap, MapPin, Tag, User, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useSchedule, type ScheduleItem } from "@/components/schedule/schedule-context";

interface Teacher {
  id: string;
  name: string;
  ativo: boolean;
  disciplinas: { id: string; nome: string }[];
}

// A ocorrência clicada na agenda: dia da série (dataOriginal), onde ela acontece hoje e com quais valores.
export interface LessonOccurrence {
  dataOriginal: string;
  data: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  teacher: string;
}

interface Props {
  lesson: ScheduleItem;
  occurrence: LessonOccurrence;
  onClose: () => void;
  // Chamado após salvar ou excluir; a agenda já foi recarregada pelo schedule-context.
  onSaved: () => void;
}

const TYPE_LABELS: Record<ScheduleItem["type"], string> = { aula: "Aula", plantao: "Plantão", aulao: "Aulão" };

// Na edição de uma aula a gestão muda a data, o horário e o professor só desta ocorrência (as demais semanas
// não mudam); disciplina, turma, sala e tipo aparecem apenas para consulta.
export function LessonDialog({ lesson, occurrence, onClose, onSaved }: Props) {
  const { updateOccurrence, cancelOccurrence } = useSchedule();

  const [date, setDate] = useState(occurrence.data);
  const [startTime, setStartTime] = useState(occurrence.startTime);
  const [endTime, setEndTime] = useState(occurrence.endTime);
  const [teacherId, setTeacherId] = useState(occurrence.teacherId);

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
    if (!date) return setError("Informe a data da aula.");
    if (!teacherId) return setError("Selecione o professor.");
    if (!startTime || !endTime || endTime <= startTime) return setError("O horário de término deve ser depois do início.");
    setError(null);
    // Nada mudou: não há o que salvar.
    if (date === occurrence.data && startTime === occurrence.startTime && endTime === occurrence.endTime && teacherId === occurrence.teacherId) {
      return onClose();
    }
    setSaving(true);
    try {
      await updateOccurrence(lesson.id, occurrence.dataOriginal, { data: date, startTime, endTime, teacherId });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a aula.");
      setSaving(false);
    }
  };

  // Excluir cancela só a aula desta data; as demais semanas continuam.
  const handleDelete = async () => {
    if (deleting || saving) return;
    const when = new Date(`${occurrence.data}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    if (!confirm(`Excluir a aula de ${when}? As outras semanas não mudam.`)) return;
    setError(null);
    setDeleting(true);
    try {
      await cancelOccurrence(lesson.id, occurrence.dataOriginal);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir a aula.");
      setDeleting(false);
    }
  };

  const inputClass = "rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

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

          <div className="flex items-center gap-4">
            <CalendarDays size={18} className="shrink-0 text-slate-400" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" className={inputClass} />
          </div>
          <p className="-mt-3 pl-9 text-xs text-slate-400">A alteração vale só para esta aula; as outras semanas não mudam.</p>

          <div className="flex items-start gap-4">
            <Clock size={18} className="mt-2.5 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1 space-y-2">
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
            </div>
          </div>

          <div className="flex items-center gap-4">
            <User size={18} className="shrink-0 text-slate-400" />
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Professor" className={`${inputClass} flex-1`}>
              {!teachers.some((t) => t.id === teacherId) && <option value={teacherId}>{occurrence.teacher}</option>}
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
            {deleting ? "Excluindo..." : "Excluir esta aula"}
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
