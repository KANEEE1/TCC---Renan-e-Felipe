"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, CheckCircle, TrendingUp, XCircle } from "lucide-react";

const STUDENT_INFO = {
  name: "Carla Maria Silva",
  number: "03",
  class: "Extensivo - Noite"
};

const ATTENDANCE_HISTORY = [
  { id: 1, date: "29/04/2026", subject: "Matemática", status: "presente" },
  { id: 2, date: "29/04/2026", subject: "Física", status: "ausente" },
  { id: 3, date: "28/04/2026", subject: "História", status: "presente" },
  { id: 4, date: "28/04/2026", subject: "Português", status: "presente" },
  { id: 5, date: "27/04/2026", subject: "Química", status: "ausente" },
  { id: 6, date: "27/04/2026", subject: "Matemática", status: "presente" },
  { id: 7, date: "26/04/2026", subject: "Educação Física", status: "presente" },
  { id: 8, date: "26/04/2026", subject: "Geografia", status: "presente" },
  { id: 9, date: "25/04/2026", subject: "História", status: "presente" },
  { id: 10, date: "25/04/2026", subject: "Arte", status: "ausente" }
];

const STATS = { totalClasses: 120, present: 108, absent: 12, percentage: 90 };

const MONTHLY_STATS = [
  { month: "Janeiro", percentage: 95 },
  { month: "Fevereiro", percentage: 92 },
  { month: "Março", percentage: 88 },
  { month: "Abril", percentage: 90 }
];

export function AttendanceReport() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="bg-purple-600 p-4 text-white">
        <div className="mb-3 flex items-center">
          <button type="button" onClick={() => router.back()} className="mr-3">
            <ArrowLeft size={24} />
          </button>
          <h1>Relatório de Frequência</h1>
        </div>

        <div className="rounded-lg bg-purple-500 p-4">
          <h2 className="mb-1 text-white">{STUDENT_INFO.name}</h2>
          <p className="text-sm text-purple-100">
            Nº {STUDENT_INFO.number} - Turma {STUDENT_INFO.class}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-6">
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-gray-800">Resumo Geral</h3>
            <TrendingUp className="text-green-600" size={24} />
          </div>

          <div className="mb-4 text-center">
            <div className="mb-2 text-5xl text-gray-900">{STATS.percentage}%</div>
            <div className="text-gray-600">Taxa de Presença</div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <Calendar className="mx-auto mb-1 text-blue-600" size={20} />
              <div className="text-xl text-blue-900">{STATS.totalClasses}</div>
              <div className="text-xs text-blue-700">Total</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <CheckCircle className="mx-auto mb-1 text-green-600" size={20} />
              <div className="text-xl text-green-900">{STATS.present}</div>
              <div className="text-xs text-green-700">Presentes</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <XCircle className="mx-auto mb-1 text-red-600" size={20} />
              <div className="text-xl text-red-900">{STATS.absent}</div>
              <div className="text-xs text-red-700">Ausentes</div>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 text-gray-800">Evolução Mensal</h3>
          <div className="space-y-3">
            {MONTHLY_STATS.map((stat) => (
              <div key={stat.month}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{stat.month}</span>
                  <span className="text-gray-900">{stat.percentage}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${stat.percentage >= 90 ? "bg-green-500" : stat.percentage >= 75 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 text-gray-800">Histórico Recente</h3>
          <div className="space-y-2">
            {ATTENDANCE_HISTORY.map((record) => (
              <div key={record.id} className={`flex items-center justify-between rounded-lg p-3 ${record.status === "presente" ? "bg-green-50" : "bg-red-50"}`}>
                <div className="flex-1">
                  <div className="text-sm text-gray-800">{record.subject}</div>
                  <div className="text-xs text-gray-600">{record.date}</div>
                </div>
                <div className={`flex items-center ${record.status === "presente" ? "text-green-600" : "text-red-600"}`}>
                  {record.status === "presente" ? <CheckCircle size={16} className="mr-1" /> : <XCircle size={16} className="mr-1" />}
                  <span className="text-xs capitalize">{record.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {STATS.percentage < 75 && (
          <div className="mt-4 rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-4">
            <div className="flex items-start">
              <XCircle className="mr-3 mt-1 flex-shrink-0 text-yellow-600" size={20} />
              <div>
                <h4 className="text-yellow-800">Atenção</h4>
                <p className="mt-1 text-sm text-yellow-700">Frequência abaixo do mínimo recomendado (75%). Considere contato com responsáveis.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
