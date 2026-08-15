import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/core/MapApplication.js', import.meta.url), 'utf8');

test('published layer state restores visibility before theme and opacity', () => {
  const start = source.indexOf('async restoreMapState(state = {})');
  assert.ok(start >= 0);
  const visible = source.indexOf('if (Array.isArray(state.visibleLayerIds))', start);
  const themes = source.indexOf("if (state.activeThemes && typeof state.activeThemes === 'object')", start);
  const opacity = source.indexOf("if (state.layerOpacities && typeof state.layerOpacities === 'object')", start);
  assert.ok(visible > start);
  assert.ok(themes > visible);
  assert.ok(opacity > themes);
});

test('default symbology explicitly clears a source thematic map', () => {
  const start = source.indexOf("if (state.activeThemes && typeof state.activeThemes === 'object')");
  const end = source.indexOf("if (state.layerOpacities && typeof state.layerOpacities === 'object')", start);
  const block = source.slice(start, end);
  assert.match(block, /Number\.isInteger\(index\) && index >= 0 \? index : null/);
});

test('explicit MapDocument basemap is registered even outside configured allowed basemaps', () => {
  assert.match(source, /ensureDocumentBaseMap\(reference\)/);
  assert.match(source, /provider:\s*code/);
  assert.match(source, /this\.baseMaps\.set\(id, clonePlain\(definition\)\)/);
});

test('published theme and opacity state resolve serialized layer ids to runtime keys', () => {
  const start = source.indexOf('async restoreMapState(state = {})');
  const themes = source.indexOf("if (state.activeThemes && typeof state.activeThemes === 'object')", start);
  const opacity = source.indexOf("if (state.layerOpacities && typeof state.layerOpacities === 'object')", themes);
  const basemap = source.indexOf('// Restore the published basemap', opacity);
  const themeBlock = source.slice(themes, opacity);
  const opacityBlock = source.slice(opacity, basemap);

  assert.match(themeBlock, /const runtimeLayerId = this\.findRuntimeLayerKey\(layerId\)/);
  assert.match(themeBlock, /this\.layers\.has\(runtimeLayerId\)/);
  assert.match(themeBlock, /setLayerTheme\(runtimeLayerId,/);
  assert.match(opacityBlock, /const runtimeLayerId = this\.findRuntimeLayerKey\(layerId\)/);
  assert.match(opacityBlock, /this\.layers\.has\(runtimeLayerId\)/);
  assert.match(opacityBlock, /setLayerOpacity\(runtimeLayerId, opacity\)/);
});
