import test from 'node:test';
import assert from 'node:assert/strict';
import { getHeuristMapConfig } from '../src/mapConfig.js';
import { HeuristHostAdapter } from '../src/host/HeuristHostAdapter.js';

function response(data = true) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ status: 'ok', data })
  });
}

test('direct iframe bridge supplies one bootstrap and runtime cannot override persisted settings', () => {
  const previousFrameElement = globalThis.frameElement;
  const previousLocation = globalThis.location;
  globalThis.location = { href: 'http://localhost/heurist-map/' };
  globalThis.frameElement = {
    heuristMapHost: {
      getConfiguration() {
        return {
          runtime: {
            database: 'osmak_mapping',
            apiBaseUrl: '/heurist/api',
            // Deliberately invalid old-style duplicates: these must be ignored.
            ui: { showBaseMaps: true },
            dynamicDocument: { title: 'Wrong runtime title' },
            host: { type: 'heurist', baseUrl: '/heurist/' }
          },
          settings: {
            format: 'heurist-map-settings',
            version: 1,
            options: {
              ui: { showBaseMaps: false },
              mapDocuments: { initiallyActive: null }
            },
            config: {
              dynamicDocument: { title: 'Saved preference title' }
            }
          },
          state: { zoom: 9 }
        };
      },
      updateSettings() {}
    }
  };

  try {
    const config = getHeuristMapConfig();
    assert.equal(config.database, 'osmak_mapping');
    assert.equal(config.ui.showBaseMaps, false);
    assert.equal(config.dynamicDocument.title, 'Saved preference title');
    assert.equal(config.documents.initiallyActive, 'dynamic');
    assert.deepEqual(config.initialState, { zoom: 9 });
    assert.equal(config.host.bridge, globalThis.frameElement.heuristMapHost);
  } finally {
    globalThis.frameElement = previousFrameElement;
    globalThis.location = previousLocation;
  }
});

test('saving preferences updates the parent-owned bootstrap through the direct bridge', async () => {
  let updated = null;
  const adapter = new HeuristHostAdapter({
    baseUrl: 'http://localhost/heurist/',
    database: 'osmak_mapping',
    bridge: { updateSettings(settings) { updated = settings; } },
    fetchImpl: () => response(true)
  });
  const settings = {
    format: 'heurist-map-settings',
    version: 1,
    options: { ui: { showBaseMaps: false } },
    config: { dynamicDocument: { title: 'Updated' } }
  };

  await adapter.saveMapPreferences(settings);
  assert.deepEqual(updated, settings);
});
