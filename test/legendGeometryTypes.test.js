import test from 'node:test';
import assert from 'node:assert/strict';
import { detectGeometryTypes } from '../src/utils/geometryTypes.js';
import { readFile } from 'node:fs/promises';

const layerItemSource = await readFile(new URL('../src/ui/LayerPanelItem.js', import.meta.url), 'utf8');
const loaderSource = await readFile(new URL('../src/engine/loaders/GeoJsonLayerLoader.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../src/core/MapApplication.js', import.meta.url), 'utf8');
const legendSource = await readFile(new URL('../src/ui/legend/LegendRenderer.js', import.meta.url), 'utf8');

test('geometry family detection handles mixed GeoJSON and GeometryCollection', () => {
  assert.deepEqual(detectGeometryTypes({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [] } },
      { type: 'Feature', geometry: { type: 'GeometryCollection', geometries: [
        { type: 'Polygon', coordinates: [] }
      ] } }
    ]
  }), { point: true, line: true, polygon: true });
});

test('geometry types are computed once by the loader and retained in lightweight runtime state', () => {
  assert.match(loaderSource, /geometryTypes: detectGeometryTypes\(geoJson\)/);
  assert.match(appSource, /geometryTypes: clonePlain\(definition\.geometryTypes \?\? null\)/);
});

test('thematic selector is hidden until layer data has loaded', () => {
  assert.match(layerItemSource, /if \(this\.layer\?\.loadState !== 'loaded'\) return null/);
});

test('legend renders current default or active thematic ranges using geometry-aware samples', () => {
  assert.match(legendSource, /activeTheme = thematic\.find/);
  assert.match(legendSource, /\{ \.\.\.\(activeTheme\.symbol \|\| \{\}\), \.\.\.\(range\?\.symbol \|\| \{\}\) \}/);
  assert.match(legendSource, /if \(types\.point\)/);
  assert.match(legendSource, /if \(types\.line\)/);
  assert.match(legendSource, /if \(types\.polygon\)/);
});
