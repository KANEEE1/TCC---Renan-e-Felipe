import type { Accent } from "@/components/ui/accent";

type RoleBadgeProps = {
  label: string;
  accent: Accent;
};

const ACCENT_STYLES: Record<Accent, string> = {
  blue: "bg-blue-50 text-blue-700",
  purple: "bg-purple-50 text-purple-700"
};

const DOT_STYLES: Record<Accent, string> = {
  blue: "bg-blue-600",
  purple: "bg-purple-600"
};

export function RoleBadge({ label, accent }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${ACCENT_STYLES[accent]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[accent]}`} />
      {label}
    </span>
  );
}
