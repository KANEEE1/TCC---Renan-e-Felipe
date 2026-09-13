type IconProps = {
  className?: string;
};

export function UsersIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 8.5a2.5 2.5 0 1 0 0-5" />
      <path d="M18.5 19a5 5 0 0 0-3.5-6.5" />
    </svg>
  );
}
