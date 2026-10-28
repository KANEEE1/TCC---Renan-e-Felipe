"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { formatPeriodo } from "@/components/schedule/period-picker";

const REDIRECT_MS = 4000;

type GradeCreatedDialogProps = {
  turma: string;
  aulas: number;
  gradeInicio?: string | null;
  gradeFim?: string | null;
};

// Pop-up de parabéns depois de confirmar a grade; volta sozinho para o início.
export function GradeCreatedDialog({ turma, aulas, gradeInicio, gradeFim }: GradeCreatedDialogProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => router.replace("/dashboard"), REDIRECT_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grade-created-title"
        className={`w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl transition-all duration-300 ${
          visible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        }`}
      >
        <div className="bg-gradient-to-br from-teal-500 to-emerald-500 px-6 pb-6 pt-8 text-white">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <PartyPopper size={32} />
          </span>
          <h2 id="grade-created-title" className="mt-4 text-2xl font-bold">
            Parabéns!
          </h2>
          <p className="mt-1 text-sm text-teal-50">
            Você criou a grade horária da turma <strong className="text-white">{turma}</strong>.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex justify-center gap-6 text-sm text-slate-600">
            <div>
              <p className="text-2xl font-semibold text-slate-800">{aulas}</p>
              <p>aula{aulas !== 1 ? "s" : ""} por semana</p>
            </div>
            {gradeInicio && gradeFim && (
              <div>
                <p className="text-sm font-semibold text-slate-800">{formatPeriodo(gradeInicio, gradeFim)}</p>
                <p>período da grade</p>
              </div>
            )}
          </div>

          <div className="h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-500 transition-[width] ease-linear"
              style={{ width: visible ? "100%" : "0%", transitionDuration: `${REDIRECT_MS}ms` }}
            />
          </div>
          <p className="text-xs text-slate-400">Voltando para o início...</p>

          <button
            type="button"
            onClick={() => router.replace("/dashboard")}
            className="w-full rounded-full bg-teal-600 py-3 text-white transition-colors hover:bg-teal-700"
          >
            Ir para o início agora
          </button>
        </div>
      </div>
    </div>
  );
}
