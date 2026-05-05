import type { ComputedMetrics, TracedInvocation } from './types.js';

/**
 * Derive metrics from the trace of invocations.
 *
 * `errorsRecovered` heuristic: an error is "recovered" if any later
 * successful invocation in the same run exists. This is intentionally
 * coarse — phase 2 will refine it by correlating against the specific
 * `remediation.suggestedFix` that the failing invocation surfaced.
 *
 * `completedSubgoals` is also a placeholder until phase 2 introduces
 * structured goal-decomposition. For now it equals the count of distinct
 * successful invocations, capped at 1 per scenario (so frictionScore is
 * meaningful even on simple scenarios).
 */
export function computeMetrics(invocations: TracedInvocation[]): ComputedMetrics {
  const turns = invocations.reduce((max, i) => Math.max(max, i.turn), 0);
  const toolCalls = invocations.length;

  const helpInvocations = invocations.filter((i) => {
    const hay = `${i.call.tool} ${JSON.stringify(i.call.args)}`;
    return (
      /(?:^|\s|")--help(?:\s|$|"|')/.test(hay) ||
      /(?:^|\s|")-h(?:\s|$|"|')/.test(hay) ||
      /(?:^|\s|")help(?:\s|$|"|')/i.test(hay) ||
      /tool[_-]?search/i.test(hay)
    );
  }).length;

  const errorsEncountered = invocations.filter((i) => !i.result.ok).length;
  const successfulCount = invocations.filter((i) => i.result.ok).length;
  const errorsRecovered = errorsEncountered > 0 && successfulCount > 0 ? errorsEncountered : 0;
  const completedSubgoals = Math.min(successfulCount, Math.max(1, successfulCount));
  const frictionScore =
    completedSubgoals === 0
      ? errorsEncountered === 0
        ? 0
        : errorsEncountered
      : Math.max(0, errorsEncountered - errorsRecovered) / completedSubgoals;

  return {
    turns,
    toolCalls,
    helpInvocations,
    errorsEncountered,
    errorsRecovered,
    frictionScore,
    completedSubgoals,
  };
}
