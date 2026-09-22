import type { ReactNode } from "react";

type IconBadgeProps = {
  children: ReactNode;
  className?: string;
};

export function IconBadge({ children, className = "" }: IconBadgeProps) {
  return (
    <span className={`flex shrink-0 items-center justify-center ${className}`}>
      {children}
    </span>
  );
}
