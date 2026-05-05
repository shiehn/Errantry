/**
 * The minimal duck-typed surface @errantry/electron-bridge needs from the
 * host app's database. Compatible with better-sqlite3 (`Database.prepare`)
 * but not coupled to it — anything that returns `{ all(...args): rows }`
 * works.
 */
export interface DbHandle {
  prepare(sql: string): {
    all(...args: unknown[]): unknown[];
  };
}

export interface BridgeFixtureMountResult {
  projectId: string;
  projectPath: string;
}

export interface ErrantryBridgeOptions {
  /** Port to listen on. Defaults to 7654 (matches sas-assistant's simple-test-server). */
  port?: number;

  /** Bind host. Defaults to 127.0.0.1 — never bind a test surface to 0.0.0.0. */
  host?: string;

  /** Read-only database handle. Required if scenarios use `dbQuery` matchers. */
  db?: DbHandle;

  /**
   * Apply scenario-supplied app config (provider keys, audio routing, etc.).
   * Called once per scenario before the agent loop starts.
   */
  onAppConfig?: (config: Record<string, unknown>) => void | Promise<void>;

  /**
   * Mount a named fixture (e.g. "blank-project") and return its identifier.
   * Use this to give scenarios a known starting state without checking
   * fixtures into the test runner's repo.
   */
  onFixtureMount?: (name: string) => BridgeFixtureMountResult | Promise<BridgeFixtureMountResult>;

  /** Reset ephemeral state between scenarios (e.g. unbind project, clear caches). */
  onReset?: () => void | Promise<void>;

  /**
   * Custom smoke-check map. Returned as part of `/errantry/smoke`. Use this
   * to gate scenario execution on app subsystem readiness.
   */
  smokeChecks?: Record<string, () => boolean | Promise<boolean>>;

  /** Optional audit logger — called for every privileged request. */
  onRequest?: (info: { method: string; path: string; ok: boolean }) => void;
}

export interface InstalledBridge {
  port: number;
  url: string;
  close(): Promise<void>;
}
