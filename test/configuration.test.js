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

test('map configuration defaults contain agreed large-dataset options', () => {
  const value = createMapConfigurationDefaults();
  assert.equal(value.config.currentResultsLayer.options.maxAllowedFeatures, 1000);
  assert.equal(value.config.currentResultsLayer.options.dynamicRequests, false);
  assert.equal(value.config.currentResultsLayer.options.markerClustering, false);
});

test('configuration normalization strips runtime and unknown properties', () => {
  const value = normalizeMapConfigurationSettings({
    options: {
      database: 'secret-db',
      accessToken: 'secret',
      ui: { enabled: false, showLegend: false, unknown: 1 },
      interaction: { selectionEnabled: false }
    },
    config: {
      dynamicDocument: { title: 'Search', id: 'do-not-persist' },
      currentResultsLayer: {
        id: 'do-not-persist',
        options: { maxAllowedFeatures: 2500, dynamicRequests: true }
      }
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
  assert.equal(value.config.dynamicDocument.title, 'Search');
  assert.equal(value.config.currentResultsLayer.id, undefined);
  assert.equal(value.config.currentResultsLayer.options.maxAllowedFeatures, 2500);
  assert.equal(value.config.currentResultsLayer.options.dynamicRequests, true);
});

test('configuration normalization preserves native zoom zero and null km limits', () => {
  const value = normalizeMapConfigurationSettings({
    config: {
      dynamicDocument: { minZoom: 0, maxZoom: 18 },
      currentResultsLayer: { options: { minZoom: 0, maximumZoomKm: null } }
    }
  });
  assert.equal(value.config.dynamicDocument.minZoom, 0);
  assert.equal(value.config.dynamicDocument.maxZoom, 18);
  assert.equal(value.config.currentResultsLayer.options.minZoom, 0);
  assert.equal(value.config.currentResultsLayer.options.maximumZoomKm, null);
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
      config: { currentResultsLayer: { options: { maxAllowedFeatures: 500 } } }
    }
  });
  const value = dialog.getValue();
  assert.deepEqual(value.options.mapDocuments.allowed, [12, 14]);
  assert.equal(value.config.currentResultsLayer.options.maxAllowedFeatures, 500);
  assert.equal(dialog.mode, 'website');
  assert.equal(dialog.serialize().format, 'heurist-map-settings');
});
