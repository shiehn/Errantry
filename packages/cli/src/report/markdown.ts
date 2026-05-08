import type { ScenarioResult } from '@errantry/core';
import kleur from 'kleur';

interface RenderOptions {
  /** Dump stdout/stderr for every invocation, not just failures. */
  showTrace?: boolean;
  /** Max lines of stdout/stderr to print per invocation. */
  ioLineLimit?: number;
}

export function renderMarkdown(result: ScenarioResult, options: RenderOptions = {}): string {
  const { showTrace = false, ioLineLimit = 30 } = options;
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
      const shouldDumpIO = showTrace || !inv.result.ok;
      if (shouldDumpIO) {
        const stdoutSnippet = tailSnippet(inv.result.stdout, ioLineLimit);
        const stderrSnippet = tailSnippet(inv.result.stderr, ioLineLimit);
        if (stdoutSnippet) {
          lines.push('  ```stdout', stdoutSnippet, '  ```');
        }
        if (stderrSnippet) {
          lines.push('  ```stderr', stderrSnippet, '  ```');
        }
        if (!stdoutSnippet && !stderrSnippet) {
          lines.push('  ' + kleur.gray('(no stdout / stderr captured)'));
        }
      }
    }
  }

  return lines.join('\n');
}

function tailSnippet(text: string | undefined, lineLimit: number): string {
  if (!text) return '';
  const trimmed = text.replace(/\s+$/, '');
  if (!trimmed) return '';
  const allLines = trimmed.split(/\r?\n/);
  const tail = allLines.slice(-lineLimit);
  const omitted = allLines.length - tail.length;
  const prefix = omitted > 0 ? [`  … (${omitted} earlier lines omitted)`] : [];
  return [...prefix, ...tail.map((l) => '  ' + l)].join('\n');
}
