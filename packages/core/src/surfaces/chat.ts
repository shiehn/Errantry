import type {
  Surface,
  SurfaceInvocation,
  SurfaceResult,
  SurfaceTool,
} from '../types.js';

export interface ChatSurfaceOptions {
  /**
   * Base URL of the Errantry bridge installed in the host app's main
   * process (e.g., `http://127.0.0.1:7654`). The surface POSTs to
   * `${bridgeUrl}/errantry/chat`.
   */
  bridgeUrl: string;
  /** Hard timeout per chat call, in ms. Default 120_000 (2 min). */
  timeoutMs?: number;
  /**
   * Optional fetch implementation override. The surface uses globalThis.fetch
   * by default; tests inject a stub here.
   */
  fetchImpl?: typeof fetch;
}

const CHAT_TOOL: SurfaceTool = {
  name: 'chat',
  description:
    "Send a natural-language instruction to the music workstation's built-in chat assistant. " +
    'The assistant inspects the active scene, drives the underlying tools, and returns a summary ' +
    'of what it did. Be specific — the assistant cannot ask clarifying questions before acting.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'A plain-language instruction. Example: "Create a scene called Verse" or ' +
          '"Add a bass track and make it punchier".',
      },
    },
    required: ['message'],
    additionalProperties: false,
  },
};

/**
 * Chat surface — the agent's only tool is `chat`. Each invocation POSTs the
 * user-facing message to the host app's Errantry bridge, which dispatches to
 * the chat plugin and returns the structured AgentLoopResponse (final text
 * + tool-call events + iteration count).
 *
 * Two LLMs are involved at runtime:
 *
 *   1. Errantry's *probe* LLM (e.g. gpt-4o-mini) — sends `chat` tool calls.
 *   2. The chat plugin's LLM (Gemini, inside Electron main) — receives the
 *      message, drives the `sas` CLI internally, returns a summary.
 *
 * This surface tests the chat plugin's UX as a black box: can the chat
 * assistant deliver the same outcome from a natural-language ask that the
 * CLI achieves from explicit commands?
 */
export class ChatSurface implements Surface {
  readonly kind = 'chat' as const;

  constructor(private readonly options: ChatSurfaceOptions) {}

  tools(): SurfaceTool[] {
    return [CHAT_TOOL];
  }

  async invoke(call: SurfaceInvocation): Promise<SurfaceResult> {
    if (call.tool !== 'chat') {
      throw new Error(
        `ChatSurface only supports the "chat" tool; got "${call.tool}"`,
      );
    }
    const message = String(call.args.message ?? '').trim();
    if (!message) {
      return {
        ok: false,
        stdout: '',
        stderr: 'Empty message.',
        exitCode: null,
        durationMs: 0,
      };
    }
    return this.postChat(message);
  }

  private async postChat(message: string): Promise<SurfaceResult> {
    const startedAt = Date.now();
    const url = `${this.options.bridgeUrl.replace(/\/+$/, '')}/errantry/chat`;
    const timeoutMs = this.options.timeoutMs ?? 120_000;
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();

    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      const durationMs = Date.now() - startedAt;

      if (!res.ok) {
        const text = await safeText(res);
        return {
          ok: false,
          stdout: '',
          stderr: `Bridge returned HTTP ${res.status}: ${text}`,
          exitCode: res.status,
          durationMs,
        };
      }

      const body = (await res.json()) as ChatBridgeResponse;
      return formatChatResponse(body, durationMs);
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const message =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `chat call timed out after ${timeoutMs}ms`
            : err.message
          : String(err);
      return {
        ok: false,
        stdout: '',
        stderr: `[errantry] chat invocation failed: ${message}`,
        exitCode: null,
        durationMs,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Shape returned by the bridge's `/errantry/chat` endpoint. Mirrors
 * `ChatResponse` from sas-chat-plugin but the bridge package is not allowed
 * to import that type directly — we duck-type and forward an opaque payload.
 */
interface ChatBridgeResponse {
  text: string;
  events?: unknown[];
  iterations?: number;
  iterationLimitHit?: boolean;
}

function formatChatResponse(
  body: ChatBridgeResponse,
  durationMs: number,
): SurfaceResult {
  const text = body.text ?? '';
  const eventSummary = summarizeEvents(body.events ?? []);
  const stdout = eventSummary ? `${text}\n\n${eventSummary}` : text;
  const limitHit = body.iterationLimitHit === true;
  return {
    ok: !limitHit,
    stdout,
    stderr: limitHit
      ? `chat assistant hit its iteration limit (${body.iterations ?? '?'} iterations) without finishing.`
      : '',
    exitCode: limitHit ? 1 : 0,
    durationMs,
  };
}

function summarizeEvents(events: unknown[]): string {
  const lines: string[] = [];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const e = ev as { type?: string; toolName?: string; result?: { success?: boolean } };
    if (e.type === 'tool_call_done' && typeof e.toolName === 'string') {
      const ok = e.result?.success !== false;
      lines.push(`  - ${e.toolName} → ${ok ? 'ok' : 'failed'}`);
    }
  }
  return lines.length > 0 ? `Tool actions:\n${lines.join('\n')}` : '';
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '<no body>';
  }
}
