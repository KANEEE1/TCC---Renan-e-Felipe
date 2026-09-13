type RoleBadgeProps = {
  label: string;
};

export function RoleBadge({ label }: RoleBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
      {label}
    </span>
  );
}
