"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, ClipboardCheck, GraduationCap, Home, Trophy, Users } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Início" },
  { href: "/teachers", icon: Users, label: "Professores" },
  { href: "/calendar", icon: CalendarDays, label: "Calendário" },
  { href: "/attendance", icon: ClipboardCheck, label: "Presença" },
  { href: "/students", icon: GraduationCap, label: "Alunos" },
  { href: "/classes", icon: BookOpen, label: "Turmas" },
  { href: "/simulados", icon: Trophy, label: "Simulados" }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 shadow-xl backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-lg items-center justify-around px-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex h-full flex-1 flex-col items-center justify-center gap-0.5"
            >
              <div
                className={`flex h-7 w-10 items-center justify-center rounded-full transition-colors ${
                  isActive ? "bg-blue-100" : ""
                }`}
              >
                <Icon size={20} className={isActive ? "text-blue-600" : "text-slate-400"} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span className={`text-[10px] leading-none ${isActive ? "font-semibold text-blue-600" : "font-normal text-slate-400"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
