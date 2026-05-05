import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { Matcher } from './index.js';

/**
 * file matcher:
 *   - { path, toExist: true }
 *   - { path, toContain: "substring" }
 *   - { path, toMatchRegex: "pattern" }
 */
export const fileMatcher: Matcher = async (args, ctx) => {
  const rawPath = String(args.path ?? '');
  if (!rawPath) {
    return { matcher: 'file', passed: false, message: 'file matcher requires `path`.' };
  }
  const filePath = isAbsolute(rawPath) ? rawPath : resolve(ctx.cwd, rawPath);

  const failures: string[] = [];
  const exists = existsSync(filePath);

  if (args.toExist === true && !exists) {
    failures.push(`expected ${filePath} to exist`);
  }
  if (args.toExist === false && exists) {
    failures.push(`expected ${filePath} to NOT exist`);
  }

  if ((args.toContain || args.toMatchRegex) && !exists) {
    failures.push(`cannot inspect contents — ${filePath} does not exist`);
  } else if (exists) {
    const contents = readFileSync(filePath, 'utf8');
    if (typeof args.toContain === 'string' && !contents.includes(args.toContain)) {
      failures.push(`expected ${filePath} to contain "${args.toContain}"`);
    }
    if (typeof args.toMatchRegex === 'string') {
      const re = new RegExp(args.toMatchRegex);
      if (!re.test(contents)) {
        failures.push(`expected ${filePath} to match /${args.toMatchRegex}/`);
      }
    }
  }

  return failures.length === 0
    ? { matcher: 'file', passed: true, message: `file passed (${filePath})` }
    : { matcher: 'file', passed: false, message: failures.join('; ') };
};
