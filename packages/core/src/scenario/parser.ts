import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { Scenario, ScenarioAssertion } from '../types.js';

/**
 * Each entry in `assertions:` is a single-key object whose key is the matcher
 * name and whose value is the matcher args. We accept an empty value (`null`)
 * to mean "no args", which lets terse forms like `- helpInvoked: null` work.
 */
const AssertionEntrySchema = z
  .record(z.string(), z.unknown())
  .refine((obj) => Object.keys(obj).length === 1, {
    message: 'Each assertion must be a single-key object: { matcherName: args }',
  });

const ScenarioSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  surface: z.enum(['cli', 'mcp']),
  setup: z
    .object({
      fixture: z.string().optional(),
      bind: z.object({ project: z.string().optional() }).optional(),
      appConfig: z.record(z.string(), z.unknown()).optional(),
      smokeWaitFor: z.array(z.string()).optional(),
    })
    .optional(),
  agent: z.object({
    provider: z.enum(['openai', 'anthropic']).default('openai'),
    model: z.string().default('gpt-4o-mini'),
    max_turns: z.number().int().positive().default(12),
    system: z.string().optional(),
  }),
  goal: z.string().min(1),
  assertions: z.array(AssertionEntrySchema).min(1),
  metrics: z
    .object({
      budget: z
        .object({
          turns: z.object({ max: z.number() }).optional(),
          errors_encountered: z.object({ max: z.number() }).optional(),
          friction_score: z.object({ max: z.number() }).optional(),
        })
        .optional(),
    })
    .optional(),
});

type ParsedScenarioRaw = z.infer<typeof ScenarioSchema>;

function normalizeAssertions(entries: ParsedScenarioRaw['assertions']): ScenarioAssertion[] {
  return entries.map((entry) => {
    const [matcher, rawArgs] = Object.entries(entry)[0]!;
    const args =
      rawArgs === null || rawArgs === undefined
        ? {}
        : typeof rawArgs === 'object' && !Array.isArray(rawArgs)
          ? (rawArgs as Record<string, unknown>)
          : { value: rawArgs };
    return { matcher, args };
  });
}

export function parseScenario(input: unknown): Scenario {
  const parsed = ScenarioSchema.parse(input);
  const scenario: Scenario = {
    name: parsed.name,
    surface: parsed.surface,
    agent: {
      provider: parsed.agent.provider,
      model: parsed.agent.model,
      maxTurns: parsed.agent.max_turns,
    },
    goal: parsed.goal,
    assertions: normalizeAssertions(parsed.assertions),
  };
  if (parsed.description !== undefined) scenario.description = parsed.description;
  if (parsed.agent.system !== undefined) scenario.agent.system = parsed.agent.system;
  if (parsed.setup) {
    scenario.setup = {
      ...(parsed.setup.fixture !== undefined && { fixture: parsed.setup.fixture }),
      ...(parsed.setup.bind && { bind: parsed.setup.bind }),
      ...(parsed.setup.appConfig && { appConfig: parsed.setup.appConfig }),
      ...(parsed.setup.smokeWaitFor && { smokeWaitFor: parsed.setup.smokeWaitFor }),
    };
  }
  if (parsed.metrics) {
    scenario.metrics = parsed.metrics;
  }
  return scenario;
}

export function parseScenarioFile(path: string): Scenario {
  const raw = readFileSync(path, 'utf8');
  const parsed = parseYaml(raw);
  try {
    return parseScenario(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid scenario file ${path}:\n${issues}`);
    }
    throw err;
  }
}
