import type { ReactNode } from "react";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <div className="flex-1 overflow-y-auto pb-16">{children}</div>
      <BottomNav />
    </div>
  );
}
