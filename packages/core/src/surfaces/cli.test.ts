import { describe, expect, it } from 'vitest';
import { CliSurface } from './cli.js';

describe('CliSurface', () => {
  const surface = new CliSurface({ cwd: process.cwd(), timeoutMs: 5_000 });

  it('exposes a single bash tool', () => {
    const tools = surface.tools();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('bash');
  });

  it('captures stdout and exit 0 for a successful command', async () => {
    const result = await surface.invoke({ tool: 'bash', args: { command: 'echo hello' } });
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/hello/);
  });

  it('captures stderr and non-zero exit', async () => {
    const result = await surface.invoke({
      tool: 'bash',
      args: { command: 'sh -c "echo oops 1>&2; exit 7"' },
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(7);
    expect(result.stderr).toMatch(/oops/);
  });

  it('rejects empty commands gracefully', async () => {
    const result = await surface.invoke({ tool: 'bash', args: { command: '   ' } });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/Empty/);
  });

  it('enforces timeout and reports it', async () => {
    const fastSurface = new CliSurface({ cwd: process.cwd(), timeoutMs: 200 });
    const result = await fastSurface.invoke({
      tool: 'bash',
      args: { command: 'sleep 5' },
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/timed out/);
  });

  it('rejects non-bash tools', async () => {
    await expect(
      surface.invoke({ tool: 'something-else', args: { command: 'echo' } }),
    ).rejects.toThrow(/only supports/);
  });
});
