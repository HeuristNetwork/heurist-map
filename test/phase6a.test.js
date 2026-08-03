import test from 'node:test';
import assert from 'node:assert/strict';
import { MapApplication } from '../src/core/MapApplication.js';

function createApplication({ initiallyActive = false } = {}) {
  const rendered = [];
  const removed = [];
  const mapEngine = {
    async initialize() {},
    setInteractionHandlers() {},
    async destroy() {},
    async addLayer(definition) { rendered.push(definition); return { id: definition.id }; },
    async removeLayer(id) { removed.push(id); return true; },
    async setLayerVisibility() {},
    async setLayerOpacity() {},
    async setBaseMap() {},
    async fitBounds() {},
    async setView() {},
    async getVisibleLayerBounds() { return null; },
    getCapabilities() { return {}; }
  };
  const layerLoaders = {
    async load(mapLayer, context) {
      return {
        id: context.reference.id,
        recordId: mapLayer.id,
        title: mapLayer.title,
        type: 'geojson',
        visible: mapLayer.visible !== false,
        selectable: mapLayer.selectable !== false,
        data: { type: 'FeatureCollection', features: [] },
        source: mapLayer.source,
        style: mapLayer.style,
        options: mapLayer.options,
        order: context.reference.order
      };
    }
  };
  const application = new MapApplication({
    container: { dispatchEvent() {} },
    config: {
      mapDocument: {},
      dynamicDocument: {
        enabled: true,
        id: 'dynamic',
        title: 'Runtime map',
        initiallyActive,
        keepContent: true,
        layers: []
      },
      ui: { showCurrentDocument: true },
      baseMaps: [],
      readonly: true
    },
    mapEngine,
    host: { async initialize() {}, async destroy() {}, supportsEditing() { return false; } },
    providers: {
      mapLayer: {
        async getById(id) {
          return {
            id,
            title: `Layer ${id}`,
            visible: true,
            selectable: true,
            source: { type: 'heurist-query', query: `ids:${id}` },
            style: {}, options: {}
          };
        }
      }
    },
    layerLoaders
  });
  return { application, rendered, removed };
}

test('every application has one lightweight dynamic MapDocument', () => {
  const { application } = createApplication();
  assert.deepEqual(application.getDynamicDocument(), {
    id: 'dynamic',
    kind: 'dynamic',
    persistent: false,
    title: 'Runtime map',
    active: false,
    activating: false,
    loadState: 'available',
    error: null,
    showInPanel: true
  });
});

test('query layer added while dynamic document is inactive is retained but not rendered', async () => {
  const { application, rendered } = createApplication();
  const layer = await application.addQueryLayer({ t: 10 }, { id: 'current-results', title: 'Current results' });
  assert.equal(layer.id, 'current-results');
  assert.equal(rendered.length, 0);

  await application.activateMapDocument('dynamic');
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].id, 'current-results');
  assert.deepEqual(rendered[0].source.query, { t: 10 });
});

test('setQueryForLayer keeps layer identity and reloads active dynamic layer', async () => {
  const { application, rendered, removed } = createApplication({ initiallyActive: true });
  await application.addQueryLayer('t:10', { id: 'current-results' });
  await application.setQueryForLayer('current-results', 't:20');
  assert.deepEqual(removed, ['current-results']);
  assert.equal(rendered.at(-1).id, 'current-results');
  assert.equal(rendered.at(-1).source.query, 't:20');
});

test('clearLayer keeps definition while removeLayer removes it', async () => {
  const { application } = createApplication({ initiallyActive: true });
  await application.addQueryLayer('t:10', { id: 'current-results' });
  assert.equal(await application.clearLayer('current-results'), true);
  assert.equal(application.getLayer('current-results').loadState, 'deferred');
  assert.equal(await application.removeLayer('current-results'), true);
  assert.equal(application.getLayer('current-results'), null);

  await application.activateMapDocument('dynamic', { force: true });
  assert.equal(application.getLayers().length, 0);
});

test('addLayer accepts a persisted MapLayer record ID for the active document', async () => {
  const { application, rendered } = createApplication({ initiallyActive: true });
  const layer = await application.addLayer(45);
  assert.equal(layer.id, '45');
  assert.equal(rendered[0].recordId, 45);
});
