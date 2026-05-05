import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import { validateReadOnlySql } from './db-query.js';
import type { ErrantryBridgeOptions, InstalledBridge } from './types.js';

export type { ErrantryBridgeOptions, InstalledBridge, DbHandle, BridgeFixtureMountResult } from './types.js';

const DEFAULT_PORT = 7654;
const DEFAULT_HOST = '127.0.0.1';

/**
 * Install the Errantry test bridge into the host app's main process.
 *
 * Boots a small Express server with the privileged endpoints Errantry
 * scenarios need (config, fixture mount, DB query, reset, smoke). The
 * bridge is intentionally only useful in test mode — gate the install
 * call behind `process.env.ERRANTRY_TEST === '1'` in the host app.
 */
export async function installErrantryBridge(
  options: ErrantryBridgeOptions = {},
): Promise<InstalledBridge> {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  registerHealth(app, options);
  registerSmoke(app, options);
  registerAppConfig(app, options);
  registerFixture(app, options);
  registerDbQuery(app, options);
  registerReset(app, options);

  const server = await listen(app, port, host);
  const address = server.address();
  const boundPort = address && typeof address === 'object' ? address.port : port;
  const url = `http://${host}:${boundPort}`;

  return {
    port: boundPort,
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function registerHealth(app: Express, opts: ErrantryBridgeOptions): void {
  app.get('/errantry/health', (_req: Request, res: Response) => {
    audit(opts, 'GET', '/errantry/health', true);
    res.json({ ok: true });
  });
}

function registerSmoke(app: Express, opts: ErrantryBridgeOptions): void {
  app.get('/errantry/smoke', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const checks: Record<string, boolean> = {};
      for (const [name, check] of Object.entries(opts.smokeChecks ?? {})) {
        checks[name] = await check();
      }
      const ready = Object.values(checks).every(Boolean);
      audit(opts, 'GET', '/errantry/smoke', true);
      res.json({ ready, checks });
    } catch (err) {
      next(err);
    }
  });
}

function registerAppConfig(app: Express, opts: ErrantryBridgeOptions): void {
  app.post('/errantry/app-config', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!opts.onAppConfig) {
        audit(opts, 'POST', '/errantry/app-config', false);
        res.status(501).json({ error: 'onAppConfig handler not registered.' });
        return;
      }
      await opts.onAppConfig(req.body ?? {});
      audit(opts, 'POST', '/errantry/app-config', true);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });
}

function registerFixture(app: Express, opts: ErrantryBridgeOptions): void {
  app.post('/errantry/fixture', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!opts.onFixtureMount) {
        audit(opts, 'POST', '/errantry/fixture', false);
        res.status(501).json({ error: 'onFixtureMount handler not registered.' });
        return;
      }
      const name = String(req.body?.name ?? '');
      if (!name) {
        res.status(400).json({ error: 'Body must include `name` (the fixture name).' });
        return;
      }
      const result = await opts.onFixtureMount(name);
      audit(opts, 'POST', '/errantry/fixture', true);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
}

function registerDbQuery(app: Express, opts: ErrantryBridgeOptions): void {
  app.post('/errantry/db/query', (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!opts.db) {
        audit(opts, 'POST', '/errantry/db/query', false);
        res.status(501).json({ error: 'No `db` handle registered with installErrantryBridge.' });
        return;
      }
      const sql = String(req.body?.sql ?? '');
      const args = Array.isArray(req.body?.args) ? (req.body.args as unknown[]) : [];

      const validation = validateReadOnlySql(sql);
      if (!validation.ok) {
        audit(opts, 'POST', '/errantry/db/query', false);
        res.status(400).json({ error: `SQL rejected: ${validation.reason}` });
        return;
      }

      const stmt = opts.db.prepare(sql);
      const rows = stmt.all(...args);
      audit(opts, 'POST', '/errantry/db/query', true);
      res.json({ rows });
    } catch (err) {
      next(err);
    }
  });
}

function registerReset(app: Express, opts: ErrantryBridgeOptions): void {
  app.post('/errantry/reset', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (opts.onReset) await opts.onReset();
      audit(opts, 'POST', '/errantry/reset', true);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });
}

function audit(opts: ErrantryBridgeOptions, method: string, path: string, ok: boolean): void {
  opts.onRequest?.({ method, path, ok });
}

function listen(app: Express, port: number, host: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.once('error', reject);
  });
}
