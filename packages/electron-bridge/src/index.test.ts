import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installErrantryBridge, type InstalledBridge } from './index.js';

let bridge: InstalledBridge;

beforeEach(async () => {
  bridge = await installErrantryBridge({
    port: 0, // ephemeral
    db: {
      prepare: (sql: string) => ({
        all: (..._args: unknown[]) => {
          if (sql.includes('FAIL')) throw new Error('forced db failure');
          return [{ id: 1, sql }];
        },
      }),
    },
    onAppConfig: async () => undefined,
    onFixtureMount: async (name) => ({ projectId: `proj-${name}`, projectPath: `/tmp/${name}` }),
    onReset: async () => undefined,
    smokeChecks: {
      'always-true': () => true,
      'always-false': () => false,
    },
  });
});

afterEach(async () => {
  await bridge.close();
});

const url = (path: string): string => `${bridge.url}${path}`;

describe('installErrantryBridge', () => {
  it('serves /errantry/health', async () => {
    const res = await fetch(url('/errantry/health'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('mounts a fixture', async () => {
    const res = await fetch(url('/errantry/fixture'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'blank-project' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      projectId: 'proj-blank-project',
      projectPath: '/tmp/blank-project',
    });
  });

  it('returns rows from a SELECT', async () => {
    const res = await fetch(url('/errantry/db/query'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: 'SELECT * FROM tracks', args: [] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: Array<{ id: number }> };
    expect(body.rows).toHaveLength(1);
  });

  it('rejects a DELETE statement with 400', async () => {
    const res = await fetch(url('/errantry/db/query'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: 'DELETE FROM tracks', args: [] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Banned|Only SELECT|allowed/);
  });

  it('reports smoke status as not-ready when any check fails', async () => {
    const res = await fetch(url('/errantry/smoke'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ready: boolean; checks: Record<string, boolean> };
    expect(body.ready).toBe(false);
    expect(body.checks['always-true']).toBe(true);
    expect(body.checks['always-false']).toBe(false);
  });

  it('returns 501 when no db is configured', async () => {
    const noDb = await installErrantryBridge({ port: 0 });
    const res = await fetch(`${noDb.url}/errantry/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: 'SELECT 1', args: [] }),
    });
    expect(res.status).toBe(501);
    await noDb.close();
  });
});
