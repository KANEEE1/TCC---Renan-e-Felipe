"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

interface ClassOption {
  id: string;
  nome: string;
}

interface StudentDetail {
  nome: string;
  numero: string | null;
  removidoEm: string | null;
  matriculas: { turma: { id: string } }[];
}

type StudentFormProps = {
  isEdit?: boolean;
  studentId?: string;
};

// Cadastro mínimo (LGPD): nome, número e turma. Os demais campos do aluno ficam fora do formulário.
const EMPTY = { name: "", number: "", classId: "" };

export function StudentForm({ isEdit = false, studentId }: StudentFormProps) {
  const router = useRouter();
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [formData, setFormData] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isManagement, setIsManagement] = useState(false);
  const [removidoEm, setRemovidoEm] = useState<string | null>(null);

  useEffect(() => {
    setIsManagement(!!getSessionUser()?.roles.includes("GESTAO"));
  }, []);

  useEffect(() => {
    api.get<ClassOption[]>("/classes").then(setClassOptions).catch(() => setClassOptions([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !studentId) return;
    api.get<StudentDetail>(`/students/${studentId}`).then((student) => {
      setFormData({
        name: student.nome,
        number: student.numero ?? "",
        classId: student.matriculas[0]?.turma.id ?? ""
      });
      setRemovidoEm(student.removidoEm);
    });
  }, [isEdit, studentId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isEdit && !formData.classId) return setError("Selecione a turma do aluno.");
    setLoading(true);

    const payload = {
      nome: formData.name,
      numero: formData.number || undefined
    };

    try {
      if (isEdit && studentId) {
        // Na edição a turma não muda: só nome e número.
        await api.put(`/students/${studentId}`, payload);
      } else {
        // No cadastro a turma vai junto: o backend cria o aluno já matriculado.
        await api.post("/students", { ...payload, turmaId: formData.classId });
      }

      router.push("/students");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Exclusão lógica: o histórico (presenças e notas de simulados finalizados) fica.
  const handleDelete = async () => {
    if (!studentId) return;
    const nome = formData.name || "este aluno";
    const aviso =
      `Excluir ${nome}? Ele sai da turma, das listas de presença e dos simulados ainda não finalizados ` +
      "(notas lançadas neles são apagadas). Presenças e notas de simulados finalizados continuam no histórico.";
    if (!confirm(aviso)) return;
    setError(null);
    setDeleting(true);
    try {
      await api.delete(`/students/${studentId}`);
      router.push("/students");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir o aluno. Tente novamente.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-indigo-600 p-4 text-white">
        <Link href="/students" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>{isEdit ? "Editar Aluno" : "Novo Aluno"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <h3 className="mb-4 text-gray-800">Dados do Aluno</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-gray-700">Nome Completo</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nome completo do aluno"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-gray-700">Número</label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nº"
                />
              </div>

              <div>
                <label className="mb-2 block text-gray-700">Turma</label>
                <select
                  value={formData.classId}
                  required={!isEdit}
                  disabled={isEdit}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">Selecione</option>
                  {classOptions.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.nome}
                    </option>
                  ))}
                </select>
                {isEdit && <p className="mt-1 text-sm text-gray-500">A turma do aluno não pode ser alterada.</p>}
                {!isEdit && classOptions.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    Nenhuma turma cadastrada.{" "}
                    <Link href="/classes/add" className="text-indigo-600 underline">
                      Crie uma turma
                    </Link>{" "}
                    antes de adicionar alunos.
                  </p>
                )}
              </div>
            </div>
          </div>

          {removidoEm && (
            <p className="mt-3 text-sm text-gray-600">
              Este aluno foi removido em {new Date(removidoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {isEdit && isManagement && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || loading || !!removidoEm}
            className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "Excluindo..." : "Excluir aluno"}
          </button>
        )}

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            disabled={loading || deleting || !!removidoEm}
            className="flex w-full items-center justify-center rounded-lg bg-indigo-600 py-3 text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            <Save size={20} className="mr-2" />
            {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Cadastrar Aluno"}
          </button>
        </div>
      </form>
    </div>
  );
}
