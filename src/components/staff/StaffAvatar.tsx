type StaffAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses: Record<NonNullable<StaffAvatarProps["size"]>, string> = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
};

const toneClasses = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-indigo-100 text-indigo-700",
  "bg-amber-100 text-amber-700",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function tone(name: string) {
  const value = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return toneClasses[value % toneClasses.length];
}

export function StaffAvatar({ name, size = "md" }: StaffAvatarProps) {
  return (
    <div
      className={[
        "inline-flex items-center justify-center rounded-full font-bold",
        sizeClasses[size],
        tone(name),
      ].join(" ")}
      aria-label={`${name} avatar`}
    >
      {initials(name)}
    </div>
  );
}
