import type { Matcher } from './index.js';

/**
 * budget — assert the run respected hard caps on turns / errors.
 *   { turns: 6 }
 *   { errors: 2 }
 *   { frictionScore: 0.3 }
 * All fields optional; only present fields are checked.
 */
export const budget: Matcher = async (args, ctx) => {
  const failures: string[] = [];
  const m = ctx.result.metrics;

  if (typeof args.turns === 'number' && m.turns > args.turns) {
    failures.push(`turns ${m.turns} > budget ${args.turns}`);
  }
  if (typeof args.errors === 'number' && m.errorsEncountered > args.errors) {
    failures.push(`errors ${m.errorsEncountered} > budget ${args.errors}`);
  }
  if (typeof args.frictionScore === 'number' && m.frictionScore > args.frictionScore) {
    failures.push(`frictionScore ${m.frictionScore.toFixed(2)} > budget ${args.frictionScore}`);
  }

  return failures.length === 0
    ? {
        matcher: 'budget',
        passed: true,
        message: `budget respected (turns=${m.turns}, errors=${m.errorsEncountered}, friction=${m.frictionScore.toFixed(2)})`,
      }
    : {
        matcher: 'budget',
        passed: false,
        message: `budget exceeded: ${failures.join('; ')}`,
        details: { metrics: m },
      };
};
