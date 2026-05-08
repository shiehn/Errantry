import type { Matcher } from './index.js';

/**
 * toolCalled — assert the agent invoked a CLI command (or MCP tool) matching
 * a substring or regex against the bash command (or tool name).
 *   { contains: "scene_create" }
 *   { matches: "scene_(create|new)" }
 *   { tool: "bash" }                    // any bash invocation
 *
 * Designed to be lenient: agents will phrase commands many ways, and the
 * goal of the matcher is to detect whether the agent eventually found the
 * right action — not to constrain how it phrases the call.
 */
export const toolCalled: Matcher = async (args, ctx) => {
  const contains = typeof args.contains === 'string' ? args.contains : null;
  const matches =
    typeof args.matches === 'string' ? new RegExp(args.matches) : null;
  const tool = typeof args.tool === 'string' ? args.tool : null;

  if (!contains && !matches && !tool) {
    return {
      matcher: 'toolCalled',
      passed: false,
      message: 'toolCalled requires at least one of: `contains`, `matches`, `tool`.',
    };
  }

  // Setup-only invocations are tagged turn=0 (preCommands run before the
  // agent loop). Match strictly against the agent's calls (turn >= 1) so
  // preCommand vocabulary cannot satisfy the assertion vacuously.
  const agentInvocations = ctx.result.invocations.filter((inv) => inv.turn > 0);
  const matched = agentInvocations.some((inv) => {
    if (tool && inv.call.tool !== tool) return false;
    const haystack = `${inv.call.tool} ${JSON.stringify(inv.call.args)}`;
    if (contains && !haystack.includes(contains)) return false;
    if (matches && !matches.test(haystack)) return false;
    return true;
  });

  return matched
    ? { matcher: 'toolCalled', passed: true, message: `toolCalled matched` }
    : {
        matcher: 'toolCalled',
        passed: false,
        message: `toolCalled did not match — agent never invoked a call that matches ${formatCriteria({ contains, matches: args.matches as string | undefined, tool })}`,
        details: {
          invocations: agentInvocations.map((i) => ({ turn: i.turn, tool: i.call.tool, args: i.call.args })),
        },
      };
};

function formatCriteria(c: { contains: string | null; matches?: string; tool: string | null }): string {
  const parts: string[] = [];
  if (c.tool) parts.push(`tool=${c.tool}`);
  if (c.contains) parts.push(`contains=${JSON.stringify(c.contains)}`);
  if (c.matches) parts.push(`matches=/${c.matches}/`);
  return parts.join(' ');
}
