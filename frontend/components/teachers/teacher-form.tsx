"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";

interface Subject {
  id: string;
  nome: string;
}

interface TeacherDetail {
  name: string;
  email: string;
  celular: string | null;
  ativo: boolean;
  disciplinas: Subject[];
}

type TeacherFormProps = {
  isEdit?: boolean;
  teacherId?: string;
};

export function TeacherForm({ isEdit = false, teacherId }: TeacherFormProps) {
  const router = useRouter();
  const [subjectOptions, setSubjectOptions] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Subject[]>("/disciplinas").then(setSubjectOptions).catch(() => setSubjectOptions([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !teacherId) return;
    api.get<TeacherDetail>(`/teachers/${teacherId}`).then((teacher) => {
      setName(teacher.name);
      setEmail(teacher.email);
      setPhone(teacher.celular ?? "");
      setAtivo(teacher.ativo);
      setSubjectIds(teacher.disciplinas.map((d) => d.id));
    });
  }, [isEdit, teacherId]);

  const handleSubjectToggle = (subjectId: string) => {
    setSubjectIds((prev) => (prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isEdit && teacherId) {
        await api.put(`/teachers/${teacherId}`, { name, celular: phone, ativo, disciplinaIds: subjectIds });
      } else {
        await api.post("/teachers", { name, email, celular: phone, password, disciplinaIds: subjectIds });
      }
      router.push("/teachers");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-blue-600 p-4 text-white">
        <Link href="/teachers" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>{isEdit ? "Editar Professor" : "Novo Professor"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="space-y-4 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="mb-2 block text-gray-700">Nome Completo</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isEdit}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="email@escola.com"
              required
            />
          </div>

          {!isEdit && (
            <div>
              <label className="mb-2 block text-gray-700">Senha de acesso</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-gray-700">Telefone</label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="(11) 98765-4321"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Disciplinas</label>
            <div className="grid grid-cols-2 gap-2">
              {subjectOptions.map((subject) => (
                <label
                  key={subject.id}
                  className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                    subjectIds.includes(subject.id) ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={subjectIds.includes(subject.id)}
                    onChange={() => handleSubjectToggle(subject.id)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900">{subject.nome}</span>
                </label>
              ))}
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="mb-2 block text-gray-700">Status</label>
              <select
                value={ativo ? "Ativo" : "Inativo"}
                onChange={(event) => setAtivo(event.target.value === "Ativo")}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-3 text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <Save size={20} className="mr-2" />
            {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Cadastrar Professor"}
          </button>
        </div>
      </form>
    </div>
  );
}
