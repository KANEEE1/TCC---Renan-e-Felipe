import { LoginIcon } from "@/components/icons/login-icon";
import { IconBadge } from "@/components/ui/icon-badge";

type LoginHeaderProps = {
  subtitle: string;
};

export function LoginHeader({ subtitle }: LoginHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <IconBadge className="h-16 w-16 rounded-2xl bg-white/20 text-white">
        <LoginIcon className="h-7 w-7" />
      </IconBadge>
      <div>
        <h1 className="text-2xl font-bold text-white">Cursinho Popular</h1>
        <p className="mt-1 text-sm text-white/80">{subtitle}</p>
      </div>
    </div>
  );
}
