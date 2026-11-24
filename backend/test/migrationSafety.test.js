const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('source content migration requires explicit reuse authorization', () => {
  const backendDirectory = path.resolve(__dirname, '..');
  const result = spawnSync(process.execPath, ['migrate-source.js'], {
    cwd: backendDirectory,
    encoding: 'utf8',
    timeout: 10000,
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Content reuse is not confirmed/);
});
