"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Save } from "lucide-react";
import { useSchedule } from "@/components/schedule/schedule-context";

const DAY_MAP: Record<string, number> = {
  "Segunda-feira": 0,
  "Terça-feira": 1,
  "Quarta-feira": 2,
  "Quinta-feira": 3,
  "Sexta-feira": 4
};

const TYPE_COLOR: Record<string, string> = {
  aula: "bg-blue-500",
  plantao: "bg-purple-500",
  aulao: "bg-orange-500"
};

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

function calcDuration(start: string, end: string): number {
  if (!start || !end) return 1;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return diff > 0 ? Math.round(diff) : 1;
}

type ScheduleType = "aula" | "plantao" | "aulao";

export function CreateSchedule() {
  const router = useRouter();
  const { addSchedule } = useSchedule();
  const [type, setType] = useState<ScheduleType>("aula");
  const [formData, setFormData] = useState({
    teacher: "",
    class: "",
    subject: "",
    day: "",
    startTime: "",
    endTime: "",
    room: ""
  });
  const [conflicts, setConflicts] = useState<string[]>([]);

  const checkConflicts = () => {
    const newConflicts: string[] = [];
    if (formData.teacher === "Ana Silva" && formData.day === "Segunda-feira" && formData.startTime === "08:00") {
      newConflicts.push("Professor já possui aula neste horário (Matemática - Extensivo)");
    }
    if (formData.class === "Extensivo - Manhã" && formData.day === "Segunda-feira" && formData.startTime === "08:00") {
      newConflicts.push("Turma já possui aula neste horário (Matemática com Ana Silva)");
    }
    if (formData.room === "Sala 101" && formData.day === "Segunda-feira" && formData.startTime === "08:00") {
      newConflicts.push("Sala já está ocupada neste horário");
    }
    return newConflicts;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newConflicts = checkConflicts();
    setConflicts(newConflicts);

    if (newConflicts.length === 0) {
      const dayIndex = DAY_MAP[formData.day] ?? 0;
      const duration = calcDuration(formData.startTime, formData.endTime);

      addSchedule({
        day: dayIndex,
        startTime: formData.startTime,
        endTime: formData.endTime,
        duration,
        subject: formData.subject || (type === "plantao" ? "Plantão" : type === "aulao" ? "Aulão" : "Aula"),
        class: formData.class || "Todas",
        teacher: formData.teacher,
        room: formData.room,
        color: TYPE_COLOR[type],
        type
      });

      router.push("/schedule/weekly");
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setConflicts([]);
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
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Aula Regular</div>
                    <div className={`mt-1 text-sm ${type === "aula" ? "text-blue-100" : "text-gray-600"}`}>Aula normal com turma específica</div>
                  </div>
                  {type === "aula" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                      <div className="h-3 w-3 rounded-full bg-blue-600" />
                    </div>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType("plantao")}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                  type === "plantao" ? "border-purple-600 bg-purple-600 text-white shadow-lg" : "border-gray-200 bg-gray-50 text-gray-900 hover:border-purple-400 hover:bg-purple-50 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Plantão de Dúvidas</div>
                    <div className={`mt-1 text-sm ${type === "plantao" ? "text-purple-100" : "text-gray-600"}`}>Atendimento para tirar dúvidas dos alunos</div>
                  </div>
                  {type === "plantao" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                      <div className="h-3 w-3 rounded-full bg-purple-600" />
                    </div>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType("aulao")}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                  type === "aulao" ? "border-orange-600 bg-orange-600 text-white shadow-lg" : "border-gray-200 bg-gray-50 text-gray-900 hover:border-orange-400 hover:bg-orange-50 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Aulão / Evento Especial</div>
                    <div className={`mt-1 text-sm ${type === "aulao" ? "text-orange-100" : "text-gray-600"}`}>Revisão, simulado ou evento com várias turmas</div>
                  </div>
                  {type === "aulao" && (
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
              onChange={(e) => handleInputChange("teacher", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Selecione um professor</option>
              {TEACHERS.map((teacher) => (
                <option key={teacher} value={teacher}>
                  {teacher}
                </option>
              ))}
            </select>
          </div>

          {type === "aula" && (
            <>
              <div>
                <label className="mb-2 block text-gray-700">Turma</label>
                <select
                  value={formData.class}
                  onChange={(e) => handleInputChange("class", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Selecione uma turma</option>
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
                  onChange={(e) => handleInputChange("subject", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Selecione uma disciplina</option>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {type === "plantao" && (
            <>
              <div>
                <label className="mb-2 block text-gray-700">Disciplina / Área</label>
                <select
                  value={formData.subject}
                  onChange={(e) => handleInputChange("subject", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Selecione a área do plantão</option>
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
                  onChange={(e) => handleInputChange("class", e.target.value)}
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

          {type === "aulao" && (
            <>
              <div>
                <label className="mb-2 block text-gray-700">Título do Evento</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => handleInputChange("subject", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: Aulão de Química Orgânica"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-gray-700">Turmas Participantes</label>
                <select
                  value={formData.class}
                  onChange={(e) => handleInputChange("class", e.target.value)}
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

        {conflicts.length > 0 && (
          <div className="mt-4 rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
            <div className="flex items-start">
              <AlertTriangle className="mr-3 mt-1 flex-shrink-0 text-red-600" size={20} />
              <div className="flex-1">
                <h3 className="mb-2 text-red-800">Conflitos Detectados</h3>
                <ul className="space-y-1">
                  {conflicts.map((conflict) => (
                    <li key={conflict} className="text-sm text-red-700">
                      • {conflict}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button type="submit" className="flex w-full items-center justify-center rounded-lg bg-green-600 py-3 text-white transition-colors hover:bg-green-700">
            <Save size={20} className="mr-2" />
            Criar Agendamento
          </button>
        </div>
      </form>
    </div>
  );
}
