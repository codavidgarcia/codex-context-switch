import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ConfigError,
  applySettings,
  getStatus,
  inspectTopLevel,
  revertSettings,
  updateTopLevel,
} from '../src/config.js';

async function temporaryConfig(content) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'context-switch-'));
  const target = path.join(directory, 'config.toml');
  if (content !== null) await writeFile(target, content, 'utf8');
  return target;
}

test('inserts missing settings at the top level before section headers', () => {
  const original = '# user config\nmodel = "gpt-old"\n\n[projects."/work"]\ntrusted = true\n';
  const updated = updateTopLevel(original, {
    model: 'gpt-5.6-sol',
    model_context_window: 1_000_000,
    model_auto_compact_token_limit: 900_000,
  });

  const sectionIndex = updated.indexOf('[projects."/work"]');
  assert.ok(updated.indexOf('model_context_window = 1000000') < sectionIndex);
  assert.ok(updated.indexOf('model_auto_compact_token_limit = 900000') < sectionIndex);
  assert.match(updated, /trusted = true/);
  assert.equal(inspectTopLevel(updated).entries.model.value, 'gpt-5.6-sol');
});

test('apply and revert restore exact managed lines while preserving unrelated edits', async () => {
  const original = [
    '# Keep this heading',
    'model = "gpt-5.4" # personal default',
    'model_context_window = 400_000',
    '',
    '[features]',
    'web_search = true',
    '',
  ].join('\n');
  const target = await temporaryConfig(original);

  const applied = await applySettings(target, 1_000_000, 900_000);
  assert.equal(applied.canRevert, true);
  let changed = await readFile(target, 'utf8');
  changed = changed.replace('web_search = true', 'web_search = false\nvoice = true');
  await writeFile(target, changed, 'utf8');

  const reverted = await revertSettings(target);
  const final = await readFile(target, 'utf8');
  assert.equal(reverted.canRevert, false);
  assert.match(final, /model = "gpt-5\.4" # personal default/);
  assert.match(final, /model_context_window = 400_000/);
  assert.doesNotMatch(final, /model_auto_compact_token_limit/);
  assert.match(final, /web_search = false/);
  assert.match(final, /voice = true/);
});

test('revert removes a config file that the tool created from nothing', async () => {
  const target = await temporaryConfig(null);
  await applySettings(target, 750_000, 675_000);
  assert.equal((await getStatus(target)).configExists, true);
  const reverted = await revertSettings(target);
  assert.equal(reverted.configExists, false);
});

test('refuses to overwrite a managed setting changed outside the tool', async () => {
  const target = await temporaryConfig('approval_policy = "never"\n');
  await applySettings(target, 1_000_000, 900_000);
  const changed = (await readFile(target, 'utf8')).replace(
    'model_context_window = 1000000',
    'model_context_window = 800000',
  );
  await writeFile(target, changed, 'utf8');

  await assert.rejects(
    () => revertSettings(target),
    (error) => error instanceof ConfigError && error.code === 'CONFIG_CHANGED',
  );
  assert.equal((await getStatus(target)).hasConflict, true);
});

test('rejects values above the documented model limit', async () => {
  const target = await temporaryConfig('');
  await assert.rejects(
    () => applySettings(target, 1_050_001, 900_000),
    (error) => error instanceof ConfigError && error.code === 'ABOVE_MODEL_LIMIT',
  );
});

test('refuses ambiguous duplicate top-level keys', () => {
  assert.throws(
    () => inspectTopLevel('model = "a"\nmodel = "b"\n'),
    (error) => error instanceof ConfigError && error.code === 'DUPLICATE_KEY',
  );
});

test('refuses quoted variants of managed keys instead of creating a semantic duplicate', () => {
  assert.throws(
    () => inspectTopLevel('"model" = "gpt-old"\n'),
    (error) => error instanceof ConfigError && error.code === 'UNSUPPORTED_KEY_FORMAT',
  );
});
