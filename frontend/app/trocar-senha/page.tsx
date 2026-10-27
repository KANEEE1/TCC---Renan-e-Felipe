import { ChangePasswordCard } from "@/components/login/change-password-card";
import { LoginHeader } from "@/components/login/login-header";

export default function TrocarSenhaPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#4a6cf7] via-[#7c5cf0] to-[#9333ea] px-4 py-10">
      <LoginHeader subtitle="Trocar senha" />
      <ChangePasswordCard />
    </main>
  );
}
