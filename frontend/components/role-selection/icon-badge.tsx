import type { ReactNode } from "react";

type IconBadgeProps = {
  children: ReactNode;
  className?: string;
};

export function IconBadge({ children, className = "" }: IconBadgeProps) {
  return (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${className}`}>
      {children}
    </span>
  );
}
