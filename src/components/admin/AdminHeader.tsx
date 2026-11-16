import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function AdminHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-4xl md:text-[2.6rem]">{title}</h1>
        {intro && <div className="mt-2 max-w-3xl text-muted-foreground">{intro}</div>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-sm border bg-card p-5", className)}>{children}</section>;
}
