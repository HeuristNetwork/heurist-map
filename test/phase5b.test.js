import test from 'node:test';
import assert from 'node:assert/strict';
import { MapApplication } from '../src/core/MapApplication.js';

function createApplication() {
  const baseMapChanges = [];
  const mapEngine = {
    async setBaseMap(value) { baseMapChanges.push(value?.id ?? null); },
    async removeLayer() { return true; },
    async destroy() {},
    getCapabilities() { return {}; }
  };
  const application = new MapApplication({
    container: { dispatchEvent() {} },
    config: {
      mapDocument: { id: null, title: 'Initial', layers: [], worldBaseMap: null },
      baseMaps: [
        { id: 'OpenStreetMap', title: 'OpenStreetMap', type: 'tile', url: 'osm' },
        { id: 'None', title: 'None', type: 'none' }
      ],
      readonly: true
    },
    mapEngine,
    host: { supportsEditing() { return false; } }
  });
  return { application, baseMapChanges };
}

test('MapDocument activation is mutually exclusive and unload restores default basemap', async () => {
  const { application, baseMapChanges } = createApplication();
  application.mapDocuments.set(1, { id: 1, title: 'One', loadState: 'available' });
  application.loadMapDocument = async () => ({ id: 1, title: 'One', layers: [], worldBaseMap: null });

  await application.activateMapDocument(1);
  assert.equal(application.getActiveMapDocument().id, 1);
  assert.equal(application.getActiveMapDocument().loadState, 'loaded');
  assert.equal(baseMapChanges.at(-1), null);

  await application.unloadMapDocument(1);
  assert.equal(application.getActiveMapDocument(), null);
  assert.equal(baseMapChanges.at(-1), 'OpenStreetMap');
});

test('stale MapDocument activation cannot become active', async () => {
  const { application } = createApplication();
  application.mapDocuments.set(1, { id: 1, title: 'One', loadState: 'available' });
  application.mapDocuments.set(2, { id: 2, title: 'Two', loadState: 'available' });
  const resolvers = new Map();
  application.loadMapDocument = (id) => new Promise((resolve) => resolvers.set(id, resolve));

  const first = application.activateMapDocument(1);
  const second = application.activateMapDocument(2);
  resolvers.get(2)({ id: 2, title: 'Two', layers: [], worldBaseMap: null });
  await second;
  resolvers.get(1)({ id: 1, title: 'One', layers: [], worldBaseMap: null });
  await assert.rejects(first, (error) => error.name === 'AbortError');
  assert.equal(application.getActiveMapDocument().id, 2);
});
