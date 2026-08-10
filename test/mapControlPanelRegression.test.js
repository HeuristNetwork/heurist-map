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

test('zoom-to-layer action is available but remains hover/focus-only', () => {
  assert.match(layerItemSource, /heurist-map-layer-zoom-action/);
  assert.doesNotMatch(cssSource, /not\(\.heurist-map-layer-zoom-action\)/);
  assert.match(cssSource, /heurist-map-row-actions[^}]*opacity:0/);
});

test('control-only mode removes title-toggle footprint and sizes to buttons', () => {
  assert.match(panelSource, /classList\.add\('controls-only'\)/);
  assert.match(cssSource, /\.heurist-map-control-panel\.controls-only\{[\s\S]*?width:auto/);
  assert.match(cssSource, /\.heurist-map-panel-header\{[\s\S]*?box-sizing:border-box/);
});


test('Map Control custom CSS supports declarations and complete CSS rules', () => {
  assert.match(panelSource, /applyControlCss\(\)/);
  assert.match(panelSource, /if \(!css\.includes\('\{'\)\)/);
  assert.match(panelSource, /style\.textContent = css/);
  assert.match(panelSource, /controlCssStyle\?\.remove\(\)/);
});

test('configuration dialog keeps Interface first and uses flat Default settings layout', async () => {
  const dialogSource = await readFile(new URL('../src/ui/config/MapConfigurationDialog.js', import.meta.url), 'utf8');
  const interfaceIndex = dialogSource.indexOf("this.section('Interface'");
  const currentResultsIndex = dialogSource.indexOf("this.section('Current Results Map'");
  assert.ok(interfaceIndex >= 0 && currentResultsIndex > interfaceIndex);
  assert.doesNotMatch(dialogSource, /legend\('Map defaults'\)|legend\('Layer defaults'\)/);
  assert.match(dialogSource, /heurist-map-config-inline-number/);
});
