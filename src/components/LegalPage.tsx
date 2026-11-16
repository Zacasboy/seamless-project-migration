import type { ReactNode } from "react";
import { StoreLayout } from "@/components/StoreLayout";
import { PENDING, SITE } from "@/lib/site";

// Mostra um dado da empresa ou um aviso visível enquanto estiver por preencher.
export function Fill({ v, label }: { v: string; label: string }) {
  if (!v || v === PENDING)
    return (
      <mark className="bg-[#F3E7D2] px-1 text-[#7A4F0E]" title="Preencher em src/lib/site.ts">
        [{label} por preencher]
      </mark>
    );
  return <>{v}</>;
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <StoreLayout>
      <article className="mx-auto max-w-[68ch] px-6 py-14 md:py-20">
        <p className="eyebrow">Atualizado a {SITE.legalUpdated}</p>
        <h1 className="mt-3 text-4xl md:text-5xl">{title}</h1>
        <div className="mt-10 space-y-5 leading-relaxed [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_a]:underline [&_a]:underline-offset-4">
          {children}
        </div>
      </article>
    </StoreLayout>
  );
}
