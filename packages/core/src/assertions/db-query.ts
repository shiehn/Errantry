import type { Matcher } from './index.js';

/**
 * dbQuery — assert on rows returned by a SQL query against the app under test.
 * Supports two assertion shapes today:
 *   - { sql, args, toHaveRows: number }       — exact row count
 *   - { sql, args, toHaveAtLeast: number }    — minimum row count
 *   - { sql, args, toMatch: object }          — first row's columns match (subset)
 * Multiple shapes can coexist on the same matcher (all must pass).
 */
export const dbQuery: Matcher = async (args, ctx) => {
  const sql = String(args.sql ?? '');
  const queryArgs = Array.isArray(args.args) ? (args.args as unknown[]) : [];
  if (!sql) {
    return {
      matcher: 'dbQuery',
      passed: false,
      message: 'dbQuery requires `sql` field.',
    };
  }

  const { rows } = await ctx.bridge.dbQuery(sql, queryArgs);
  const failures: string[] = [];

  if (typeof args.toHaveRows === 'number') {
    if (rows.length !== args.toHaveRows) {
      failures.push(`expected exactly ${args.toHaveRows} rows, got ${rows.length}`);
    }
  }
  if (typeof args.toHaveAtLeast === 'number') {
    if (rows.length < args.toHaveAtLeast) {
      failures.push(`expected at least ${args.toHaveAtLeast} rows, got ${rows.length}`);
    }
  }
  if (args.toMatch && typeof args.toMatch === 'object') {
    const expected = args.toMatch as Record<string, unknown>;
    const first = rows[0];
    if (!first) {
      failures.push(`expected at least one row to match toMatch=${JSON.stringify(expected)}, got 0`);
    } else {
      for (const [k, v] of Object.entries(expected)) {
        if (first[k] !== v) {
          failures.push(`row[0].${k} = ${JSON.stringify(first[k])}, expected ${JSON.stringify(v)}`);
        }
      }
    }
  }

  if (failures.length === 0) {
    return {
      matcher: 'dbQuery',
      passed: true,
      message: `dbQuery passed (${rows.length} rows)`,
      details: { rowCount: rows.length },
    };
  }
  return {
    matcher: 'dbQuery',
    passed: false,
    message: `dbQuery failed: ${failures.join('; ')}`,
    details: { rowCount: rows.length, sample: rows.slice(0, 3) },
  };
};
