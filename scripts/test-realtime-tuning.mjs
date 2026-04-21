import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const outputDir = '.tmp/realtime-tuning-test';
const outputFile = `${outputDir}/realtimeTuning.mjs`;

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const source = await readFile('src/lib/realtimeTuning.ts', 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2020,
  },
});
await writeFile(outputFile, transpiled.outputText, 'utf8');

const { getRealtimePollingInterval, rememberProcessedId } = await import(pathToFileURL(outputFile).href);

assert.equal(
  getRealtimePollingInterval({ channel: 'messages', isMobile: false, visibilityState: 'visible' }),
  4000,
  'visible desktop messages should poll every 4s',
);

assert.equal(
  getRealtimePollingInterval({ channel: 'messages', isMobile: true, visibilityState: 'visible' }),
  8000,
  'visible mobile messages should poll every 8s',
);

assert.equal(
  getRealtimePollingInterval({ channel: 'messages', isMobile: false, visibilityState: 'hidden' }),
  15000,
  'hidden desktop messages should poll every 15s',
);

assert.equal(
  getRealtimePollingInterval({ channel: 'messages', isMobile: true, visibilityState: 'hidden' }),
  25000,
  'hidden mobile messages should poll every 25s',
);

assert.equal(
  getRealtimePollingInterval({ channel: 'inbox', isMobile: true, visibilityState: 'visible' }),
  8000,
  'visible inbox should poll every 8s',
);

let cache = new Set();
for (const id of ['a', 'b', 'c', 'd']) {
  cache = rememberProcessedId(cache, id, 3);
}

assert.deepEqual([...cache], ['b', 'c', 'd'], 'processed ID cache should keep newest IDs');

const duplicateCache = rememberProcessedId(cache, 'c', 3);
assert.equal(duplicateCache, cache, 'duplicate IDs should keep the same cache instance');
assert.deepEqual([...duplicateCache], ['b', 'c', 'd'], 'duplicate IDs should not reorder the cache');

await rm(outputDir, { recursive: true, force: true });

console.log('realtime tuning tests passed');
