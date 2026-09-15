import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(
  new URL('../public/sw.js', import.meta.url),
  'utf8',
);
function worker() {
  const listeners: Record<string, (event: Record<string, unknown>) => void> =
    {};
  const removed: string[] = [];
  let requests = 0;
  let offline = false;
  const context = {
    URL,
    Response,
    self: {
      location: { origin: 'https://example.com' },
      registration: { scope: 'https://example.com/' },
      clients: { claim: async () => {} },
      addEventListener: (
        name: string,
        fn: (event: Record<string, unknown>) => void,
      ) => {
        listeners[name] = fn;
      },
    },
    caches: {
      match: async () => new Response('cached'),
      open: async () => ({ put: async () => {} }),
      keys: async () => [
        'another-app',
        'chesscape-shell-v3-root',
        'chesscape-shell-v3-/other-game',
        'chesscape-shell-v5-root',
      ],
      delete: async (key: string) => {
        removed.push(key);
      },
    },
    fetch: async () => {
      requests++;
      if (offline) throw new Error('offline');
      return new Response('fresh');
    },
  };
  vm.runInNewContext(source, context);
  return {
    context,
    listeners,
    removed,
    requests: () => requests,
    offline: () => {
      offline = true;
    },
    async request(path: string) {
      let result: Promise<Response> | undefined;
      const pending: Promise<unknown>[] = [];
      listeners.fetch({
        request: {
          method: 'GET',
          mode: 'cors',
          url: new URL(path, 'https://example.com').href,
        },
        respondWith: (response: Promise<Response>) => {
          result = response;
        },
        waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      });
      const response = await result;
      await Promise.all(pending);
      return response;
    },
  };
}

void test('service worker bypasses puzzles and keeps mutable assets fresh with offline fallback', async () => {
  const sw = worker();
  for (const path of [
    '/api/daily',
    '/api/daily?day=2026-09-01',
    '/sw.js',
    'https://other.example/icon.png',
  ])
    assert.equal(await sw.request(path), undefined);
  assert.equal(sw.requests(), 0);
  assert.equal(
    await (await sw.request('/_next/static/font-abc.woff2'))?.text(),
    'cached',
  );
  assert.equal(sw.requests(), 0);
  assert.equal(await (await sw.request('/icon-192.png'))?.text(), 'fresh');
  assert.equal(
    await (await sw.request('/manifest.webmanifest'))?.text(),
    'fresh',
  );
  sw.offline();
  assert.equal(await (await sw.request('/icon-192.png'))?.text(), 'cached');
});

void test('service worker cache cleanup preserves other applications and mounts', async () => {
  const sw = worker();
  let pending: Promise<unknown> | undefined;
  sw.listeners.activate({
    waitUntil: (promise: Promise<unknown>) => {
      pending = promise;
    },
  });
  await pending;
  assert.deepEqual(sw.removed, ['chesscape-shell-v3-root']);
});
