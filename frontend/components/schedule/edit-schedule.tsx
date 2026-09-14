"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useSchedule } from "@/components/schedule/schedule-context";

const TEACHERS = ["Ana Silva", "Carlos Santos", "Maria Oliveira", "João Costa"];
const CLASSES = ["Extensivo - Manhã", "Extensivo - Noite", "Intensivo", "Semi-Intensivo", "Reta Final", "Medicina"];
const SUBJECTS = ["Matemática", "Física", "Química", "Biologia", "História", "Geografia", "Português", "Literatura", "Redação", "Inglês", "Filosofia", "Sociologia"];
const DAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"];
const TIMES = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00"
];

const TYPE_COLOR: Record<string, string> = {
  aula: "bg-blue-500",
  plantao: "bg-purple-500",
  aulao: "bg-orange-500"
};

function calcDuration(start: string, end: string): number {
  if (!start || !end) return 1;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return diff > 0 ? Math.round(diff) : 1;
}

type EditScheduleProps = {
  id: string;
};

export function EditSchedule({ id }: EditScheduleProps) {
  const router = useRouter();
  const { schedules, updateSchedule, removeSchedule } = useSchedule();
  const scheduleId = Number(id);
  const existing = schedules.find((s) => s.id === scheduleId);

  const [formData, setFormData] = useState({
    type: "aula" as "aula" | "plantao" | "aulao",
    teacher: "",
    class: "",
    subject: "",
    day: DAYS[0],
    startTime: "",
    endTime: "",
    room: ""
  });

  useEffect(() => {
    if (existing) {
      setFormData({
        type: existing.type,
        teacher: existing.teacher,
        class: existing.class,
        subject: existing.subject,
        day: DAYS[existing.day] ?? DAYS[0],
        startTime: existing.startTime,
        endTime: existing.endTime,
        room: existing.room
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dayIndex = DAYS.indexOf(formData.day);
    updateSchedule(scheduleId, {
      day: dayIndex >= 0 ? dayIndex : 0,
      startTime: formData.startTime,
      endTime: formData.endTime,
      duration: calcDuration(formData.startTime, formData.endTime),
      subject: formData.subject,
      class: formData.class,
      teacher: formData.teacher,
      room: formData.room,
      color: TYPE_COLOR[formData.type],
      type: formData.type
    });
    router.push("/schedule/weekly");
  };

  const handleDelete = () => {
    if (confirm("Tem certeza que deseja excluir este agendamento?")) {
      removeSchedule(scheduleId);
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
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "aula" })}
                className={`w-full rounded-lg p-4 text-left transition-all ${
                  formData.type === "aula" ? "bg-blue-600 text-white shadow-lg" : "border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Aula Regular</div>
                    <div className={`mt-1 text-sm ${formData.type === "aula" ? "text-blue-100" : "text-gray-700"}`}>Aula normal com turma específica</div>
                  </div>
                  {formData.type === "aula" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                      <div className="h-3 w-3 rounded-full bg-blue-600" />
                    </div>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "plantao" })}
                className={`w-full rounded-lg p-4 text-left transition-all ${
                  formData.type === "plantao" ? "bg-purple-600 text-white shadow-lg" : "border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Plantão de Dúvidas</div>
                    <div className={`mt-1 text-sm ${formData.type === "plantao" ? "text-purple-100" : "text-gray-700"}`}>Atendimento para tirar dúvidas dos alunos</div>
                  </div>
                  {formData.type === "plantao" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                      <div className="h-3 w-3 rounded-full bg-purple-600" />
                    </div>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "aulao" })}
                className={`w-full rounded-lg p-4 text-left transition-all ${
                  formData.type === "aulao" ? "bg-orange-600 text-white shadow-lg" : "border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Aulão / Evento Especial</div>
                    <div className={`mt-1 text-sm ${formData.type === "aulao" ? "text-orange-100" : "text-gray-700"}`}>Revisão, simulado ou evento com várias turmas</div>
                  </div>
                  {formData.type === "aulao" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                      <div className="h-3 w-3 rounded-full bg-orange-600" />
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Professor</label>
            <select
              value={formData.teacher}
              onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              {TEACHERS.map((teacher) => (
                <option key={teacher} value={teacher}>
                  {teacher}
                </option>
              ))}
            </select>
          </div>

          {formData.type === "aula" && (
            <>
              <div>
                <label className="mb-2 block text-gray-700">Turma</label>
                <select
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-gray-700">Disciplina</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {formData.type === "plantao" && (
            <>
              <div>
                <label className="mb-2 block text-gray-700">Disciplina / Área</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="Exatas">Exatas (Mat, Fís, Quím)</option>
                  <option value="Humanas">Humanas (His, Geo, Filo, Soc)</option>
                  <option value="Linguagens">Linguagens (Port, Lit, Red, Ing)</option>
                  <option value="Biológicas">Biológicas (Bio)</option>
                  <option value="Geral">Geral (Todas as disciplinas)</option>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-gray-700">Turma (Opcional)</label>
                <select
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Todas as turmas</option>
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-600">Deixe em branco para plantão aberto a todos</p>
              </div>
            </>
          )}

          {formData.type === "aulao" && (
            <>
              <div>
                <label className="mb-2 block text-gray-700">Título do Evento</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: Aulão de Química Orgânica"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-gray-700">Turmas Participantes</label>
                <select
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todas as turmas</option>
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

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
          <button type="submit" className="flex w-full items-center justify-center rounded-lg bg-orange-600 py-3 text-white transition-colors hover:bg-orange-700">
            <Save size={20} className="mr-2" />
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}
