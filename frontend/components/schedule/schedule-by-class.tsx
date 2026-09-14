"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";

const CLASSES = ["Extensivo - Manhã", "Extensivo - Noite", "Intensivo", "Semi-Intensivo", "Reta Final", "Medicina"];

const CLASS_SCHEDULE = [
  { id: 1, day: "Segunda-feira", time: "08:00 - 09:00", subject: "Matemática", teacher: "Ana Silva", color: "bg-blue-500" },
  { id: 2, day: "Segunda-feira", time: "09:00 - 10:00", subject: "Português", teacher: "Maria Oliveira", color: "bg-orange-500" },
  { id: 3, day: "Terça-feira", time: "08:00 - 09:00", subject: "História", teacher: "Carlos Santos", color: "bg-purple-500" },
  { id: 4, day: "Terça-feira", time: "10:00 - 11:00", subject: "Educação Física", teacher: "Pedro Lima", color: "bg-teal-500" },
  { id: 5, day: "Quarta-feira", time: "08:00 - 09:00", subject: "Química", teacher: "João Costa", color: "bg-red-500" },
  { id: 6, day: "Quinta-feira", time: "09:00 - 10:00", subject: "Física", teacher: "Ana Silva", color: "bg-green-500" },
  { id: 7, day: "Sexta-feira", time: "08:00 - 09:00", subject: "Geografia", teacher: "Carlos Santos", color: "bg-indigo-500" }
];

const GROUPED_BY_DAY = CLASS_SCHEDULE.reduce<Record<string, typeof CLASS_SCHEDULE>>((acc, item) => {
  if (!acc[item.day]) acc[item.day] = [];
  acc[item.day].push(item);
  return acc;
}, {});

export function ScheduleByClass() {
  const [selectedClass, setSelectedClass] = useState("Extensivo - Manhã");

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
          {CLASSES.map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => setSelectedClass(cls)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 transition-colors ${
                selectedClass === cls ? "bg-white text-blue-600" : "bg-blue-500 text-white hover:bg-blue-400"
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-6">
        <div className="mb-4 rounded-lg bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-blue-900">{selectedClass}</h2>
              <p className="text-sm text-blue-700">45 alunos</p>
            </div>
            <Calendar className="text-blue-600" size={32} />
          </div>
        </div>

        {Object.entries(GROUPED_BY_DAY).map(([day, items]) => (
          <div key={day} className="mb-6">
            <h3 className="mb-3 text-gray-800">{day}</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/schedule/edit/${item.id}`}
                  className="block overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-md"
                >
                  <div className={`${item.color} h-1`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-gray-800">{item.subject}</h4>
                        <p className="mt-1 text-sm text-gray-600">{item.teacher}</p>
                      </div>
                      <span className="text-sm text-gray-700">{item.time}</span>
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
              <div className="text-2xl text-blue-900">28</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <div className="text-sm text-green-800">Carga Horária</div>
              <div className="text-2xl text-green-900">28h</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
