import test from 'node:test';
import assert from 'node:assert/strict';

import { HeuristApiClient } from '../src/data/HeuristApiClient.js';
import { MapDocumentProvider } from '../src/data/MapDocumentProvider.js';
import { MapLayerProvider } from '../src/data/MapLayerProvider.js';
import { QueryGeoDataProvider } from '../src/data/QueryGeoDataProvider.js';
import { MapApplication } from '../src/core/MapApplication.js';

const mapDocumentFixture = {
  format: 'heurist-map-document',
  version: 1,
  id: 123,
  title: 'Test document',
  mapBookmark: { raw: '', type: 'view', center: { latitude: 0, longitude: 0 }, zoom: 2 },
  geoObject: null,
  symbology: null,
  minimumZoom: null,
  maximumZoom: null,
  zoomToPointInKM: 5,
  worldBaseMap: { id: 1, code: 'OpenStreetMap', label: 'OpenStreetMap' },
  crs: { id: 2, code: 'EPSG:3857', label: 'Web Mercator' },
  layers: [{ id: 20, recordId: 20, title: 'Query', order: 1, visible: true }]
};

const mapLayerFixture = {
  format: 'heurist-map-layer',
  version: 1,
  id: 20,
  title: 'Query',
  description: '',
  visible: true,
  selectable: true,
  source: { type: 'heurist-query', recordId: 20, title: 'Query', query: { t: 10 } },
  style: { type: 'simple', symbol: {}, thematic: null },
  timeline: { enabled: false, fields: [] },
  options: {}
};

test('HeuristApiClient builds a database-scoped map URL', async () => {
  let requestedUrl;
  const client = new HeuristApiClient({
    apiBaseUrl: 'https://example.test/heurist/api',
    database: 'demo db',
    fetchImpl: async (url) => {
      requestedUrl = url;
      return jsonResponse({ type: 'FeatureCollection', features: [], meta: {} });
    }
  });

  await client.get('/map', { query: { q: { t: 10 }, simplify: false } });
  const url = new URL(requestedUrl);
  assert.equal(url.pathname, '/heurist/api/demo%20db/map');
  assert.equal(url.searchParams.get('q'), JSON.stringify({ t: 10 }));
});

test('MapDocumentProvider validates and normalizes the response', async () => {
  const provider = new MapDocumentProvider({
    apiClient: { get: async () => mapDocumentFixture }
  });
  const document = await provider.getById(123);
  assert.equal(document.id, 123);
  assert.equal(document.layers[0].order, 1);
});

test('MapLayerProvider validates the public layer response', async () => {
  const provider = new MapLayerProvider({
    apiClient: { get: async () => mapLayerFixture }
  });
  const layer = await provider.getById(20);
  assert.equal(layer.source.type, 'heurist-query');
  assert.equal(layer.timeline.enabled, false);
});

test('QueryGeoDataProvider merges paginated GeoJSON', async () => {
  const calls = [];
  const provider = new QueryGeoDataProvider({
    apiClient: {
      get: async (path, options) => {
        calls.push(options.query.offset);
        const offset = options.query.offset;
        return {
          type: 'FeatureCollection',
          features: offset === 0 ? [{ type: 'Feature', properties: {}, geometry: null }] : [],
          meta: { total: 1, offset, limit: 1 }
        };
      }
    }
  });

  const result = await provider.searchAll({ query: 't:10', limit: 1 });
  assert.equal(result.features.length, 1);
  assert.deepEqual(calls, [0]);
});


test('MapApplication loads referenced query layers in document order', async () => {
  const added = [];
  const engine = {
    async initialize() {},
    async destroy() {},
    async addLayer(layer) { added.push(layer.id); return { id: layer.id }; },
    async fitBounds() {},
    getCapabilities() { return {}; },
    async removeLayer() {},
    async setLayerVisibility() {},
    async setView() {},
    async invalidateSize() {},
    getViewState() { return {}; }
  };
  const document = {
    ...mapDocumentFixture,
    layers: [
      { id: 30, recordId: 30, title: 'Second', order: 2, visible: true },
      { id: 20, recordId: 20, title: 'First', order: 1, visible: true }
    ]
  };
  const layerFor = (id) => ({
    ...mapLayerFixture,
    id,
    title: `Layer ${id}`,
    source: { ...mapLayerFixture.source, recordId: id, query: `id:${id}` }
  });

  const application = new MapApplication({
    container: new EventTarget(),
    config: {
      mapDocument: mapDocumentFixture,
      apiBaseUrl: '/heurist/api',
      database: 'demo',
      readonly: true
    },
    mapEngine: engine,
    host: { async initialize() {}, async destroy() {}, supportsEditing() { return false; } },
    providers: {
      mapDocument: { getById: async () => document },
      mapLayer: { getById: async (id) => layerFor(id) },
      queryGeoData: {
        searchAll: async () => ({ type: 'FeatureCollection', features: [], meta: {} })
      }
    }
  });

  await application.initialize();
  await application.loadMapDocument(123);
  assert.deepEqual(added, [20, 30]);
});

test('QueryGeoDataProvider forwards request cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  const provider = new QueryGeoDataProvider({
    apiClient: { get: async () => { throw new Error('must not be called'); } }
  });

  await assert.rejects(
    provider.searchAll({ query: 't:10', signal: controller.signal }),
    (error) => error.name === 'AbortError'
  );
});

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
