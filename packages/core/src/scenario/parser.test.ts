import { describe, expect, it } from 'vitest';
import { parseScenario } from './parser.js';

describe('parseScenario', () => {
  it('accepts a minimal valid scenario', () => {
    const scenario = parseScenario({
      name: 'create-scene',
      surface: 'cli',
      agent: {},
      goal: 'Create a scene called Verse.',
      assertions: [{ helpInvoked: null }],
    });
    expect(scenario.name).toBe('create-scene');
    expect(scenario.surface).toBe('cli');
    expect(scenario.agent.provider).toBe('openai');
    expect(scenario.agent.model).toBe('gpt-4o-mini');
    expect(scenario.agent.maxTurns).toBe(12);
    expect(scenario.assertions).toEqual([{ matcher: 'helpInvoked', args: {} }]);
  });

  it('normalizes assertion entries with object args', () => {
    const scenario = parseScenario({
      name: 's',
      surface: 'cli',
      agent: {},
      goal: 'g',
      assertions: [{ dbQuery: { sql: 'SELECT 1', toHaveRows: 1 } }],
    });
    expect(scenario.assertions[0]).toEqual({
      matcher: 'dbQuery',
      args: { sql: 'SELECT 1', toHaveRows: 1 },
    });
  });

  it('rejects scenarios without a goal', () => {
    expect(() =>
      parseScenario({
        name: 's',
        surface: 'cli',
        agent: {},
        assertions: [{ x: null }],
      }),
    ).toThrow();
  });

  it('rejects assertions arrays with multi-key entries', () => {
    expect(() =>
      parseScenario({
        name: 's',
        surface: 'cli',
        agent: {},
        goal: 'g',
        assertions: [{ a: 1, b: 2 }],
      }),
    ).toThrow(/single-key/);
  });

  it('accepts chat as a surface kind', () => {
    const scenario = parseScenario({
      name: 'create-scene-via-chat',
      surface: 'chat',
      agent: {},
      goal: 'Create a scene called Verse.',
      assertions: [{ toolCalled: { contains: 'chat' } }],
    });
    expect(scenario.surface).toBe('chat');
  });

  it('preserves description and system prompt when provided', () => {
    const scenario = parseScenario({
      name: 's',
      description: 'd',
      surface: 'cli',
      agent: { system: 'you are a tester' },
      goal: 'g',
      assertions: [{ helpInvoked: null }],
    });
    expect(scenario.description).toBe('d');
    expect(scenario.agent.system).toBe('you are a tester');
  });
});
