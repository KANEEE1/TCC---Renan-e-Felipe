"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Save, Search, UserMinus, UserPlus } from "lucide-react";

const INITIAL_STUDENTS = [
  { id: 1, name: "Ana Beatriz Santos", number: "01", assigned: true },
  { id: 2, name: "Bruno Oliveira Costa", number: "02", assigned: true },
  { id: 3, name: "Carla Maria Silva", number: "03", assigned: true },
  { id: 4, name: "Daniel Ferreira Lima", number: "04", assigned: false },
  { id: 5, name: "Elena Rodrigues Souza", number: "05", assigned: false },
  { id: 6, name: "Felipe Alves Pereira", number: "06", assigned: true },
  { id: 7, name: "Gabriela Costa Santos", number: "07", assigned: false },
  { id: 8, name: "Henrique Dias Oliveira", number: "08", assigned: true },
  { id: 9, name: "Isabela Martins Silva", number: "09", assigned: false },
  { id: 10, name: "João Pedro Rocha", number: "10", assigned: true }
];

export function AssignStudents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState(INITIAL_STUDENTS);

  const toggleStudent = (studentId: number) => {
    setStudents((prev) => prev.map((student) => (student.id === studentId ? { ...student, assigned: !student.assigned } : student)));
  };

  const filteredStudents = students.filter((student) => student.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const assignedCount = students.filter((s) => s.assigned).length;
  const unassignedStudents = filteredStudents.filter((s) => !s.assigned);
  const assignedStudents = filteredStudents.filter((s) => s.assigned);

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="bg-indigo-600 p-4 text-white">
        <div className="mb-3 flex items-center">
          <Link href="/classes" className="mr-3">
            <ArrowLeft size={24} />
          </Link>
          <h1>Gerenciar Alunos</h1>
        </div>

        <div className="rounded-lg bg-indigo-500 p-3">
          <div className="text-sm text-indigo-100">Turma: Extensivo - Manhã</div>
          <div className="text-sm text-indigo-100">Capacidade: 50 alunos</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <UserPlus className="mx-auto mb-1 text-green-600" size={20} />
              <div className="text-2xl text-green-900">{assignedCount}</div>
              <div className="text-sm text-green-700">Atribuídos</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <UserMinus className="mx-auto mb-1 text-gray-600" size={20} />
              <div className="text-2xl text-gray-900">{students.length - assignedCount}</div>
              <div className="text-sm text-gray-700">Disponíveis</div>
            </div>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar aluno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {assignedStudents.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 text-gray-800">Alunos da Turma ({assignedStudents.length})</h3>
            <div className="space-y-2">
              {assignedStudents.map((student) => (
                <div
                  key={student.id}
                  onClick={() => toggleStudent(student.id)}
                  className="cursor-pointer rounded-lg border-l-4 border-green-500 bg-white p-4 shadow transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-1 items-center">
                      <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <span className="text-green-700">{student.number}</span>
                      </div>
                      <h4 className="text-gray-800">{student.name}</h4>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                      <Check className="text-white" size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {unassignedStudents.length > 0 && (
          <section>
            <h3 className="mb-3 text-gray-800">Alunos Disponíveis ({unassignedStudents.length})</h3>
            <div className="space-y-2">
              {unassignedStudents.map((student) => (
                <div
                  key={student.id}
                  onClick={() => toggleStudent(student.id)}
                  className="cursor-pointer rounded-lg border-l-4 border-gray-300 bg-white p-4 shadow transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-1 items-center">
                      <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                        <span className="text-gray-600">{student.number}</span>
                      </div>
                      <h4 className="text-gray-800">{student.name}</h4>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
        <div className="mb-2 text-center text-sm text-gray-600">{assignedCount} alunos atribuídos</div>
        <button type="button" className="flex w-full items-center justify-center rounded-lg bg-indigo-600 py-3 text-white transition-colors hover:bg-indigo-700">
          <Save size={20} className="mr-2" />
          Salvar Alterações
        </button>
      </div>
    </div>
  );
}
