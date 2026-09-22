import { LoginIcon } from "@/components/icons/login-icon";
import { LoginProfessorCard } from "@/components/login-professor/login-professor-card";
import { IconBadge } from "@/components/ui/icon-badge";

export default function LoginProfessorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#4a6cf7] via-[#7c5cf0] to-[#9333ea] px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <IconBadge className="h-16 w-16 rounded-2xl bg-white/20 text-white">
          <LoginIcon className="h-7 w-7" />
        </IconBadge>
        <div>
          <h1 className="text-2xl font-bold text-white">Cursinho Popular</h1>
          <p className="mt-1 text-sm text-white/80">Acesso do Professor</p>
        </div>
      </div>

      <LoginProfessorCard />
    </main>
  );
}
