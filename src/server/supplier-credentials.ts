// Autorizações OAuth dos fornecedores (hoje: AliExpress), guardadas cifradas na tabela
// supplier_credentials, que só o servidor lê (RLS sem políticas; acesso por service role).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type StoredCredential = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  account: string | null;
};

// Chave AES-256 derivada do segredo da app: se o segredo mudar, é preciso voltar a autorizar.
function key(secret: string) {
  return createHash("sha256").update(`pallessiani-supplier-token:${secret}`).digest();
}

export function sealToken(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function openToken(sealed: string, secret: string): string {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Token guardado em formato inválido");
  const d = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadCredential(provider: string, secret: string): Promise<StoredCredential | null> {
  const db = await admin();
  const { data, error } = await db
    .from("supplier_credentials")
    .select("access_token, refresh_token, expires_at, refresh_expires_at, account")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível ler a autorização: ${error.message}`);
  if (!data) return null;
  return {
    accessToken: openToken(data.access_token, secret),
    refreshToken: data.refresh_token ? openToken(data.refresh_token, secret) : null,
    expiresAt: data.expires_at,
    refreshExpiresAt: data.refresh_expires_at,
    account: data.account,
  };
}

export async function saveCredential(provider: string, secret: string, c: StoredCredential) {
  const db = await admin();
  const { error } = await db.from("supplier_credentials").upsert({
    provider,
    access_token: sealToken(c.accessToken, secret),
    refresh_token: c.refreshToken ? sealToken(c.refreshToken, secret) : null,
    expires_at: c.expiresAt,
    refresh_expires_at: c.refreshExpiresAt,
    account: c.account,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Não foi possível guardar a autorização: ${error.message}`);
}

/** Estado sem segredos, para o painel. */
export async function credentialStatus(provider: string) {
  try {
    const db = await admin();
    const { data } = await db
      .from("supplier_credentials")
      .select("expires_at, refresh_expires_at, account, updated_at")
      .eq("provider", provider)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}
