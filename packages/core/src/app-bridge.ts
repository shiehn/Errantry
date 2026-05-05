import type { AppBridge } from './types.js';

/**
 * HTTP client for the @errantry/electron-bridge endpoints. Lives in core so
 * any package (cli, playwright fixtures, jest adapter) can use it without
 * pulling Playwright in.
 */
export class HttpAppBridge implements AppBridge {
  constructor(private readonly baseUrl: string) {}

  async health(): Promise<{ ok: boolean }> {
    return this.get<{ ok: boolean }>('/errantry/health');
  }

  async applyConfig(config: Record<string, unknown>): Promise<void> {
    await this.post('/errantry/app-config', config);
  }

  async mountFixture(name: string): Promise<{ projectId: string; projectPath: string }> {
    return this.post<{ projectId: string; projectPath: string }>('/errantry/fixture', {
      name,
    });
  }

  async reset(): Promise<void> {
    await this.post('/errantry/reset', {});
  }

  async dbQuery(sql: string, args: unknown[] = []): Promise<{ rows: Record<string, unknown>[] }> {
    return this.post<{ rows: Record<string, unknown>[] }>('/errantry/db/query', {
      sql,
      args,
    });
  }

  async smoke(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
    return this.get<{ ready: boolean; checks: Record<string, boolean> }>('/errantry/smoke');
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

/**
 * No-op bridge for scenarios that don't need privileged backend access
 * (pure-CLI testing, smoke runs against a dummy CLI). Calls that require
 * state setup or DB queries throw a clear error instead of silently passing.
 */
export class NullAppBridge implements AppBridge {
  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  async applyConfig(): Promise<void> {
    throw new Error('applyConfig is not supported in trace-only mode (no AppBridge configured).');
  }

  async mountFixture(): Promise<{ projectId: string; projectPath: string }> {
    throw new Error('mountFixture is not supported in trace-only mode (no AppBridge configured).');
  }

  async reset(): Promise<void> {
    // No-op.
  }

  async dbQuery(): Promise<{ rows: Record<string, unknown>[] }> {
    throw new Error('dbQuery is not supported in trace-only mode (no AppBridge configured).');
  }

  async smoke(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
    return { ready: true, checks: {} };
  }
}
