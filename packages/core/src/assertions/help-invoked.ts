import type { Matcher } from './index.js';

const HELP_PATTERNS = [
  /(?:^|\s)--help(?:\s|$|"|')/,
  /(?:^|\s)-h(?:\s|$|"|')/,
  /(?:^|\s)help(?:\s|$|"|')/i,
  /tool[_-]?search/i,
];

/**
 * helpInvoked — assert the agent looked at help/discovery at least once.
 * Heuristic: any bash command or tool args containing --help, -h, "help",
 * or "tool_search". The bar is intentionally low; this matcher is about
 * confirming the agent took *some* discovery step, not which one.
 */
export const helpInvoked: Matcher = async (_args, ctx) => {
  const hit = ctx.result.invocations.some((inv) => {
    const haystack = `${inv.call.tool} ${JSON.stringify(inv.call.args)}`;
    return HELP_PATTERNS.some((re) => re.test(haystack));
  });

  return hit
    ? { matcher: 'helpInvoked', passed: true, message: 'helpInvoked matched (agent used --help / tool_search)' }
    : {
        matcher: 'helpInvoked',
        passed: false,
        message: 'helpInvoked failed — agent never invoked --help, -h, or tool_search',
      };
};
