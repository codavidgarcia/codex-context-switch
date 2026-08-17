import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAppServer } from '../src/cli.js';

test('local API requires its same-origin request token for writes', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'context-switch-server-'));
  const configPath = path.join(directory, 'config.toml');
  const token = 'test-request-token';
  const server = createAppServer({ configPath, token });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  server.setOrigin(origin);

  const statusResponse = await fetch(`${origin}/api/status`);
  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.headers.get('x-context-switch-token'), token);

  const blocked = await fetch(`${origin}/api/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ contextWindow: 1_000_000, compactLimit: 900_000 }),
  });
  assert.equal(blocked.status, 403);

  const applied = await fetch(`${origin}/api/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'X-Context-Switch-Token': token,
    },
    body: JSON.stringify({ contextWindow: 1_000_000, compactLimit: 900_000 }),
  });
  assert.equal(applied.status, 200);
  assert.equal((await applied.json()).canRevert, true);
});
