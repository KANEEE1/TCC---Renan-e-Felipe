"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, CheckCircle, TrendingUp, XCircle } from "lucide-react";
import { api } from "@/lib/api";

interface PresencaRecord {
  id: string;
  data: string;
  presente: boolean;
  aula: { disciplina: { nome: string } };
}

interface ReportDTO {
  totalClasses: number;
  present: number;
  absent: number;
  percentage: number;
  history: PresencaRecord[];
}

interface StudentDTO {
  nome: string;
  numero: string | null;
  matriculas: { turma: { nome: string } }[];
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function AttendanceReport({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [student, setStudent] = useState<StudentDTO | null>(null);
  const [report, setReport] = useState<ReportDTO | null>(null);

  useEffect(() => {
    api.get<StudentDTO>(`/students/${studentId}`).then(setStudent).catch(() => setStudent(null));
    api.get<ReportDTO>(`/attendance/report/${studentId}`).then(setReport).catch(() => setReport(null));
  }, [studentId]);

  const monthlyStats = useMemo(() => {
    if (!report) return [];
    const byMonth = new Map<number, { present: number; total: number }>();
    for (const record of report.history) {
      const month = new Date(record.data).getUTCMonth();
      const entry = byMonth.get(month) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (record.presente) entry.present += 1;
      byMonth.set(month, entry);
    }
    return Array.from(byMonth.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([month, { present, total }]) => ({ month: MONTH_NAMES[month], percentage: Math.round((present / total) * 100) }));
  }, [report]);

  const recentHistory = report?.history.slice(0, 10) ?? [];

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
          <h2 className="mb-1 text-white">{student?.nome ?? "..."}</h2>
          <p className="text-sm text-purple-100">
            Nº {student?.numero ?? "-"} - Turma {student?.matriculas[0]?.turma.nome ?? "Sem turma"}
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
            <div className="mb-2 text-5xl text-gray-900">{report?.percentage ?? 0}%</div>
            <div className="text-gray-600">Taxa de Presença</div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <Calendar className="mx-auto mb-1 text-blue-600" size={20} />
              <div className="text-xl text-blue-900">{report?.totalClasses ?? 0}</div>
              <div className="text-xs text-blue-700">Total</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <CheckCircle className="mx-auto mb-1 text-green-600" size={20} />
              <div className="text-xl text-green-900">{report?.present ?? 0}</div>
              <div className="text-xs text-green-700">Presentes</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <XCircle className="mx-auto mb-1 text-red-600" size={20} />
              <div className="text-xl text-red-900">{report?.absent ?? 0}</div>
              <div className="text-xs text-red-700">Ausentes</div>
            </div>
          </div>
        </div>

        {monthlyStats.length > 0 && (
          <div className="mb-4 rounded-lg bg-white p-4 shadow">
            <h3 className="mb-3 text-gray-800">Evolução Mensal</h3>
            <div className="space-y-3">
              {monthlyStats.map((stat) => (
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
        )}

        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 text-gray-800">Histórico Recente</h3>
          {recentHistory.length === 0 && <p className="text-sm text-gray-400">Nenhum registro ainda.</p>}
          <div className="space-y-2">
            {recentHistory.map((record) => (
              <div key={record.id} className={`flex items-center justify-between rounded-lg p-3 ${record.presente ? "bg-green-50" : "bg-red-50"}`}>
                <div className="flex-1">
                  <div className="text-sm text-gray-800">{record.aula.disciplina.nome}</div>
                  <div className="text-xs text-gray-600">{new Date(record.data).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className={`flex items-center ${record.presente ? "text-green-600" : "text-red-600"}`}>
                  {record.presente ? <CheckCircle size={16} className="mr-1" /> : <XCircle size={16} className="mr-1" />}
                  <span className="text-xs capitalize">{record.presente ? "presente" : "ausente"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {report && report.percentage < 75 && report.totalClasses > 0 && (
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
