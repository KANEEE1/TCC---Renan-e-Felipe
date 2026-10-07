"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useSchedule } from "@/components/schedule/schedule-context";
import { api, ApiError } from "@/lib/api";

const DAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"];
const TIMES = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00"
];

interface Option {
  id: string;
  nome?: string;
  name?: string;
}

type EditScheduleProps = {
  id: string;
};

export function EditSchedule({ id }: EditScheduleProps) {
  const router = useRouter();
  const { schedules, updateSchedule, removeSchedule } = useSchedule();
  const existing = schedules.find((s) => s.id === id);

  const [teachers, setTeachers] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    type: "aula" as "aula" | "plantao" | "aulao",
    teacherId: "",
    classId: "",
    subjectId: "",
    day: DAYS[0],
    startTime: "",
    endTime: "",
    room: ""
  });

  useEffect(() => {
    api.get<Option[]>("/teachers").then(setTeachers).catch(() => setTeachers([]));
    api.get<Option[]>("/classes").then(setClasses).catch(() => setClasses([]));
    api.get<Option[]>("/disciplinas").then(setSubjects).catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    if (existing) {
      setFormData({
        type: existing.type,
        teacherId: existing.teacherId,
        classId: existing.classId,
        subjectId: existing.subjectId,
        day: DAYS[existing.day] ?? DAYS[0],
        startTime: existing.startTime,
        endTime: existing.endTime,
        room: existing.room
      });
    }
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const dayIndex = DAYS.indexOf(formData.day);
      const teacher = teachers.find((t) => t.id === formData.teacherId);
      const cls = classes.find((c) => c.id === formData.classId);
      const subject = subjects.find((s) => s.id === formData.subjectId);

      await updateSchedule(id, {
        day: dayIndex >= 0 ? dayIndex : 0,
        startTime: formData.startTime,
        endTime: formData.endTime,
        subject: subject?.nome ?? "",
        subjectId: formData.subjectId,
        class: cls?.nome ?? "",
        classId: formData.classId,
        teacher: teacher?.name ?? "",
        teacherId: formData.teacherId,
        room: formData.room,
        type: formData.type
      });
      router.push("/schedule/weekly");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Tem certeza que deseja excluir este agendamento?")) {
      await removeSchedule(id);
      router.push("/schedule/weekly");
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-orange-600 p-4 text-white">
        <Link href="/schedule/weekly" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>Editar Agendamento</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="space-y-4 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="mb-3 block text-gray-700">Tipo de Agendamento</label>
            <div className="space-y-2">
              {(["aula", "plantao", "aulao"] as const).map((t) => {
                const labels = {
                  aula: { title: "Aula Regular", desc: "Aula normal com turma específica", on: "bg-blue-600" },
                  plantao: { title: "Plantão de Dúvidas", desc: "Atendimento para tirar dúvidas dos alunos", on: "bg-purple-600" },
                  aulao: { title: "Aulão / Evento Especial", desc: "Revisão, simulado ou evento com várias turmas", on: "bg-orange-600" }
                }[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t })}
                    className={`w-full rounded-lg p-4 text-left transition-all ${
                      formData.type === t ? `${labels.on} text-white shadow-lg` : "border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200"
                    }`}
                  >
                    <div className="font-semibold">{labels.title}</div>
                    <div className={`mt-1 text-sm ${formData.type === t ? "text-white/80" : "text-gray-700"}`}>{labels.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Professor</label>
            <select
              value={formData.teacherId}
              onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Selecione um professor</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Turma</label>
            <select
              value={formData.classId}
              onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Selecione uma turma</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Disciplina</label>
            <select
              value={formData.subjectId}
              onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Selecione uma disciplina</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Dia da Semana</label>
            <select
              value={formData.day}
              onChange={(e) => setFormData({ ...formData, day: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-gray-700">Hora Início</label>
              <select
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              >
                {TIMES.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Hora Fim</label>
              <select
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              >
                {TIMES.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Sala</label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ex: Sala 101"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <button
          type="button"
          onClick={handleDelete}
          className="mt-4 flex w-full items-center justify-center rounded-lg bg-red-50 py-3 text-red-600 transition-colors hover:bg-red-100"
        >
          <Trash2 size={20} className="mr-2" />
          Excluir Agendamento
        </button>

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-lg bg-orange-600 py-3 text-white transition-colors hover:bg-orange-700 disabled:opacity-60"
          >
            <Save size={20} className="mr-2" />
            {submitting ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
