import type { AppBridge, ScenarioResult } from '@errantry/core';
import type { Expect, ExpectMatcherState } from '@playwright/test';

interface MatcherResult {
  pass: boolean;
  message: () => string;
  name?: string;
  expected?: unknown;
  actual?: unknown;
}

/**
 * Custom matchers, exposed via `expect.extend(...)`. They mirror the YAML
 * matchers in @errantry/core but live here because they need to integrate
 * with playwright's `expect` (negation support, locator-style chaining).
 */
export function applyMatchers<T extends Expect<unknown>>(base: T): T {
  base.extend({
    toolCalled(this: ExpectMatcherState, received: ScenarioResult, args: ToolCalledArgs): MatcherResult {
      const matched = received.invocations.some((inv) => {
        if (args.tool && inv.call.tool !== args.tool) return false;
        const haystack = `${inv.call.tool} ${JSON.stringify(inv.call.args)}`;
        if (args.contains && !haystack.includes(args.contains)) return false;
        if (args.matches && !new RegExp(args.matches).test(haystack)) return false;
        return true;
      });
      return {
        pass: matched,
        message: () =>
          matched
            ? `expected agent NOT to make a call matching ${formatToolArgs(args)}`
            : `expected agent to make a call matching ${formatToolArgs(args)} — none of the ${received.invocations.length} invocations matched`,
        name: 'toolCalled',
      };
    },

    helpInvoked(this: ExpectMatcherState, received: ScenarioResult): MatcherResult {
      const passed = received.metrics.helpInvocations > 0;
      return {
        pass: passed,
        message: () =>
          passed
            ? `expected agent NOT to invoke --help / tool_search (it did)`
            : `expected agent to invoke --help, -h, or tool_search at least once`,
        name: 'helpInvoked',
      };
    },

    budgetRespected(
      this: ExpectMatcherState,
      received: ScenarioResult,
      budget: BudgetArgs,
    ): MatcherResult {
      const m = received.metrics;
      const failures: string[] = [];
      if (typeof budget.turns === 'number' && m.turns > budget.turns) {
        failures.push(`turns ${m.turns} > ${budget.turns}`);
      }
      if (typeof budget.errors === 'number' && m.errorsEncountered > budget.errors) {
        failures.push(`errors ${m.errorsEncountered} > ${budget.errors}`);
      }
      if (typeof budget.frictionScore === 'number' && m.frictionScore > budget.frictionScore) {
        failures.push(`friction ${m.frictionScore.toFixed(2)} > ${budget.frictionScore}`);
      }
      const passed = failures.length === 0;
      return {
        pass: passed,
        message: () =>
          passed
            ? `expected scenario to exceed budget but it stayed within (${describeMetrics(m)})`
            : `budget exceeded: ${failures.join('; ')}`,
        name: 'budgetRespected',
      };
    },

    async toHaveRow(
      this: ExpectMatcherState,
      received: AppBridge,
      sql: string,
      args: unknown[] = [],
    ): Promise<MatcherResult> {
      const { rows } = await received.dbQuery(sql, args);
      const passed = rows.length > 0;
      return {
        pass: passed,
        message: () =>
          passed
            ? `expected SQL to return zero rows but got ${rows.length}: ${sql}`
            : `expected SQL to return at least one row, got 0: ${sql}`,
        name: 'toHaveRow',
      };
    },

    async toHaveRowCount(
      this: ExpectMatcherState,
      received: AppBridge,
      sql: string,
      expected: number,
      args: unknown[] = [],
    ): Promise<MatcherResult> {
      const { rows } = await received.dbQuery(sql, args);
      const passed = rows.length === expected;
      return {
        pass: passed,
        message: () =>
          passed
            ? `expected row count to differ from ${expected} (got ${rows.length})`
            : `expected ${expected} rows, got ${rows.length}: ${sql}`,
        name: 'toHaveRowCount',
      };
    },
  });

  return base;
}

interface ToolCalledArgs {
  tool?: string;
  contains?: string;
  matches?: string;
}

interface BudgetArgs {
  turns?: number;
  errors?: number;
  frictionScore?: number;
}

function formatToolArgs(args: ToolCalledArgs): string {
  const parts: string[] = [];
  if (args.tool) parts.push(`tool=${args.tool}`);
  if (args.contains) parts.push(`contains=${JSON.stringify(args.contains)}`);
  if (args.matches) parts.push(`matches=/${args.matches}/`);
  return parts.length === 0 ? '(no criteria)' : parts.join(' ');
}

function describeMetrics(m: ScenarioResult['metrics']): string {
  return `turns=${m.turns}, errors=${m.errorsEncountered}, friction=${m.frictionScore.toFixed(2)}`;
}
