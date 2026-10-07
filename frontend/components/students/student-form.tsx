"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";

interface ClassOption {
  id: string;
  nome: string;
}

interface StudentDetail {
  nome: string;
  numero: string | null;
  email: string | null;
  telefone: string | null;
  dataNascimento: string | null;
  cpf: string | null;
  endereco: string | null;
  matriculas: { turma: { id: string } }[];
}

type StudentFormProps = {
  isEdit?: boolean;
  studentId?: string;
};

const EMPTY = { name: "", number: "", classId: "", email: "", phone: "", birthDate: "", cpf: "", address: "" };

export function StudentForm({ isEdit = false, studentId }: StudentFormProps) {
  const router = useRouter();
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [formData, setFormData] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<ClassOption[]>("/classes").then(setClassOptions).catch(() => setClassOptions([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !studentId) return;
    api.get<StudentDetail>(`/students/${studentId}`).then((student) => {
      setFormData({
        name: student.nome,
        number: student.numero ?? "",
        classId: student.matriculas[0]?.turma.id ?? "",
        email: student.email ?? "",
        phone: student.telefone ?? "",
        birthDate: student.dataNascimento ? student.dataNascimento.slice(0, 10) : "",
        cpf: student.cpf ?? "",
        address: student.endereco ?? ""
      });
    });
  }, [isEdit, studentId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      nome: formData.name,
      numero: formData.number || undefined,
      email: formData.email || undefined,
      telefone: formData.phone || undefined,
      dataNascimento: formData.birthDate || undefined,
      cpf: formData.cpf || undefined,
      endereco: formData.address || undefined
    };

    try {
      const id = isEdit && studentId ? studentId : undefined;
      const student = id ? await api.put<{ id: string }>(`/students/${id}`, payload) : await api.post<{ id: string }>("/students", payload);

      if (formData.classId) {
        await api.post(`/classes/${formData.classId}/students`, { studentIds: [student.id] });
      }

      router.push("/students");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setLoading(false);
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
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione</option>
                  {classOptions.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Data de Nascimento</label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">E-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="email@aluno.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Telefone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="(11) 98765-4321"
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">CPF</label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="123.456.789-00"
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Endereço</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Endereço completo"
                rows={2}
              />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            disabled={loading}
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
