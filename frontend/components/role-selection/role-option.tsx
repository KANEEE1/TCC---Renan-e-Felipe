import Link from "next/link";
import type { ReactNode } from "react";
import type { Accent } from "@/components/ui/accent";

type RoleOptionProps = {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent: Accent;
};

const ACCENT_STYLES: Record<Accent, string> = {
  blue: "border-blue-200 bg-blue-50 hover:bg-blue-100",
  purple: "border-purple-200 bg-purple-50 hover:bg-purple-100"
};

export function RoleOption({ href, title, description, icon, accent }: RoleOptionProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${ACCENT_STYLES[accent]}`}
    >
      {icon}
      <span className="flex flex-col">
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="text-sm text-slate-500">{description}</span>
      </span>
    </Link>
  );
}
