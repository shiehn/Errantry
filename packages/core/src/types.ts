/**
 * Errantry core types — shared across packages.
 *
 * The framework's vocabulary:
 *   Scenario      — a YAML/TS-defined goal + setup + assertions
 *   AgentProvider — an LLM (OpenAI, Anthropic) that drives the loop
 *   Surface       — what the agent can call (CLI bash, MCP tools)
 *   AppBridge     — privileged backend access for setup + assertions
 *   Trace         — every turn / tool call / result, captured for inspection
 *   ScenarioResult— output of one scenario run
 */

export type SurfaceKind = 'cli' | 'mcp';
export type ProviderKind = 'openai' | 'anthropic';

// ──────────────────────────────────────────────────────────────────────────
// Scenario (input)
// ──────────────────────────────────────────────────────────────────────────

export interface Scenario {
  name: string;
  description?: string;
  surface: SurfaceKind;
  setup?: ScenarioSetup;
  agent: ScenarioAgent;
  goal: string;
  assertions: ScenarioAssertion[];
  metrics?: ScenarioMetrics;
  /**
   * Free-form metadata. Currently consumed only by tooling (coverage
   * reports, dashboards). The runner ignores this block. Convention:
   *   metadata.exercises: string[]   — registered action names this
   *                                     scenario is intended to cover.
   */
  metadata?: Record<string, unknown>;
}

export interface ScenarioSetup {
  fixture?: string;
  bind?: { project?: string };
  appConfig?: Record<string, unknown>;
  smokeWaitFor?: string[];
  /**
   * Bash commands to run BEFORE the agent loop starts. Useful for
   * scenarios that need preconditions the agent shouldn't have to
   * discover (e.g., "mute the kick" needs a kick to exist first).
   * Each command is run sequentially in the agent's `cwd` with the
   * same env. A failing command aborts the scenario. Stdout/stderr
   * of each is captured into the trace as a synthetic invocation
   * with turn=0 so it appears in --show-trace output.
   */
  preCommands?: string[];
}

export interface ScenarioAgent {
  provider: ProviderKind;
  model: string;
  maxTurns: number;
  system?: string;
  /** Per-bash-command timeout in ms. Defaults to CliSurface's 30s. Bump for render scenarios. */
  commandTimeoutMs?: number;
}

export interface ScenarioAssertion {
  matcher: string;
  args: Record<string, unknown>;
}

export interface ScenarioMetrics {
  budget?: {
    turns?: { max: number };
    errors_encountered?: { max: number };
    friction_score?: { max: number };
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Surface — what the agent calls
// ──────────────────────────────────────────────────────────────────────────

export interface SurfaceTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface SurfaceInvocation {
  tool: string;
  args: Record<string, unknown>;
}

export interface SurfaceResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

export interface Surface {
  readonly kind: SurfaceKind;
  tools(): SurfaceTool[];
  invoke(call: SurfaceInvocation): Promise<SurfaceResult>;
}

// ──────────────────────────────────────────────────────────────────────────
// Agent provider — abstracts OpenAI / Anthropic
// ──────────────────────────────────────────────────────────────────────────

export interface AgentTurn {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: SurfaceInvocation[];
  toolCallId?: string;
}

export interface AgentRunRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  surface: Surface;
  maxTurns: number;
  apiKey: string;
}

export interface AgentRunOutput {
  finishReason: 'completed' | 'max_turns' | 'error';
  turns: AgentTurn[];
  invocations: TracedInvocation[];
}

export interface AgentProvider {
  readonly kind: ProviderKind;
  run(req: AgentRunRequest): Promise<AgentRunOutput>;
}

// ──────────────────────────────────────────────────────────────────────────
// Trace + result
// ──────────────────────────────────────────────────────────────────────────

export interface TracedInvocation {
  turn: number;
  call: SurfaceInvocation;
  result: SurfaceResult;
  startedAt: number;
}

export interface ScenarioResult {
  scenario: Scenario;
  startedAt: number;
  finishedAt: number;
  finishReason: AgentRunOutput['finishReason'];
  turns: AgentTurn[];
  invocations: TracedInvocation[];
  assertions: AssertionOutcome[];
  metrics: ComputedMetrics;
  passed: boolean;
}

export interface AssertionOutcome {
  matcher: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ComputedMetrics {
  turns: number;
  toolCalls: number;
  helpInvocations: number;
  errorsEncountered: number;
  errorsRecovered: number;
  frictionScore: number;
  completedSubgoals: number;
}

// ──────────────────────────────────────────────────────────────────────────
// AppBridge — privileged HTTP interface for setup + assertions
// ──────────────────────────────────────────────────────────────────────────

export interface AppBridge {
  health(): Promise<{ ok: boolean }>;
  applyConfig(config: Record<string, unknown>): Promise<void>;
  mountFixture(name: string): Promise<{ projectId: string; projectPath: string }>;
  reset(): Promise<void>;
  dbQuery(sql: string, args?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  smoke(): Promise<{ ready: boolean; checks: Record<string, boolean> }>;
}
