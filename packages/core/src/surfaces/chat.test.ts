import { describe, expect, it } from 'vitest';
import { ChatSurface } from './chat.js';

/**
 * Build a stub fetch that records calls and returns a fixed Response.
 * Avoids spinning up a real HTTP server for unit tests.
 */
function stubFetch(
  responder: (url: string, init: RequestInit) =>
    | { status: number; body: unknown }
    | Promise<{ status: number; body: unknown }>,
): { fetch: typeof fetch; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const initRecord = init ?? {};
    calls.push({ url, init: initRecord });
    const r = await responder(url, initRecord);
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

describe('ChatSurface', () => {
  it('exposes a single chat tool with a message parameter', () => {
    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:7654' });
    const tools = surface.tools();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('chat');
    const params = tools[0]?.parameters as { properties: Record<string, unknown>; required: string[] };
    expect(params.properties.message).toBeDefined();
    expect(params.required).toEqual(['message']);
  });

  it('rejects non-chat tools', async () => {
    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:7654' });
    await expect(
      surface.invoke({ tool: 'bash', args: { command: 'ls' } }),
    ).rejects.toThrow(/only supports/);
  });

  it('returns a structured failure for empty messages without calling fetch', async () => {
    const { fetch, calls } = stubFetch(() => ({ status: 200, body: { text: 'unused' } }));
    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:7654', fetchImpl: fetch });
    const result = await surface.invoke({ tool: 'chat', args: { message: '   ' } });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/Empty/);
    expect(calls).toHaveLength(0);
  });

  it('POSTs to /errantry/chat and returns the assistant text on success', async () => {
    const { fetch, calls } = stubFetch(() => ({
      status: 200,
      body: {
        text: 'Created scene "Verse".',
        events: [],
        iterations: 2,
        iterationLimitHit: false,
      },
    }));
    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:7654', fetchImpl: fetch });
    const result = await surface.invoke({ tool: 'chat', args: { message: 'create scene Verse' } });

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Verse/);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('http://127.0.0.1:7654/errantry/chat');
    expect(call.init.method).toBe('POST');
    expect(JSON.parse(String(call.init.body))).toEqual({ message: 'create scene Verse' });
  });

  it('strips trailing slashes from the bridge URL', async () => {
    const { fetch, calls } = stubFetch(() => ({ status: 200, body: { text: 'ok' } }));
    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:7654///', fetchImpl: fetch });
    await surface.invoke({ tool: 'chat', args: { message: 'hi' } });
    expect(calls[0]?.url).toBe('http://127.0.0.1:7654/errantry/chat');
  });

  it('summarizes tool_call_done events alongside the assistant text', async () => {
    const { fetch } = stubFetch(() => ({
      status: 200,
      body: {
        text: 'Done.',
        events: [
          { type: 'tool_call_start', toolName: 'scene_get_tracks' },
          { type: 'tool_call_done', toolName: 'scene_get_tracks', result: { success: true } },
          { type: 'tool_call_done', toolName: 'dsl_play', result: { success: false } },
          { type: 'final_text', text: 'Done.' },
        ],
        iterations: 3,
        iterationLimitHit: false,
      },
    }));
    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:7654', fetchImpl: fetch });
    const result = await surface.invoke({ tool: 'chat', args: { message: 'play it' } });

    expect(result.stdout).toMatch(/Done\./);
    expect(result.stdout).toMatch(/scene_get_tracks → ok/);
    expect(result.stdout).toMatch(/dsl_play → failed/);
  });

  it('marks iteration-limit responses as a failure', async () => {
    const { fetch } = stubFetch(() => ({
      status: 200,
      body: {
        text: 'Got partway there.',
        events: [],
        iterations: 12,
        iterationLimitHit: true,
      },
    }));
    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:7654', fetchImpl: fetch });
    const result = await surface.invoke({ tool: 'chat', args: { message: 'do too much' } });

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/iteration limit/);
    expect(result.stdout).toMatch(/Got partway/);
  });

  it('reports HTTP errors from the bridge with the response body', async () => {
    const { fetch } = stubFetch(() => ({
      status: 500,
      body: { error: 'Chat plugin not active' },
    }));
    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:7654', fetchImpl: fetch });
    const result = await surface.invoke({ tool: 'chat', args: { message: 'hi' } });

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(500);
    expect(result.stderr).toMatch(/HTTP 500/);
    expect(result.stderr).toMatch(/Chat plugin not active/);
  });

  it('returns a structured failure when fetch itself rejects', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:7654', fetchImpl });
    const result = await surface.invoke({ tool: 'chat', args: { message: 'hi' } });

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toMatch(/ECONNREFUSED/);
  });
});
