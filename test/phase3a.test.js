/**
 * phase3a.test.js - Phase 3A automated tests
 *
 * @fileOverview Tests symbol normalization, feature metadata normalization, generated IDs, and layer loader registry behavior.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

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

import { ImageLayerLoader } from '../src/layers/loaders/ImageLayerLoader.js';
import {
  createImageFilterCss,
  normalizeImageFilter,
  normalizeOpacity
} from '../src/symbology/normalizeImageFilter.js';

test('normalizes image opacity from fractions and percentages', () => {
  assert.equal(normalizeOpacity(0.65), 0.65);
  assert.equal(normalizeOpacity('65'), 0.65);
  assert.equal(normalizeOpacity(100), 1);
  assert.equal(normalizeOpacity(0), 0);
});

test('normalizes image filters and supplies missing CSS units', () => {
  const filter = normalizeImageFilter({
    blur: 10,
    brightness: '3',
    opacity: 75,
    'hue-rotate': 360,
    unsupported: 'ignored'
  });

  assert.deepEqual(filter, {
    blur: '10px',
    brightness: '3',
    'hue-rotate': '360deg'
  });
  assert.equal(
    createImageFilterCss(filter),
    'blur(10px) brightness(3) hue-rotate(360deg)'
  );
});

test('loads an image source as an engine-neutral runtime layer', async () => {
  const loader = new ImageLayerLoader();
  const runtime = await loader.load({
    id: 501,
    title: 'Sydney Satellite',
    description: '',
    visible: true,
    source: {
      type: 'image',
      url: 'https://example.test/image.jpg',
      bounds: {
        minx: 151.11488376,
        miny: -33.93908829,
        maxx: 151.3212204,
        maxy: -33.74375321
      }
    },
    style: {
      symbol: {
        opacity: 75,
        blur: '10px',
        contrast: '3'
      }
    },
    options: {}
  }, {
    reference: { recordId: 501, order: 2 }
  });

  assert.equal(runtime.id, 'map-layer-501');
  assert.equal(runtime.type, 'image');
  assert.equal(runtime.opacity, 0.75);
  assert.deepEqual(runtime.bounds, {
    west: 151.11488376,
    south: -33.93908829,
    east: 151.3212204,
    north: -33.74375321
  });
  assert.deepEqual(runtime.imageFilter, {
    blur: '10px',
    contrast: '3'
  });
});
