type IconProps = {
  className?: string;
};

export function EyeIcon({ className }: IconProps) {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className }: IconProps) {
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
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.83 2.83" />
      <path d="M9.4 5.5A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-3.06 3.94M6.3 6.3C4 7.9 2 12 2 12a13.2 13.2 0 0 0 4.24 4.9A9.9 9.9 0 0 0 12 19c1.02 0 1.98-.15 2.87-.42" />
    </svg>
  );
}
