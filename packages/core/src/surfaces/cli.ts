import { spawn } from 'node:child_process';
import type {
  Surface,
  SurfaceInvocation,
  SurfaceResult,
  SurfaceTool,
} from '../types.js';

export interface CliSurfaceOptions {
  /** Working directory the agent's bash commands run in. */
  cwd: string;
  /** Environment variables visible to the agent's bash. PATH is preserved. */
  env?: Record<string, string>;
  /** Hard timeout per command, in ms. Default 30000. */
  timeoutMs?: number;
  /** Hard cap on stdout/stderr bytes returned to the model. Default 65_536. */
  maxOutputBytes?: number;
  /** Optional shell binary; defaults to /bin/bash. */
  shell?: string;
}

const BASH_TOOL: SurfaceTool = {
  name: 'bash',
  description:
    'Run a bash command. The CLI binary you are testing is on PATH. Use it to discover help, run commands, and inspect errors. You have no other documentation.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'A single bash command line. Run one command per call.',
      },
    },
    required: ['command'],
    additionalProperties: false,
  },
};

/**
 * CLI surface — the agent's only tool is `bash`. Each invocation spawns a
 * fresh subprocess; no persistent shell state. That mirrors how a real
 * agent (Claude Code, Cursor) interacts with a CLI: each tool call is
 * independent.
 */
export class CliSurface implements Surface {
  readonly kind = 'cli' as const;

  constructor(private readonly options: CliSurfaceOptions) {}

  tools(): SurfaceTool[] {
    return [BASH_TOOL];
  }

  async invoke(call: SurfaceInvocation): Promise<SurfaceResult> {
    if (call.tool !== 'bash') {
      throw new Error(`CliSurface only supports the "bash" tool; got "${call.tool}"`);
    }
    const command = String(call.args.command ?? '');
    if (!command.trim()) {
      return {
        ok: false,
        stdout: '',
        stderr: 'Empty command.',
        exitCode: null,
        durationMs: 0,
      };
    }
    return this.runBash(command);
  }

  private runBash(command: string): Promise<SurfaceResult> {
    const startedAt = Date.now();
    const timeoutMs = this.options.timeoutMs ?? 30_000;
    const maxOutputBytes = this.options.maxOutputBytes ?? 65_536;
    const shell = this.options.shell ?? '/bin/bash';

    return new Promise((resolve) => {
      const child = spawn(shell, ['-lc', command], {
        cwd: this.options.cwd,
        env: { ...process.env, ...this.options.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 1000).unref();
      }, timeoutMs);
      timer.unref();

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes <= maxOutputBytes) stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes <= maxOutputBytes) stderr += chunk.toString('utf8');
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          stdout,
          stderr: `${stderr}\n[errantry] spawn error: ${err.message}`,
          exitCode: null,
          durationMs: Date.now() - startedAt,
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          stderr += `\n[errantry] command timed out after ${timeoutMs}ms`;
        }
        if (stdoutBytes > maxOutputBytes) {
          stdout += `\n[errantry] stdout truncated at ${maxOutputBytes} bytes (${stdoutBytes} total)`;
        }
        if (stderrBytes > maxOutputBytes) {
          stderr += `\n[errantry] stderr truncated at ${maxOutputBytes} bytes (${stderrBytes} total)`;
        }
        resolve({
          ok: code === 0 && !timedOut,
          stdout,
          stderr,
          exitCode: code,
          durationMs: Date.now() - startedAt,
        });
      });
    });
  }
}
