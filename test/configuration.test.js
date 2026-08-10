import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAP_CONFIGURATION_FORMAT,
  MAP_CONFIGURATION_VERSION,
  normalizeMapConfigurationSettings,
  serializeMapConfigurationSettings
} from '../src/ui/config/mapConfigurationSchema.js';
import { createMapConfigurationDefaults } from '../src/ui/config/mapConfigurationDefaults.js';
import { MapConfigurationDialog } from '../src/ui/config/MapConfigurationDialog.js';

test('map configuration defaults contain agreed global fallback settings', () => {
  const value = createMapConfigurationDefaults();
  assert.equal(value.config.defaults.maxAllowedFeatures, 1000);
  assert.equal(value.config.defaults.dynamicRequests, false);
  assert.equal(value.config.defaults.markerClustering, false);
  assert.equal(value.config.defaults.preventContinuousWorldBasemap, false);
  assert.equal(value.config.defaults.symbology, null);
  assert.equal(value.options.mapDocuments.initiallyActive, null);
  assert.equal(value.config.dynamicDocument.enabled, true);
  assert.equal(value.config.currentResultsLayer, undefined);
  assert.equal(value.config.dynamicDocument.initiallyActive, undefined);
  assert.equal(value.options.ui.controlCss, null);
  assert.equal(value.options.interaction.zoomOnSelection, false);
});

test('configuration normalization strips runtime, obsolete, and unknown properties', () => {
  const value = normalizeMapConfigurationSettings({
    options: {
      database: 'secret-db',
      accessToken: 'secret',
      ui: { enabled: false, showLegend: false, unknown: 1 },
      interaction: { selectionEnabled: false }
    },
    config: {
      defaults: { maxAllowedFeatures: 2500, dynamicRequests: true, unknown: 1 },
      dynamicDocument: { title: 'Search', id: 'do-not-persist', initiallyActive: true },
      currentResultsLayer: { options: { maxAllowedFeatures: 500 } }
    },
    callbacks: { onSave() {} }
  });

  assert.equal(value.options.database, undefined);
  assert.equal(value.options.accessToken, undefined);
  assert.equal(value.options.ui.unknown, undefined);
  assert.equal(value.options.ui.enabled, false);
  assert.equal(value.options.ui.showLegend, false);
  assert.equal(value.options.interaction.selectionEnabled, false);
  assert.equal(value.config.dynamicDocument.id, undefined);
  assert.equal(value.config.dynamicDocument.initiallyActive, undefined);
  assert.equal(value.config.dynamicDocument.title, 'Search');
  assert.equal(value.config.currentResultsLayer, undefined);
  assert.equal(value.config.defaults.unknown, undefined);
  assert.equal(value.config.defaults.maxAllowedFeatures, 1000);
  assert.equal(value.config.defaults.dynamicRequests, true);
});

test('dynamic document zoom settings remain document-specific; global defaults normalize independently', () => {
  const value = normalizeMapConfigurationSettings({
    config: {
      defaults: {
        zoomToPointInKM: 5,
        selectSymbology: { color: '#f00' },
        preventContinuousWorldBasemap: true
      },
      dynamicDocument: { minZoom: 0, maxZoom: 18, minimumZoomKm: null, maximumZoomKm: null }
    }
  });
  assert.equal(value.config.dynamicDocument.minZoom, 0);
  assert.equal(value.config.dynamicDocument.maxZoom, 18);
  assert.equal(value.config.dynamicDocument.minimumZoomKm, null);
  assert.equal(value.config.dynamicDocument.maximumZoomKm, null);
  assert.equal(value.config.defaults.zoomToPointInKM, 5);
  assert.deepEqual(value.config.defaults.selectSymbology, { color: '#f00' });
  assert.equal(value.config.defaults.preventContinuousWorldBasemap, true);
});

test('configuration serializer creates versioned settings envelope', () => {
  const value = serializeMapConfigurationSettings({
    options: { baseMaps: { allowed: ['OpenStreetMap', 'None'], initial: 'None' } }
  });
  assert.equal(value.format, MAP_CONFIGURATION_FORMAT);
  assert.equal(value.version, MAP_CONFIGURATION_VERSION);
  assert.deepEqual(value.options.baseMaps.allowed, ['OpenStreetMap', 'None']);
  assert.equal(value.options.baseMaps.initial, 'None');
});

test('configuration dialog can be used as a persistence-neutral value object before opening', () => {
  const dialog = new MapConfigurationDialog({
    mode: 'website',
    value: {
      options: { mapDocuments: { allowed: [12, 14] } },
      config: { defaults: { maxAllowedFeatures: 500 } }
    }
  });
  const value = dialog.getValue();
  assert.deepEqual(value.options.mapDocuments.allowed, [12, 14]);
  assert.equal(value.config.defaults.maxAllowedFeatures, 500);
  assert.equal(dialog.mode, 'website');
  assert.equal(dialog.serialize().format, 'heurist-map-settings');
});

test('configuration zoom limits are restricted to Leaflet 0-22 range', () => {
  const value = normalizeMapConfigurationSettings({
    config: { dynamicDocument: { minZoom: -1, maxZoom: 23 } }
  });
  assert.equal(value.config.dynamicDocument.minZoom, null);
  assert.equal(value.config.dynamicDocument.maxZoom, null);
});

test('maximum allowed features accepts only configured choices', () => {
  for (const limit of [500, 1000, 2000, 5000]) {
    const value = normalizeMapConfigurationSettings({ config: { defaults: { maxAllowedFeatures: limit } } });
    assert.equal(value.config.defaults.maxAllowedFeatures, limit);
  }
});
