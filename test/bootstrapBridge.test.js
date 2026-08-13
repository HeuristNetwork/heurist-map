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

test('direct iframe bridge supplies the reduced bootstrap contract', () => {
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
            baseUrl: '/heurist/'
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
    assert.equal(config.apiBaseUrl, '/heurist/api');
    assert.equal(config.ui.showBaseMaps, false);
    assert.equal(config.dynamicDocument.title, 'Saved preference title');
    assert.equal(config.documents.initiallyActive, 'dynamic');
    assert.deepEqual(config.initialState, { zoom: 9 });
    assert.equal(config.host.type, 'heurist');
    assert.equal(config.host.baseUrl, '/heurist/');
    assert.equal(config.host.database, 'osmak_mapping');
    assert.equal(config.host.bridge, globalThis.frameElement.heuristMapHost);
  } finally {
    globalThis.frameElement = previousFrameElement;
    globalThis.location = previousLocation;
  }
});

test('minimal standalone bootstrap uses canonical settings and built-in basemaps', () => {
  const previousFrameElement = globalThis.frameElement;
  const previousBootstrap = globalThis.heuristMapBootstrap;
  const previousLocation = globalThis.location;
  globalThis.frameElement = null;
  globalThis.location = { href: 'http://localhost/heurist-map/' };
  globalThis.heuristMapBootstrap = {
    runtime: {
      database: 'demo',
      apiBaseUrl: '/heurist/api',
      baseUrl: '/heurist/'
    }
  };

  try {
    const config = getHeuristMapConfig();
    assert.equal(config.persistedSettings.options.ui.enabled, true);
    assert.equal(config.persistedSettings.options.mapDocuments.allowed, null);
    assert.equal(config.documents.initiallyActive, 'dynamic');
    assert.deepEqual(config.baseMaps.map((item) => item.id), ['OpenStreetMap', 'None']);
    assert.equal(config.mapDocument.id, null);
  } finally {
    globalThis.frameElement = previousFrameElement;
    globalThis.heuristMapBootstrap = previousBootstrap;
    globalThis.location = previousLocation;
  }
});

test('runtime cannot inject custom basemap catalog or UI settings', () => {
  const previousFrameElement = globalThis.frameElement;
  const previousBootstrap = globalThis.heuristMapBootstrap;
  const previousLocation = globalThis.location;
  globalThis.frameElement = null;
  globalThis.location = { href: 'http://localhost/heurist-map/' };
  globalThis.heuristMapBootstrap = {
    runtime: {
      database: 'demo',
      apiBaseUrl: '/heurist/api',
      baseMaps: { available: [{ id: 'Injected', title: 'Injected', type: 'none' }] },
      uiRuntime: { showBaseMaps: false }
    },
    settings: {
      options: {
        ui: { showBaseMaps: true },
        baseMaps: { allowed: ['None'] }
      }
    }
  };

  try {
    const config = getHeuristMapConfig();
    assert.equal(config.ui.showBaseMaps, true);
    assert.deepEqual(config.baseMaps.map((item) => item.id), ['None']);
  } finally {
    globalThis.frameElement = previousFrameElement;
    globalThis.heuristMapBootstrap = previousBootstrap;
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


test('HeuristHostAdapter delegates record editing to the parent bridge', async () => {
  const edited = [];
  const adapter = new HeuristHostAdapter({
    bridge: {
      editRecord(recordId) {
        edited.push(recordId);
        return Promise.resolve({ saved: true, recordId });
      }
    }
  });

  assert.equal(adapter.supportsEditing(), true);
  assert.deepEqual(await adapter.editRecord(77), { saved: true, recordId: 77 });
  assert.deepEqual(edited, [77]);
});
