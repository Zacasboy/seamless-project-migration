import { cn } from "@/lib/utils";

// Pílula de estado no estilo do Radar: cor + texto, nunca só cor.
const TONES: Record<string, string> = {
  pass: "bg-[#E3EDE5] text-[#2F5A3D]",
  fail: "bg-[#F4E1DF] text-[#8E2626]",
  warn: "bg-[#F3E7D2] text-[#7A4F0E]",
  info: "bg-[var(--vanilla-silk)] text-[var(--cherry-velvet)]",
  none: "bg-[#ECE6E1] text-[#5E524C]",
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONES[tone] ?? TONES["none"],
        className,
      )}
    >
      {children}
    </span>
  );
}
