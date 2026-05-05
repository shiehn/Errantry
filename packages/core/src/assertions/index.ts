import type { AppBridge, AssertionOutcome, ScenarioAssertion, ScenarioResult } from '../types.js';
import { dbQuery } from './db-query.js';
import { fileMatcher } from './file.js';
import { audioDuration } from './audio-duration.js';
import { toolCalled } from './tool-called.js';
import { helpInvoked } from './help-invoked.js';
import { budget } from './budget.js';
import { errorRecovered } from './error-recovered.js';

export type Matcher = (
  args: Record<string, unknown>,
  ctx: MatcherContext,
) => Promise<AssertionOutcome>;

export interface MatcherContext {
  result: ScenarioResult;
  bridge: AppBridge;
  /** Working directory the agent ran in. File / audio matchers resolve relative paths against this. */
  cwd: string;
}

const REGISTRY: Record<string, Matcher> = {
  dbQuery,
  file: fileMatcher,
  audioDuration,
  toolCalled,
  helpInvoked,
  budget,
  errorRecovered,
};

export function getMatcher(name: string): Matcher | undefined {
  return REGISTRY[name];
}

export async function runAssertions(
  assertions: ScenarioAssertion[],
  ctx: MatcherContext,
): Promise<AssertionOutcome[]> {
  const outcomes: AssertionOutcome[] = [];
  for (const assertion of assertions) {
    const matcher = REGISTRY[assertion.matcher];
    if (!matcher) {
      outcomes.push({
        matcher: assertion.matcher,
        passed: false,
        message: `Unknown matcher "${assertion.matcher}". Known matchers: ${Object.keys(REGISTRY).join(', ')}.`,
      });
      continue;
    }
    try {
      outcomes.push(await matcher(assertion.args, ctx));
    } catch (err) {
      outcomes.push({
        matcher: assertion.matcher,
        passed: false,
        message: `Matcher threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return outcomes;
}

export {
  dbQuery,
  fileMatcher as file,
  audioDuration,
  toolCalled,
  helpInvoked,
  budget,
  errorRecovered,
};
