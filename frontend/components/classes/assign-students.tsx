"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { api } from "@/lib/api";

interface StudentRow {
  id: string;
  name: string;
  number: string;
}

interface ClassDetail {
  nome: string;
  capacidade: number | null;
  matriculas: { aluno: { id: string; nome: string; numero: string | null } }[];
}

// Consulta dos alunos da turma, igual para gestão e professores: a turma de um aluno não é alterada por aqui.
export function AssignStudents({ classId }: { classId: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [className, setClassName] = useState("");
  const [capacity, setCapacity] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<ClassDetail>(`/classes/${classId}`)
      .then((cls) => {
        setClassName(cls.nome);
        setCapacity(cls.capacidade);
        setStudents(
          cls.matriculas
            .map((m) => ({ id: m.aluno.id, name: m.aluno.nome, number: m.aluno.numero ?? "-" }))
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        );
      })
      .catch(() => setError(true));
  }, [classId]);

  const filteredStudents = (students ?? []).filter((student) => student.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="bg-indigo-600 p-4 text-white">
        <div className="mb-3 flex items-center">
          <Link href="/classes" className="mr-3">
            <ArrowLeft size={24} />
          </Link>
          <h1>Alunos da Turma</h1>
        </div>

        <div className="rounded-lg bg-indigo-500 p-3">
          <div className="text-sm text-indigo-100">Turma: {className || "..."}</div>
          {capacity !== null && <div className="text-sm text-indigo-100">Capacidade: {capacity} alunos</div>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-6">
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

        {filteredStudents.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 text-gray-800">Alunos da Turma ({filteredStudents.length})</h3>
            <div className="space-y-2">
              {filteredStudents.map((student) => (
                <div key={student.id} className="rounded-lg border-l-4 border-green-500 bg-white p-4 shadow">
                  <div className="flex items-center">
                    <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <span className="text-green-700">{student.number}</span>
                    </div>
                    <h4 className="text-gray-800">{student.name}</h4>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {students && filteredStudents.length === 0 && (
          <p className="text-center text-sm text-gray-500">{searchTerm ? "Nenhum aluno encontrado." : "Nenhum aluno nesta turma."}</p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">Não foi possível carregar os alunos.</p>}
      </div>
    </div>
  );
}
