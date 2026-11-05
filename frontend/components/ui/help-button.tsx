"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

interface HelpButtonProps {
  title: string;
  children: React.ReactNode;
  // Estilo do botão em si: "dark" pra fundo colorido (gradiente), "light" pra fundo branco.
  variant?: "dark" | "light";
  className?: string;
}

// Botão "?" que abre um popup explicando, em linguagem simples, como aquela tela funciona.
// Usado nas partes mais importantes/menos óbvias do sistema (ver onde é chamado).
export function HelpButton({ title, children, variant = "dark", className = "" }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  const buttonClass =
    variant === "dark"
      ? "bg-white/20 text-white hover:bg-white/30"
      : "border border-slate-200 text-slate-500 hover:bg-slate-50";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Como funciona essa tela"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${buttonClass} ${className}`}
      >
        <HelpCircle size={17} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2.5 text-sm leading-relaxed text-slate-600">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
