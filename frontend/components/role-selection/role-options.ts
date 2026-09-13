import type { RoleOptionAccent } from "./role-option";

export type RoleOptionData = {
  href: string;
  title: string;
  description: string;
  accent: RoleOptionAccent;
};

export const ROLE_OPTIONS: RoleOptionData[] = [
  {
    href: "/login-professor",
    title: "Professor",
    description: "Gerenciar aulas e presenças",
    accent: "blue"
  },
  {
    href: "/gestao",
    title: "Gestão",
    description: "Gestão completa do sistema",
    accent: "purple"
  }
];
