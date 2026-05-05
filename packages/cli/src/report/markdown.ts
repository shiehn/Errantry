import type { ScenarioResult } from '@errantry/core';
import kleur from 'kleur';

export function renderMarkdown(result: ScenarioResult): string {
  const lines: string[] = [];
  const status = result.passed ? kleur.green('PASS') : kleur.red('FAIL');
  const durationMs = result.finishedAt - result.startedAt;

  lines.push(`# ${result.scenario.name} — ${status}`);
  if (result.scenario.description) {
    lines.push('', kleur.gray(result.scenario.description));
  }
  lines.push('', `**Goal:** ${result.scenario.goal}`);
  lines.push(
    '',
    `**Finish:** \`${result.finishReason}\`  •  **Duration:** ${(durationMs / 1000).toFixed(1)}s  •  **Surface:** \`${result.scenario.surface}\``,
  );

  lines.push('', '## Metrics');
  const m = result.metrics;
  lines.push(
    '',
    `| metric | value |`,
    `| --- | --- |`,
    `| turns | ${m.turns} |`,
    `| tool calls | ${m.toolCalls} |`,
    `| help invocations | ${m.helpInvocations} |`,
    `| errors encountered | ${m.errorsEncountered} |`,
    `| errors recovered | ${m.errorsRecovered} |`,
    `| friction score | ${m.frictionScore.toFixed(2)} |`,
  );

  lines.push('', '## Assertions');
  for (const a of result.assertions) {
    const tag = a.passed ? kleur.green('✓') : kleur.red('✗');
    lines.push(`- ${tag} **${a.matcher}** — ${a.message}`);
  }

  lines.push('', '## Trace (last 10 calls)');
  const recent = result.invocations.slice(-10);
  if (recent.length === 0) {
    lines.push('', kleur.gray('(no tool calls)'));
  } else {
    for (const inv of recent) {
      const tag = inv.result.ok ? kleur.green('✓') : kleur.red('✗');
      const cmd = String(inv.call.args.command ?? JSON.stringify(inv.call.args));
      const truncated = cmd.length > 80 ? `${cmd.slice(0, 77)}...` : cmd;
      lines.push(
        `- t${inv.turn} ${tag} \`${truncated}\` (exit=${inv.result.exitCode ?? 'null'}, ${inv.result.durationMs}ms)`,
      );
    }
  }

  return lines.join('\n');
}
