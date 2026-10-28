"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Save, User, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { TodayItem } from "./attendance-list";

interface ClassDetail {
  matriculas: { aluno: { id: string; nome: string; numero: string | null } }[];
}

interface StudentRow {
  id: string;
  name: string;
  number: string;
  present: boolean;
}

function reason(item: TodayItem) {
  if (!item.responsavel) return "Somente o professor responsável pela aula registra a presença.";
  if (item.status === "AGUARDANDO") return `A chamada abre às ${item.aula.horarioInicio}.`;
  return "A janela de registro desta aula já encerrou.";
}

export function MarkAttendance({ aulaId }: { aulaId: string }) {
  const [item, setItem] = useState<TodayItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<TodayItem[]>("/attendance/today")
      .then((items) => {
        const found = items.find((i) => i.aula.id === aulaId) ?? null;
        setItem(found);
        if (found) {
          api.get<ClassDetail>(`/classes/${found.aula.turma.id}`).then((cls) => {
            setStudents(
              cls.matriculas.map((m) => ({ id: m.aluno.id, name: m.aluno.nome, number: m.aluno.numero ?? "-", present: true }))
            );
          });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar a aula."))
      .finally(() => setLoaded(true));
  }, [aulaId]);

  const canEdit = item?.podeRegistrar === true;

  const toggleAttendance = (studentId: string) => {
    if (!canEdit) return;
    setStudents((prev) => prev.map((student) => (student.id === studentId ? { ...student, present: !student.present } : student)));
  };

  const markAllPresent = () => canEdit && setStudents((prev) => prev.map((student) => ({ ...student, present: true })));
  const markAllAbsent = () => canEdit && setStudents((prev) => prev.map((student) => ({ ...student, present: false })));

  const presentCount = students.filter((s) => s.present).length;
  const absentCount = students.length - presentCount;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post("/attendance/mark", {
        aulaId,
        entries: students.map((s) => ({ alunoId: s.id, presente: s.present }))
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a presença.");
    } finally {
      setSaving(false);
    }
  };

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
          <div className="text-sm text-green-100">{item ? `${item.aula.disciplina.nome} - ${item.aula.turma.nome}` : loaded ? "Aula não encontrada hoje" : "Carregando..."}</div>
          {item && (
            <div className="text-sm text-green-100">
              {item.aula.horarioInicio} - {item.aula.horarioFim} | {item.aula.professor.name}
            </div>
          )}
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
              className={`${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70"} rounded-lg bg-white p-4 shadow transition-all ${student.present ? "border-l-4 border-green-500" : "border-l-4 border-red-500"}`}
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

        {item && !canEdit && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{reason(item)}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {saved && <p className="mt-3 text-sm text-emerald-600">Presença salva com sucesso.</p>}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
        <div className="mb-2 text-center text-sm text-gray-600">
          {presentCount} de {students.length} presentes ({students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0}%)
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canEdit || students.length === 0}
          className="flex w-full items-center justify-center rounded-lg bg-green-600 py-3 text-white transition-colors hover:bg-green-700 disabled:opacity-60"
        >
          <Save size={20} className="mr-2" />
          {saving ? "Salvando..." : "Salvar Presença"}
        </button>
      </div>
    </div>
  );
}
