import type { Accent } from "@/components/ui/accent";

export type RoleOptionData = {
  href: string;
  title: string;
  description: string;
  accent: Accent;
};

export const ROLE_OPTIONS: RoleOptionData[] = [
  {
    href: "/login-professor",
    title: "Professor",
    description: "Gerenciar aulas e presenças",
    accent: "blue"
  },
  {
    href: "/login-gestao",
    title: "Gestão",
    description: "Gestão completa do sistema",
    accent: "purple"
  }
];
