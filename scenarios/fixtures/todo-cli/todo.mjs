#!/usr/bin/env node
/**
 * tiny "todo" CLI — Errantry's reference target.
 *
 * Supports: list, add <text>, done <id>, delete <id>, clear, --help.
 * State persists to $TODO_DB (default: $PWD/.todo.json) so scenarios can
 * assert against the file directly with the `file` matcher.
 *
 * Designed to exercise the framework's main signals:
 *   - --help is structured so a model can find subcommands
 *   - missing-arg errors point at the right command
 *   - unknown-subcommand errors list the known ones
 *   - exit codes: 0 success, 2 user error, 3 system error
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DB = process.env.TODO_DB ? resolve(process.env.TODO_DB) : resolve(process.cwd(), '.todo.json');

const HELP = `todo — minimal task list CLI

USAGE
  todo <command> [args]

COMMANDS
  list                    Show all tasks
  add <text...>           Add a new task
  done <id>               Mark task <id> as done
  delete <id>             Remove task <id>
  clear                   Remove all tasks
  --help                  Show this message

EXAMPLES
  todo add Buy milk
  todo done 3
  todo list

State file: $TODO_DB or .todo.json in the current directory.
`;

function fail(message, code = 2) {
  process.stderr.write(`error: ${message}\n`);
  if (code === 2) process.stderr.write(`run \`todo --help\` for usage\n`);
  process.exit(code);
}

function loadState() {
  if (!existsSync(DB)) return { tasks: [], nextId: 1 };
  try {
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch (err) {
    fail(`could not read state at ${DB}: ${err.message}`, 3);
  }
}

function saveState(state) {
  mkdirSync(dirname(DB), { recursive: true });
  writeFileSync(DB, JSON.stringify(state, null, 2) + '\n');
}

const [, , command, ...rest] = process.argv;

if (!command || command === '--help' || command === '-h') {
  process.stdout.write(HELP);
  process.exit(command ? 0 : 2);
}

if (command === 'list') {
  const { tasks } = loadState();
  if (tasks.length === 0) {
    process.stdout.write('(no tasks)\n');
  } else {
    for (const t of tasks) {
      const mark = t.done ? '[x]' : '[ ]';
      process.stdout.write(`${mark} ${t.id} ${t.text}\n`);
    }
  }
  process.exit(0);
}

if (command === 'add') {
  if (rest.length === 0) {
    fail('add requires task text. example: todo add Buy milk');
  }
  const state = loadState();
  const task = { id: state.nextId, text: rest.join(' '), done: false };
  state.tasks.push(task);
  state.nextId += 1;
  saveState(state);
  process.stdout.write(`added: ${task.id} ${task.text}\n`);
  process.exit(0);
}

if (command === 'done' || command === 'delete') {
  if (rest.length === 0) {
    fail(`${command} requires a task id. example: todo ${command} 3`);
  }
  const id = Number(rest[0]);
  if (!Number.isInteger(id)) {
    fail(`task id must be an integer, got "${rest[0]}"`);
  }
  const state = loadState();
  const idx = state.tasks.findIndex((t) => t.id === id);
  if (idx === -1) {
    fail(`no task with id ${id}. run \`todo list\` to see ids`);
  }
  if (command === 'done') {
    state.tasks[idx].done = true;
  } else {
    state.tasks.splice(idx, 1);
  }
  saveState(state);
  process.stdout.write(`ok\n`);
  process.exit(0);
}

if (command === 'clear') {
  saveState({ tasks: [], nextId: 1 });
  process.stdout.write('cleared\n');
  process.exit(0);
}

fail(`unknown command: "${command}". known: list, add, done, delete, clear`);
