"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { api } from "@/lib/api";

const DAY_ORDER = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"];
const DAY_LABEL: Record<string, string> = {
  SEGUNDA: "Segunda-feira",
  TERCA: "Terça-feira",
  QUARTA: "Quarta-feira",
  QUINTA: "Quinta-feira",
  SEXTA: "Sexta-feira"
};
const COLORS = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-teal-500", "bg-red-500", "bg-indigo-500"];

interface ClassOption {
  id: string;
  nome: string;
}

interface ClassDetail {
  nome: string;
  matriculas: unknown[];
}

interface AulaDTO {
  id: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
  disciplina: { nome: string };
  professor: { name: string };
}

function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

export function ScheduleByClass() {
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [lessons, setLessons] = useState<AulaDTO[]>([]);

  useEffect(() => {
    api.get<ClassOption[]>("/classes").then((list) => {
      setClassOptions(list);
      if (list[0]) setSelectedClassId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    api.get<ClassDetail>(`/classes/${selectedClassId}`).then(setClassDetail);
    api.get<AulaDTO[]>(`/schedule/by-class/${selectedClassId}`).then(setLessons);
  }, [selectedClassId]);

  const groupedByDay = DAY_ORDER.map((day) => ({
    day,
    label: DAY_LABEL[day],
    items: lessons.filter((l) => l.diaSemana === day)
  })).filter((group) => group.items.length > 0);

  const totalHours = lessons.reduce((sum, l) => {
    const [sh, sm] = toHHMM(l.horarioInicio).split(":").map(Number);
    const [eh, em] = toHHMM(l.horarioFim).split(":").map(Number);
    return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
  }, 0);

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="bg-blue-600 p-4 text-white">
        <div className="mb-4 flex items-center">
          <Link href="/schedule/weekly" className="mr-3">
            <ArrowLeft size={24} />
          </Link>
          <h1>Grade por Turma</h1>
        </div>

        <div className="flex space-x-2 overflow-x-auto pb-2">
          {classOptions.map((cls) => (
            <button
              key={cls.id}
              type="button"
              onClick={() => setSelectedClassId(cls.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 transition-colors ${
                selectedClassId === cls.id ? "bg-white text-blue-600" : "bg-blue-500 text-white hover:bg-blue-400"
              }`}
            >
              {cls.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-6">
        <div className="mb-4 rounded-lg bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-blue-900">{classDetail?.nome ?? "..."}</h2>
              <p className="text-sm text-blue-700">{classDetail?.matriculas.length ?? 0} alunos</p>
            </div>
            <Calendar className="text-blue-600" size={32} />
          </div>
        </div>

        {groupedByDay.map(({ day, label, items }) => (
          <div key={day} className="mb-6">
            <h3 className="mb-3 text-gray-800">{label}</h3>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <Link
                  key={item.id}
                  href={`/schedule/edit/${item.id}`}
                  className="block overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-md"
                >
                  <div className={`${COLORS[idx % COLORS.length]} h-1`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-gray-800">{item.disciplina.nome}</h4>
                        <p className="mt-1 text-sm text-gray-600">{item.professor.name}</p>
                      </div>
                      <span className="text-sm text-gray-700">
                        {toHHMM(item.horarioInicio)} - {toHHMM(item.horarioFim)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-6 rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 text-gray-800">Resumo Semanal</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-sm text-blue-800">Aulas/Semana</div>
              <div className="text-2xl text-blue-900">{lessons.length}</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <div className="text-sm text-green-800">Carga Horária</div>
              <div className="text-2xl text-green-900">{totalHours}h</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
