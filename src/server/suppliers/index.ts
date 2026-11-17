import { aliexpressAdapter } from "./aliexpress";
import { bigbuyAdapter } from "./bigbuy";
import { brandsgatewayAdapter } from "./brandsgateway";
import { cjAdapter } from "./cj";
import { printfulAdapter } from "./printful";
import type { ProviderKey, SupplierAdapter } from "./types";

export const ADAPTERS: Record<ProviderKey, SupplierAdapter> = {
  cj: cjAdapter,
  bigbuy: bigbuyAdapter,
  printful: printfulAdapter,
  brandsgateway: brandsgatewayAdapter,
  aliexpress: aliexpressAdapter,
};

/** Descobre o fornecedor e o id a partir do texto colado (link ou referência). */
export function resolveRef(
  input: string,
  hint?: ProviderKey,
): { adapter: SupplierAdapter; id: string } | null {
  const order = hint ? [ADAPTERS[hint]] : Object.values(ADAPTERS);
  // Primeiro os links (host conhecido), depois referências soltas no fornecedor indicado.
  for (const a of order) {
    let isUrl = false;
    try {
      new URL(input.trim());
      isUrl = true;
    } catch {
      /* não é link */
    }
    if (!isUrl && !hint) continue;
    const id = a.parseRef(input);
    if (id) return { adapter: a, id };
  }
  return null;
}

export * from "./types";
