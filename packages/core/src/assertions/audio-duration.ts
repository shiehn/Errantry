import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { Matcher } from './index.js';

/**
 * audioDuration — assert the duration of an audio file using ffprobe.
 *   { path, expectedSeconds, toleranceSeconds? }
 */
export const audioDuration: Matcher = async (args, ctx) => {
  const rawPath = String(args.path ?? '');
  const expected = Number(args.expectedSeconds);
  const tolerance = Number(args.toleranceSeconds ?? 0.5);

  if (!rawPath || Number.isNaN(expected)) {
    return {
      matcher: 'audioDuration',
      passed: false,
      message: 'audioDuration requires `path` and numeric `expectedSeconds`.',
    };
  }
  const filePath = isAbsolute(rawPath) ? rawPath : resolve(ctx.cwd, rawPath);
  if (!existsSync(filePath)) {
    return {
      matcher: 'audioDuration',
      passed: false,
      message: `Audio file not found: ${filePath}`,
    };
  }

  const proc = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath],
    { encoding: 'utf8' },
  );
  if (proc.error || proc.status !== 0) {
    return {
      matcher: 'audioDuration',
      passed: false,
      message: `ffprobe failed: ${proc.stderr || proc.error?.message || 'unknown error'}`,
    };
  }
  const actual = Number(proc.stdout.trim());
  if (Number.isNaN(actual)) {
    return {
      matcher: 'audioDuration',
      passed: false,
      message: `ffprobe returned non-numeric duration: ${proc.stdout}`,
    };
  }

  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    return {
      matcher: 'audioDuration',
      passed: true,
      message: `audioDuration passed: ${actual.toFixed(3)}s (expected ${expected}s ± ${tolerance}s)`,
      details: { actual, expected, tolerance },
    };
  }
  return {
    matcher: 'audioDuration',
    passed: false,
    message: `audioDuration off by ${diff.toFixed(3)}s: ${actual.toFixed(3)}s vs expected ${expected}s ± ${tolerance}s`,
    details: { actual, expected, tolerance },
  };
};
