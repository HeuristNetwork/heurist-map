import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMapSymbol } from '../src/symbology/normalizeMapSymbol.js';
import { normalizeGeoJson } from '../src/metadata/normalizeGeoJson.js';
import { LayerLoaderRegistry } from '../src/layers/LayerLoaderRegistry.js';

test('normalizes simple symbol defaults', () => {
  const symbol = normalizeMapSymbol({ color: '#000', opacity: 2, radius: -1 });
  assert.equal(symbol.color, '#000');
  assert.equal(symbol.opacity, 1);
  assert.equal(symbol.radius, 6);
});

test('normalizes Heurist and external feature metadata', () => {
  const result = normalizeGeoJson({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { rec_ID: 123, rec_Title: 'Record title' }, geometry: null },
      { type: 'Feature', properties: { name: 'External feature' }, geometry: null }
    ]
  }, { layerId: 'layer-a', sourceType: 'remote-geojson' });

  assert.equal(result.features[0].id, 'record-123-feature-1');
  assert.equal(result.features[0].properties.heurist.recordId, 123);
  assert.equal(result.features[1].id, 'layer-a-feature-2');
  assert.equal(result.features[1].properties.heurist.title, 'External feature');
});

test('layer loader registry rejects unknown source types', async () => {
  const registry = new LayerLoaderRegistry();
  await assert.rejects(
    registry.load({ source: { type: 'shp' } }, {}),
    /not supported/
  );
});
