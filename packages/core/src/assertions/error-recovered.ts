import type { Matcher } from './index.js';

/**
 * errorRecovered — passes if the agent encountered at least one error and
 * subsequently produced a successful invocation, OR if it encountered no
 * errors at all. Fails only when the agent ran into errors and never
 * recovered.
 *
 * Phase 2 will tighten this by correlating against `OperationResult.remediation`
 * to verify the agent followed the suggested fix specifically. For now it's
 * a coarse "did they bounce back" signal.
 */
export const errorRecovered: Matcher = async (_args, ctx) => {
  const m = ctx.result.metrics;
  if (m.errorsEncountered === 0) {
    return {
      matcher: 'errorRecovered',
      passed: true,
      message: 'errorRecovered passed (no errors encountered)',
    };
  }
  if (m.errorsRecovered > 0) {
    return {
      matcher: 'errorRecovered',
      passed: true,
      message: `errorRecovered passed (${m.errorsRecovered}/${m.errorsEncountered} errors recovered)`,
    };
  }
  return {
    matcher: 'errorRecovered',
    passed: false,
    message: `errorRecovered failed: ${m.errorsEncountered} errors and no recovery`,
  };
};
