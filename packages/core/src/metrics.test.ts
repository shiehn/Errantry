import { describe, expect, it } from 'vitest';
import { computeMetrics } from './metrics.js';
import type { TracedInvocation } from './types.js';

const inv = (turn: number, ok: boolean, command = 'echo'): TracedInvocation => ({
  turn,
  call: { tool: 'bash', args: { command } },
  result: { ok, stdout: '', stderr: '', exitCode: ok ? 0 : 1, durationMs: 1 },
  startedAt: 0,
});

describe('computeMetrics', () => {
  it('returns zero metrics for an empty trace', () => {
    const m = computeMetrics([]);
    expect(m.turns).toBe(0);
    expect(m.toolCalls).toBe(0);
    expect(m.errorsEncountered).toBe(0);
    expect(m.frictionScore).toBe(0);
  });

  it('counts help invocations from --help and tool_search', () => {
    const m = computeMetrics([
      inv(1, true, 'sas --help'),
      inv(2, true, 'sas tool_search scene'),
      inv(3, true, 'sas scene create Verse'),
    ]);
    expect(m.helpInvocations).toBe(2);
    expect(m.toolCalls).toBe(3);
  });

  it('records errors and frictionScore drops to 0 on full recovery', () => {
    const m = computeMetrics([
      inv(1, false, 'sas scene wrong-cmd'),
      inv(2, true, 'sas scene create Verse'),
    ]);
    expect(m.errorsEncountered).toBe(1);
    expect(m.errorsRecovered).toBe(1);
    expect(m.frictionScore).toBe(0);
  });

  it('frictionScore stays positive when no recovery', () => {
    const m = computeMetrics([inv(1, false), inv(2, false)]);
    expect(m.errorsEncountered).toBe(2);
    expect(m.errorsRecovered).toBe(0);
    expect(m.frictionScore).toBeGreaterThan(0);
  });
});
