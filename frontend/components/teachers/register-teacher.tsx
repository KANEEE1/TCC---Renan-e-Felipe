"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronLeft, Eye, EyeOff, Lock, Mail, Phone, Trash2, User, UserPlus } from "lucide-react";

const SUBJECT_OPTIONS = [
  "Matemática",
  "Física",
  "Química",
  "Biologia",
  "História",
  "Geografia",
  "Português",
  "Literatura",
  "Redação",
  "Inglês",
  "Filosofia",
  "Sociologia"
];

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-700",
  "from-pink-500 to-rose-600",
  "from-teal-500 to-emerald-600",
  "from-orange-500 to-amber-600",
  "from-indigo-500 to-blue-700"
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

type RegisteredTeacher = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subjects: string[];
  createdAt: string;
};

const REGISTERED_TEACHERS: RegisteredTeacher[] = [
  { id: "1", name: "Ana Silva", email: "ana.silva@escola.com", phone: "(11) 98765-4321", subjects: ["Matemática", "Física"], createdAt: "2026-03-12" },
  { id: "2", name: "Carlos Santos", email: "carlos.santos@escola.com", phone: "(11) 98765-4322", subjects: ["História", "Geografia"], createdAt: "2026-04-02" }
];

export function RegisterTeacher() {
  const [tab, setTab] = useState<"register" | "list">("register");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [teachers, setTeachers] = useState(REGISTERED_TEACHERS);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const toggleSubject = (subject: string) =>
    setSubjects((prev) => (prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]));

  const handleDelete = (id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    setDeleteConfirm(null);
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 px-4 pb-4 pt-5 text-white">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/teachers" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="leading-tight text-white">Cadastrar Professor</h1>
            <p className="mt-0.5 text-xs text-blue-200">Criar login e senha de acesso</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-white/15 p-0.5">
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`flex-1 rounded-[10px] py-2 text-sm transition-all ${
              tab === "register" ? "bg-white text-blue-700 shadow-sm" : "text-white/80 hover:text-white"
            }`}
          >
            Novo Professor
          </button>
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-sm transition-all ${
              tab === "list" ? "bg-white text-blue-700 shadow-sm" : "text-white/80 hover:text-white"
            }`}
          >
            Cadastrados
            {teachers.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${tab === "list" ? "bg-blue-600 text-white" : "bg-white/30 text-white"}`}>
                {teachers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">
        {tab === "register" && (
          <form onSubmit={(event) => event.preventDefault()} className="space-y-4">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Dados Pessoais</p>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <User size={14} className="text-slate-400" /> Nome Completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: Ana Silva"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Phone size={14} className="text-slate-400" /> Telefone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Credenciais de Acesso</p>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Mail size={14} className="text-slate-400" /> E-mail (login) *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="professor@escola.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Lock size={14} className="text-slate-400" /> Senha *
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          password.length >= i * 3 ? (password.length >= 8 ? "bg-emerald-400" : "bg-amber-400") : "bg-slate-100"
                        }`}
                      />
                    ))}
                    <span className="ml-1 self-center text-[10px] text-slate-400">
                      {password.length < 4 ? "fraca" : password.length < 8 ? "média" : "forte"}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Lock size={14} className="text-slate-400" /> Confirmar Senha *
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    placeholder="Repita a senha"
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                      confirm && confirm !== password
                        ? "border-red-300 focus:ring-red-400"
                        : confirm && confirm === password
                          ? "border-emerald-300 focus:ring-emerald-400"
                          : "border-slate-200 focus:ring-blue-400"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400">
                <BookOpen size={13} /> Disciplinas *
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SUBJECT_OPTIONS.map((subject) => {
                  const active = subjects.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                        active ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          active ? "border-white bg-white/30" : "border-slate-300"
                        }`}
                      >
                        {active && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                      {subject}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <UserPlus size={18} />
              Cadastrar Professor
            </button>
          </form>
        )}

        {tab === "list" && (
          <div className="space-y-3">
            {teachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <div className="mb-3 text-5xl">👥</div>
                <p className="text-sm text-slate-400">Nenhum professor cadastrado ainda</p>
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm text-white transition-colors hover:bg-blue-700"
                >
                  Cadastrar primeiro professor
                </button>
              </div>
            ) : (
              teachers.map((teacher, idx) => (
                <div key={teacher.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`}
                      >
                        <span className="text-sm text-white">{getInitials(teacher.name)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">{teacher.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{teacher.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                        Ativo
                      </span>
                    </div>

                    {teacher.phone && <p className="mb-2 text-xs text-slate-400">📞 {teacher.phone}</p>}

                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {teacher.subjects.map((subject) => (
                        <span key={subject} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                          {subject}
                        </span>
                      ))}
                    </div>

                    <p className="mb-3 text-[10px] text-slate-300">Criado em {teacher.createdAt}</p>

                    {deleteConfirm === teacher.id ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(teacher.id)}
                          className="flex-1 rounded-xl bg-red-600 py-2 text-xs text-white transition-colors hover:bg-red-700"
                        >
                          Confirmar exclusão
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(null)}
                          className="flex-1 rounded-xl bg-slate-100 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(teacher.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={13} /> Remover acesso
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
