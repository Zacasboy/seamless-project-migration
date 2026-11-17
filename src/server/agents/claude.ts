// Cliente mínimo da API da Anthropic (Messages). Só corre no servidor.
const API = "https://api.anthropic.com/v1/messages";

export const agentModel = () => process.env["ANTHROPIC_MODEL"]?.trim() || "claude-sonnet-5-5";
export const claudeConfigured = () => !!process.env["ANTHROPIC_API_KEY"]?.trim();

export type Block =
  | { type: "text"; text: string; citations?: unknown[] }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "server_tool_use"; id: string; name: string; input: unknown }
  | {
      type: "web_search_tool_result";
      tool_use_id: string;
      content: { type: string; url?: string; title?: string; error_code?: string }[] | { type: string; error_code?: string };
    }
  | { type: string; [k: string]: unknown };

export type Message = { role: "user" | "assistant"; content: string | unknown[] };

export type ClaudeResponse = {
  content: Block[];
  stop_reason: "end_turn" | "tool_use" | "pause_turn" | "max_tokens" | "stop_sequence" | "refusal" | string;
  usage: { input_tokens: number; output_tokens: number };
};

export class ClaudeError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export async function callClaude(body: Record<string, unknown>): Promise<ClaudeResponse> {
  const key = process.env["ANTHROPIC_API_KEY"]?.trim();
  if (!key) throw new ClaudeError("Falta ANTHROPIC_API_KEY no servidor.");
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(API, {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: agentModel(), ...body }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      if (attempt < 1) continue;
      throw new ClaudeError(
        (e as Error).name === "TimeoutError" ? "A API da Anthropic demorou demasiado." : "Não foi possível contactar a API da Anthropic.",
      );
    }
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    const json = (await res.json().catch(() => null)) as
      | (ClaudeResponse & { error?: { message?: string } })
      | null;
    if (!res.ok || !json) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      throw new ClaudeError(
        res.status === 401 ? "A ANTHROPIC_API_KEY foi recusada." : `API da Anthropic: ${msg}`,
        res.status,
      );
    }
    return json;
  }
}
