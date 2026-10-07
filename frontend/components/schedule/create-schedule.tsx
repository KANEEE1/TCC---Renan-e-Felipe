"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Save } from "lucide-react";
import { useSchedule } from "@/components/schedule/schedule-context";
import { api, ApiError } from "@/lib/api";

const DAY_MAP: Record<string, number> = {
  "Segunda-feira": 0,
  "Terça-feira": 1,
  "Quarta-feira": 2,
  "Quinta-feira": 3,
  "Sexta-feira": 4
};

const DAYS = Object.keys(DAY_MAP);
const TIMES = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00"
];

type ScheduleType = "aula" | "plantao" | "aulao";

interface Option {
  id: string;
  nome?: string;
  name?: string;
}

export function CreateSchedule() {
  const router = useRouter();
  const { addSchedule } = useSchedule();
  const [type, setType] = useState<ScheduleType>("aula");
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [formData, setFormData] = useState({
    teacherId: "",
    classId: "",
    subjectId: "",
    day: "",
    startTime: "",
    endTime: "",
    room: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Option[]>("/teachers").then(setTeachers).catch(() => setTeachers([]));
    api.get<Option[]>("/classes").then(setClasses).catch(() => setClasses([]));
    api.get<Option[]>("/disciplinas").then(setSubjects).catch(() => setSubjects([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const dayIndex = DAY_MAP[formData.day] ?? 0;
      const teacher = teachers.find((t) => t.id === formData.teacherId);
      const cls = classes.find((c) => c.id === formData.classId);
      const subject = subjects.find((s) => s.id === formData.subjectId);

      await addSchedule({
        day: dayIndex,
        startTime: formData.startTime,
        endTime: formData.endTime,
        subject: subject?.nome ?? "",
        subjectId: formData.subjectId,
        class: cls?.nome ?? "",
        classId: formData.classId,
        teacher: teacher?.name ?? "",
        teacherId: formData.teacherId,
        room: formData.room,
        type
      });

      router.push("/schedule/weekly");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 500
            ? "Conflito de horário: professor, turma ou sala já ocupados nesse dia/horário."
            : err.message
          : "Não foi possível criar o agendamento."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-green-600 p-4 text-white">
        <Link href="/schedule/weekly" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>Novo Agendamento</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="space-y-4 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="mb-3 block text-gray-700">Tipo de Agendamento</label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setType("aula")}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                  type === "aula" ? "border-blue-600 bg-blue-600 text-white shadow-lg" : "border-gray-200 bg-gray-50 text-gray-900 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md"
                }`}
              >
                <div className="font-semibold">Aula Regular</div>
                <div className={`mt-1 text-sm ${type === "aula" ? "text-blue-100" : "text-gray-600"}`}>Aula normal com turma específica</div>
              </button>

              <button
                type="button"
                onClick={() => setType("plantao")}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                  type === "plantao" ? "border-purple-600 bg-purple-600 text-white shadow-lg" : "border-gray-200 bg-gray-50 text-gray-900 hover:border-purple-400 hover:bg-purple-50 hover:shadow-md"
                }`}
              >
                <div className="font-semibold">Plantão de Dúvidas</div>
                <div className={`mt-1 text-sm ${type === "plantao" ? "text-purple-100" : "text-gray-600"}`}>Atendimento para tirar dúvidas dos alunos</div>
              </button>

              <button
                type="button"
                onClick={() => setType("aulao")}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                  type === "aulao" ? "border-orange-600 bg-orange-600 text-white shadow-lg" : "border-gray-200 bg-gray-50 text-gray-900 hover:border-orange-400 hover:bg-orange-50 hover:shadow-md"
                }`}
              >
                <div className="font-semibold">Aulão / Evento Especial</div>
                <div className={`mt-1 text-sm ${type === "aulao" ? "text-orange-100" : "text-gray-600"}`}>Revisão, simulado ou evento com várias turmas</div>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Professor</label>
            <select
              value={formData.teacherId}
              onChange={(e) => handleInputChange("teacherId", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
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
              onChange={(e) => handleInputChange("classId", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
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
              onChange={(e) => handleInputChange("subjectId", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
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
              onChange={(e) => handleInputChange("day", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Selecione um dia</option>
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
                onChange={(e) => handleInputChange("startTime", e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                <option value="">Selecione</option>
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
                onChange={(e) => handleInputChange("endTime", e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                <option value="">Selecione</option>
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
              onChange={(e) => handleInputChange("room", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ex: Sala 101"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
            <div className="flex items-start">
              <AlertTriangle className="mr-3 mt-1 flex-shrink-0 text-red-600" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-lg bg-green-600 py-3 text-white transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            <Save size={20} className="mr-2" />
            {submitting ? "Criando..." : "Criar Agendamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
