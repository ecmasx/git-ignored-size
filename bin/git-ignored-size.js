#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error.message || error);
  process.exitCode = error.exitCode || 1;
}

function main(args) {
  const options = parseArgs(args);

  if (options.help || args.length === 0) return printHelp();

  printResult(options);
}

function printResult(options) {
  const result = scanIgnored(options.cwd || process.cwd());

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printTable(result.entries, result.totalBytes);
}

function scanIgnored(cwd) {
  const repoRoot = git(['rev-parse', '--show-toplevel'], cwd).trim();
  const files = git(['ls-files', '--others', '--ignored', '--exclude-standard', '-z'], repoRoot)
    .split('\0')
    .filter(Boolean);

  const groups = groupByTopFolder(files);
  const entries = [...groups].map(([name, files]) => ({
    path: name,
    bytes: sum(files.map((file) => sizeOf(path.join(repoRoot, file)))),
  }));

  entries.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

  return {
    repoRoot,
    totalBytes: sum(entries.map((entry) => entry.bytes)),
    entries,
  };
}

function groupByTopFolder(files) {
  const groups = new Map();

  for (const file of files) {
    const normalized = file.replaceAll('\\', '/');
    const topFolder = normalized.split('/')[0];

    if (!groups.has(topFolder)) groups.set(topFolder, []);
    groups.get(topFolder).push(normalized);
  }

  return groups;
}

function printTable(entries, totalBytes) {
  if (entries.length === 0) {
    console.log('No ignored files found.');
    return;
  }

  const sizeWidth = Math.max('Size'.length, ...entries.map((entry) => formatBytes(entry.bytes).length));

  console.log(`${'Size'.padStart(sizeWidth)}  Path`);
  console.log(`${'-'.repeat(sizeWidth)}  ----`);

  for (const entry of entries) {
    console.log(`${formatBytes(entry.bytes).padStart(sizeWidth)}  ${entry.path}`);
  }

  console.log(`\nTotal: ${formatBytes(totalBytes)} across ${entries.length} ignored entries`);
}

function parseArgs(args) {
  const options = { cwd: process.cwd(), json: false, help: false };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = () => required(args[++i], arg);

    if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === 'json' || arg === '-j' || arg === '--json') options.json = true;
    else if (arg === '-C' || arg === '--cwd') options.cwd = next();
    else if (arg.startsWith('--cwd=')) options.cwd = arg.slice('--cwd='.length);
    else if (arg.startsWith('-')) fail(`Unknown option: ${arg}`, 2);
    else options.cwd = arg;
  }

  return options;
}

function printHelp() {
  console.log(`git-ignored-size

Show how much disk space Git-ignored files and directories use.

Usage:
  gis
  gis [path]
  gis json [path]

Options:
  -j, --json      Print JSON
  -C, --cwd <dir> Run in another Git repository
  -h, --help      Show help

Aliases:
  git-ignored-size
  ignored-size

Examples:
  gis
  gis .
  gis json ../my-repo`);
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  } catch {
    fail('Not inside a Git repository.', 2);
  }
}

function sizeOf(filePath) {
  const stats = lstatSync(filePath);
  if (!stats.isDirectory()) return stats.size;

  return sum(readdirSync(filePath).map((child) => sizeOf(path.join(filePath, child))));
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  if (unit === 0) return `${value} ${units[unit]}`;
  if (value >= 100) return `${value.toFixed(0)} ${units[unit]}`;
  if (value >= 10) return `${value.toFixed(1)} ${units[unit]}`;
  return `${value.toFixed(2)} ${units[unit]}`;
}

function required(value, name) {
  if (!value) fail(`${name} requires a value`, 2);
  return value;
}

function sum(numbers) {
  return numbers.reduce((total, number) => total + number, 0);
}

function fail(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
  throw error;
}
