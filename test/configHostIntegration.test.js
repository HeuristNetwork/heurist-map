import test from 'node:test';
import assert from 'node:assert/strict';

import { HeuristHostAdapter } from '../src/host/HeuristHostAdapter.js';
import { createHostAdapter } from '../src/host/createHostAdapter.js';
import { HeuristMapConfigurationApi } from '../src/host/HeuristMapConfigurationApi.js';

test('Heurist host adapter uses keyed preference FrontController contract', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      json: async () => ({ status: 0, data: { format: 'heurist-map-settings', version: 1 } })
    };
  };
  const host = new HeuristHostAdapter({
    baseUrl: 'http://example.test/heurist/', database: 'demo', fetchImpl
  });

  await host.loadMapPreferences();
  await host.saveMapPreferences({ format: 'heurist-map-settings', version: 1 });

  assert.match(calls[0].url, /controller=UserController/);
  assert.match(calls[0].url, /action=get_prefs/);
  assert.match(calls[0].url, /key=heurist-map/);
  assert.equal(calls[1].init.method, 'POST');
  assert.match(calls[1].init.body, /key=heurist-map/);
  assert.match(calls[1].init.body, /value=/);
});

test('host factory creates HeuristHostAdapter for declarative host config', () => {
  const host = createHostAdapter({ type: 'heurist', baseUrl: '/heurist/', database: 'demo', fetchImpl: async () => {} });
  assert.ok(host instanceof HeuristHostAdapter);
  assert.deepEqual(host.getCapabilities(), { mapPreferences: true, mapPublishing: true });
});

test('configuration-only API exposes schema operations without MapApplication', () => {
  const api = new HeuristMapConfigurationApi();
  const defaults = api.getConfigurationDefaults();
  assert.equal(defaults.config.currentResultsLayer.options.maxAllowedFeatures, 1000);
  assert.equal(defaults.config.currentResultsLayer.options.dynamicRequests, false);
  const serialized = api.serializeConfiguration({ options: {}, config: {} });
  assert.equal(serialized.format, 'heurist-map-settings');
  assert.equal(serialized.version, 1);
});


test('default host fetch keeps Window/global receiver and avoids illegal invocation', async () => {
  const originalFetch = globalThis.fetch;
  let receiver = null;
  globalThis.fetch = function() {
    receiver = this;
    return Promise.resolve({ ok: true, json: async () => ({ status: 0, data: null }) });
  };
  try {
    const host = new HeuristHostAdapter({ baseUrl: 'http://example.test/heurist/', database: 'demo' });
    await host.loadMapPreferences();
    assert.equal(receiver, globalThis);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('Heurist host adapter accepts string ok status and null preference data', async () => {
  const host = new HeuristHostAdapter({
    baseUrl: 'http://example.test/heurist/',
    database: 'demo',
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'ok', data: null }) })
  });
  assert.equal(await host.loadMapPreferences(), null);
});

test('Heurist host adapter accepts string ok status for publish save', async () => {
  const host = new HeuristHostAdapter({
    baseUrl: 'http://example.test/heurist/',
    database: 'demo',
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'ok', data: { id: 'abc123' } }) })
  });
  assert.deepEqual(await host.publishMap({ format: 'heurist-map-publish' }), { id: 'abc123' });
});
