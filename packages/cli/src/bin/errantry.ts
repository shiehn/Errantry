#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand } from '../commands/run.js';

const program = new Command();

program
  .name('errantry')
  .description('Agent-CLI usability testing — drive an LLM through your CLI and assert state.')
  .version('0.0.1');

program
  .command('run')
  .description('Run a scenario file (YAML) end-to-end.')
  .argument('<scenario>', 'Path to a scenario YAML file')
  .option('--cwd <path>', 'Working directory for the agent\'s bash subprocess', process.cwd())
  .option('--bridge <url>', 'Base URL of an @errantry/electron-bridge endpoint (e.g. http://localhost:7654)')
  .option('--json', 'Print machine-readable JSON instead of the markdown report', false)
  .option(
    '--mock <commands>',
    'Path to a file with one bash command per line. Replaces the LLM with MockProvider — no OpenAI key needed. Useful for validating scenarios and assertions before paying for real runs.',
  )
  .action(runCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
