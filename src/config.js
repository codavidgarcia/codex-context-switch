import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const MODEL = 'gpt-5.6-sol';
export const MODEL_LIMIT = 1_050_000;
export const RECOMMENDED_CONTEXT = 1_000_000;
export const RECOMMENDED_COMPACTION = 900_000;
export const MIN_CONTEXT = 16_000;
export const MANAGED_KEYS = [
  'model',
  'model_context_window',
  'model_auto_compact_token_limit',
];

const STATE_FILE = 'context-switch-state.json';
const KEY_PATTERN = new RegExp(
  `^\\s*(${MANAGED_KEYS.join('|')})\\s*=\\s*(.*?)\\s*$`,
);
const QUOTED_KEY_PATTERN = new RegExp(
  `^\\s*["'](${MANAGED_KEYS.join('|')})["']\\s*=`,
);

export class ConfigError extends Error {
  constructor(message, code = 'CONFIG_ERROR', status = 400) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
    this.status = status;
  }
}

export function resolveConfigPath(explicitPath) {
  if (explicitPath) return path.resolve(explicitPath);
  const codexHome = process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : path.join(os.homedir(), '.codex');
  return path.join(codexHome, 'config.toml');
}

function detectNewline(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function splitDocument(content) {
  const newline = detectNewline(content);
  const finalNewline = content.endsWith('\n');
  const lines = content.length === 0 ? [] : content.split(/\r?\n/);
  if (finalNewline) lines.pop();
  return { lines, newline, finalNewline };
}

function joinDocument({ lines, newline, finalNewline }) {
  const body = lines.join(newline);
  return body + (finalNewline || lines.length > 0 ? newline : '');
}

function tableStart(lines) {
  const index = lines.findIndex((line) => /^\s*\[\[?[^\]]/.test(line));
  return index === -1 ? lines.length : index;
}

function stripTomlComment(raw) {
  let quote = null;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && quote === '"') {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (char === '#' && !quote) return raw.slice(0, index).trimEnd();
  }
  return raw.trimEnd();
}

function parseScalar(key, rawValue) {
  const value = stripTomlComment(rawValue).trim();
  if (key === 'model') {
    if (/^"(?:\\.|[^"\\])*"$/.test(value)) {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    if (/^'[^']*'$/.test(value)) return value.slice(1, -1);
    return null;
  }
  if (!/^[+]?[0-9][0-9_]*$/.test(value)) return null;
  const parsed = Number(value.replaceAll('_', ''));
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function inspectTopLevel(content) {
  const document = splitDocument(content);
  const end = tableStart(document.lines);
  const entries = {};

  for (let index = 0; index < end; index += 1) {
    const quotedKey = document.lines[index].match(QUOTED_KEY_PATTERN);
    if (quotedKey) {
      throw new ConfigError(
        `The ${quotedKey[1]} key is quoted. Use the standard unquoted key before using this tool.`,
        'UNSUPPORTED_KEY_FORMAT',
      );
    }
    const match = document.lines[index].match(KEY_PATTERN);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (entries[key]) {
      throw new ConfigError(
        `The top level contains more than one ${key} entry. Resolve the duplicate before using this tool.`,
        'DUPLICATE_KEY',
      );
    }
    const value = parseScalar(key, rawValue);
    if (value === null) {
      throw new ConfigError(
        `The existing ${key} value uses a format this tool cannot safely preserve.`,
        'UNSUPPORTED_VALUE',
      );
    }
    entries[key] = { index, line: document.lines[index], value };
  }

  return { document, entries, tableIndex: end };
}

function formatEntry(key, value) {
  return key === 'model'
    ? `${key} = ${JSON.stringify(value)}`
    : `${key} = ${value}`;
}

function removeExtraBlankLine(lines, index) {
  if (index > 0 && index < lines.length && lines[index - 1] === '' && lines[index] === '') {
    lines.splice(index, 1);
  }
}

export function updateTopLevel(content, values) {
  const { document, entries } = inspectTopLevel(content);
  const missing = [];

  for (const key of MANAGED_KEYS) {
    if (entries[key]) {
      document.lines[entries[key].index] = formatEntry(key, values[key]);
    } else {
      missing.push(formatEntry(key, values[key]));
    }
  }

  if (missing.length > 0) {
    let insertAt = tableStart(document.lines);
    if (insertAt === document.lines.length && document.lines.at(-1) === '') {
      insertAt -= 1;
    }
    const prefix = insertAt > 0 && document.lines[insertAt - 1] !== '' ? [''] : [];
    const suffix = insertAt < document.lines.length && document.lines[insertAt] !== '' ? [''] : [];
    document.lines.splice(insertAt, 0, ...prefix, ...missing, ...suffix);
  }

  return joinDocument(document);
}

export function restoreTopLevel(content, before) {
  const { document, entries } = inspectTopLevel(content);
  const removals = [];

  for (const key of MANAGED_KEYS) {
    const current = entries[key];
    const previous = before[key];
    if (!current) {
      throw new ConfigError(
        `The ${key} entry was removed outside this tool, so the previous setup was not restored.`,
        'CONFIG_CHANGED',
        409,
      );
    }
    if (previous.present) {
      document.lines[current.index] = previous.line;
    } else {
      removals.push(current.index);
    }
  }

  for (const index of removals.sort((a, b) => b - a)) {
    document.lines.splice(index, 1);
    removeExtraBlankLine(document.lines, index);
  }

  return joinDocument(document);
}

function validateSettings(contextWindow, compactLimit) {
  if (!Number.isSafeInteger(contextWindow) || contextWindow < MIN_CONTEXT) {
    throw new ConfigError(`Context must be an integer of at least ${MIN_CONTEXT}.`, 'INVALID_CONTEXT');
  }
  if (contextWindow > MODEL_LIMIT) {
    throw new ConfigError(`GPT-5.6 Sol supports at most ${MODEL_LIMIT} context tokens.`, 'ABOVE_MODEL_LIMIT');
  }
  if (!Number.isSafeInteger(compactLimit) || compactLimit < 8_000) {
    throw new ConfigError('The compaction line must be an integer of at least 8000.', 'INVALID_COMPACTION');
  }
  if (compactLimit >= contextWindow) {
    throw new ConfigError('The compaction line must stay below the context window.', 'NO_HEADROOM');
  }
}

async function exists(target) {
  try {
    await access(target, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readUtf8(target, fallback = null) {
  try {
    return await readFile(target, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function safeReplace(target, content) {
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const nonce = randomBytes(6).toString('hex');
  const temporary = path.join(directory, `.${path.basename(target)}.${nonce}.tmp`);
  const swap = path.join(directory, `.${path.basename(target)}.${nonce}.swap`);
  const targetExists = await exists(target);

  await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600 });
  try {
    if (targetExists) await rename(target, swap);
    await rename(temporary, target);
    if (targetExists) await rm(swap, { force: true });
  } catch (error) {
    if (await exists(swap)) {
      if (await exists(target)) await rm(target, { force: true });
      await rename(swap, target);
    }
    await rm(temporary, { force: true });
    throw error;
  }
}

function statePathFor(configPath) {
  return path.join(path.dirname(configPath), STATE_FILE);
}

async function readState(configPath) {
  const raw = await readUtf8(statePathFor(configPath));
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    return state.version === 1 && state.configPath === configPath ? state : null;
  } catch {
    return null;
  }
}

async function writeState(configPath, state) {
  await safeReplace(statePathFor(configPath), `${JSON.stringify(state, null, 2)}\n`);
}

function valuesFromEntries(entries) {
  return Object.fromEntries(
    MANAGED_KEYS.map((key) => [key, entries[key]?.value ?? null]),
  );
}

function matchesApplied(entries, applied) {
  return MANAGED_KEYS.every((key) => entries[key]?.value === applied[key]);
}

export async function getStatus(configPath) {
  const raw = await readUtf8(configPath, '');
  const { entries } = inspectTopLevel(raw);
  const values = valuesFromEntries(entries);
  const state = await readState(configPath);
  const stateMatches = Boolean(state && matchesApplied(entries, state.applied));
  const active =
    values.model === MODEL &&
    Number.isSafeInteger(values.model_context_window) &&
    Number.isSafeInteger(values.model_auto_compact_token_limit);

  return {
    configPath,
    configExists: await exists(configPath),
    active,
    canRevert: stateMatches,
    hasConflict: Boolean(state && !stateMatches),
    values,
    recommended: {
      model: MODEL,
      contextWindow: RECOMMENDED_CONTEXT,
      compactLimit: RECOMMENDED_COMPACTION,
      modelLimit: MODEL_LIMIT,
      minContext: MIN_CONTEXT,
    },
    appliedAt: stateMatches ? state.appliedAt : null,
  };
}

export async function applySettings(configPath, contextWindow, compactLimit) {
  validateSettings(contextWindow, compactLimit);
  const configExisted = await exists(configPath);
  const raw = await readUtf8(configPath, '');
  const { entries } = inspectTopLevel(raw);
  const existingState = await readState(configPath);

  if (existingState && !matchesApplied(entries, existingState.applied)) {
    throw new ConfigError(
      'The managed settings changed outside this tool. Review config.toml before applying again.',
      'CONFIG_CHANGED',
      409,
    );
  }

  const values = {
    model: MODEL,
    model_context_window: contextWindow,
    model_auto_compact_token_limit: compactLimit,
  };
  const before = existingState?.before ?? Object.fromEntries(
    MANAGED_KEYS.map((key) => [key, entries[key]
      ? { present: true, line: entries[key].line }
      : { present: false }]),
  );
  const next = updateTopLevel(raw, values);
  await safeReplace(configPath, next);
  await writeState(configPath, {
    version: 1,
    configPath,
    configExisted: existingState?.configExisted ?? configExisted,
    before,
    applied: values,
    appliedAt: new Date().toISOString(),
  });
  return getStatus(configPath);
}

export async function revertSettings(configPath) {
  const state = await readState(configPath);
  if (!state) {
    throw new ConfigError('No previous setup is available to restore.', 'NO_PREVIOUS_SETUP', 409);
  }

  const raw = await readUtf8(configPath, '');
  const { entries } = inspectTopLevel(raw);
  if (!matchesApplied(entries, state.applied)) {
    throw new ConfigError(
      'The managed settings changed outside this tool. Nothing was overwritten.',
      'CONFIG_CHANGED',
      409,
    );
  }

  const restored = restoreTopLevel(raw, state.before);
  if (!state.configExisted && restored.trim() === '') {
    await rm(configPath, { force: true });
  } else {
    await safeReplace(configPath, restored);
  }
  await rm(statePathFor(configPath), { force: true });
  return getStatus(configPath);
}
