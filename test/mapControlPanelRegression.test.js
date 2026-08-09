import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panelSource = await readFile(new URL('../src/ui/MapControlPanel.js', import.meta.url), 'utf8');
const layerPanelSource = await readFile(new URL('../src/ui/LayerPanel.js', import.meta.url), 'utf8');
const layerItemSource = await readFile(new URL('../src/ui/LayerPanelItem.js', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

test('current-results document panel is independent from persisted MapDocument visibility', () => {
  assert.match(panelSource, /showCurrentDocument !== false \|\| this\.options\.showMapDocuments !== false/);
  assert.match(panelSource, /item\.persistent === false\) return this\.options\.showCurrentDocument !== false/);
  assert.match(panelSource, /return this\.options\.showMapDocuments !== false/);
});

test('empty layer panel reports loading while a MapDocument is activating', () => {
  assert.match(panelSource, /documentActivating = allDocuments\.some/);
  assert.match(layerPanelSource, /loading \? 'Loading\.\.\.' : 'No layers'/);
});

test('zoom-to-layer action stays visible without exposing all layer actions', () => {
  assert.match(layerItemSource, /heurist-map-layer-zoom-action/);
  assert.match(cssSource, /not\(\.heurist-map-layer-zoom-action\)/);
});

test('control-only mode removes title-toggle footprint and sizes to buttons', () => {
  assert.match(panelSource, /classList\.add\('controls-only'\)/);
  assert.match(cssSource, /\.heurist-map-control-panel\.controls-only\{[\s\S]*?width:auto/);
  assert.match(cssSource, /\.heurist-map-panel-header\{[\s\S]*?box-sizing:border-box/);
});
