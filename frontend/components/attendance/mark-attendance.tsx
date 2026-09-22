"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Save, User, X } from "lucide-react";

const INITIAL_STUDENTS = [
  { id: 1, name: "Ana Beatriz Santos", number: "01", present: true },
  { id: 2, name: "Bruno Oliveira Costa", number: "02", present: true },
  { id: 3, name: "Carla Maria Silva", number: "03", present: false },
  { id: 4, name: "Daniel Ferreira Lima", number: "04", present: true },
  { id: 5, name: "Elena Rodrigues Souza", number: "05", present: true },
  { id: 6, name: "Felipe Alves Pereira", number: "06", present: true },
  { id: 7, name: "Gabriela Costa Santos", number: "07", present: false },
  { id: 8, name: "Henrique Dias Oliveira", number: "08", present: true },
  { id: 9, name: "Isabela Martins Silva", number: "09", present: true },
  { id: 10, name: "João Pedro Rocha", number: "10", present: true },
  { id: 11, name: "Larissa Cardoso Alves", number: "11", present: true },
  { id: 12, name: "Marcos Vinicius Lima", number: "12", present: true }
];

export function MarkAttendance() {
  const [students, setStudents] = useState(INITIAL_STUDENTS);

  const toggleAttendance = (studentId: number) => {
    setStudents((prev) => prev.map((student) => (student.id === studentId ? { ...student, present: !student.present } : student)));
  };

  const markAllPresent = () => setStudents((prev) => prev.map((student) => ({ ...student, present: true })));
  const markAllAbsent = () => setStudents((prev) => prev.map((student) => ({ ...student, present: false })));

  const presentCount = students.filter((s) => s.present).length;
  const absentCount = students.length - presentCount;

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="bg-green-600 p-4 text-white">
        <div className="mb-3 flex items-center">
          <Link href="/attendance" className="mr-3">
            <ArrowLeft size={24} />
          </Link>
          <h1>Marcar Presença</h1>
        </div>

        <div className="rounded-lg bg-green-500 p-3">
          <div className="text-sm text-green-100">Física - Intensivo</div>
          <div className="text-sm text-green-100">10:30 - 12:30 | Ana Silva</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-2xl text-gray-900">{students.length}</div>
            </div>
            <div className="border-l border-r text-center">
              <div className="text-sm text-green-600">Presentes</div>
              <div className="text-2xl text-green-900">{presentCount}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-red-600">Ausentes</div>
              <div className="text-2xl text-red-900">{absentCount}</div>
            </div>
          </div>

          <div className="flex space-x-2">
            <button type="button" onClick={markAllPresent} className="flex-1 rounded-lg bg-green-50 py-2 text-sm text-green-600 transition-colors hover:bg-green-100">
              Marcar Todos Presentes
            </button>
            <button type="button" onClick={markAllAbsent} className="flex-1 rounded-lg bg-red-50 py-2 text-sm text-red-600 transition-colors hover:bg-red-100">
              Marcar Todos Ausentes
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {students.map((student) => (
            <div
              key={student.id}
              onClick={() => toggleAttendance(student.id)}
              className={`cursor-pointer rounded-lg bg-white p-4 shadow transition-all ${student.present ? "border-l-4 border-green-500" : "border-l-4 border-red-500"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-1 items-center">
                  <div className={`mr-3 flex h-10 w-10 items-center justify-center rounded-full ${student.present ? "bg-green-100" : "bg-red-100"}`}>
                    <User size={20} className={student.present ? "text-green-600" : "text-red-600"} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">#{student.number}</span>
                      <h3 className="text-gray-800">{student.name}</h3>
                    </div>
                    <Link
                      href={`/attendance/report/${student.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 inline-block text-sm text-blue-600 hover:underline"
                    >
                      Ver frequência
                    </Link>
                  </div>
                </div>

                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${student.present ? "bg-green-500" : "bg-red-500"}`}>
                  {student.present ? <Check className="text-white" size={24} /> : <X className="text-white" size={24} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
        <div className="mb-2 text-center text-sm text-gray-600">
          {presentCount} de {students.length} presentes ({Math.round((presentCount / students.length) * 100)}%)
        </div>
        <button type="button" className="flex w-full items-center justify-center rounded-lg bg-green-600 py-3 text-white transition-colors hover:bg-green-700">
          <Save size={20} className="mr-2" />
          Salvar Presença
        </button>
      </div>
    </div>
  );
}
