import type { ReactNode } from "react";
import { UserIcon } from "@/components/icons/user-icon";
import { UsersIcon } from "@/components/icons/users-icon";
import { IconBadge } from "@/components/ui/icon-badge";
import { RoleOption, type RoleOptionAccent } from "./role-option";
import { ROLE_OPTIONS } from "./role-options";

function badge(background: string, icon: ReactNode) {
  return <IconBadge className={`h-12 w-12 rounded-full ${background} text-white`}>{icon}</IconBadge>;
}

const OPTION_BADGE: Record<RoleOptionAccent, ReactNode> = {
  blue: badge("bg-blue-600", <UserIcon className="h-6 w-6" />),
  purple: badge("bg-gradient-to-br from-purple-600 to-fuchsia-600", <UsersIcon className="h-6 w-6" />)
};

export function RoleSelectionCard() {
  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
      <IconBadge className="mx-auto h-12 w-12 rounded-full bg-blue-100 text-blue-600">
        <UsersIcon className="h-7 w-7" />
      </IconBadge>

      <h1 className="mt-4 text-center text-2xl font-bold text-slate-900">Cursinho Popular</h1>
      <p className="mt-1 text-center text-sm text-slate-500">Como você deseja acessar o sistema?</p>

      <div className="mt-6 flex flex-col gap-3">
        {ROLE_OPTIONS.map((option) => (
          <RoleOption key={option.href} {...option} icon={OPTION_BADGE[option.accent]} />
        ))}
      </div>
    </div>
  );
}
