/**
 * mapConfigurationSchema.js - Allowlist, normalization, and serialization for user map settings
 *
 * Only safe, persisted presentation values belong here. Runtime connection
 * values (database, API URL, access token, request headers, callbacks, etc.)
 * are intentionally discarded.
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */

import { createMapConfigurationDefaults } from './mapConfigurationDefaults.js';

export const MAP_CONFIGURATION_FORMAT = 'heurist-map-settings';
export const MAP_CONFIGURATION_VERSION = 1;
export const MAP_CONFIGURATION_MODES = Object.freeze(['preferences', 'website', 'publish']);

/**
 * Normalize and allowlist a pair of persisted map configuration objects.
 * Unknown properties are intentionally removed.
 */
export function normalizeMapConfigurationSettings(value = {}) {
  const defaults = createMapConfigurationDefaults();
  const source = unwrapSettings(value);
  const options = source.options || {};
  const config = source.config || {};

  return {
    options: normalizeOptions(options, defaults.options),
    config: normalizeConfig(config, defaults.config)
  };
}

/** Produce the versioned JSON-safe settings envelope. */
export function serializeMapConfigurationSettings(value = {}) {
  const normalized = normalizeMapConfigurationSettings(value);
  return {
    format: MAP_CONFIGURATION_FORMAT,
    version: MAP_CONFIGURATION_VERSION,
    options: normalized.options,
    config: normalized.config
  };
}

/** Validate/normalize a dialog mode. */
export function normalizeMapConfigurationMode(value) {
  const mode = String(value || 'preferences').toLowerCase();
  return MAP_CONFIGURATION_MODES.includes(mode) ? mode : 'preferences';
}

function unwrapSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  if (value.format === MAP_CONFIGURATION_FORMAT && Number(value.version) === MAP_CONFIGURATION_VERSION) {
    return value;
  }
  return value;
}

function normalizeOptions(source, defaults) {
  const ui = source.ui || {};
  const documents = source.mapDocuments || {};
  const baseMaps = source.baseMaps || {};
  const interaction = source.interaction || {};

  return {
    ui: {
      enabled: boolean(ui.enabled, defaults.ui.enabled),
      placement: enumValue(ui.placement, ['overlay', 'side'], defaults.ui.placement),
      position: enumValue(ui.position, ['top-left', 'top-right', 'bottom-left', 'bottom-right'], defaults.ui.position),
      initiallyExpanded: boolean(ui.initiallyExpanded, defaults.ui.initiallyExpanded),
      showCurrentDocument: boolean(ui.showCurrentDocument, defaults.ui.showCurrentDocument),
      showMapDocuments: boolean(ui.showMapDocuments, defaults.ui.showMapDocuments),
      showLayers: boolean(ui.showLayers, defaults.ui.showLayers),
      showBaseMaps: boolean(ui.showBaseMaps, defaults.ui.showBaseMaps),
      showLegend: boolean(ui.showLegend, defaults.ui.showLegend),
      showZoomControl: boolean(ui.showZoomControl, defaults.ui.showZoomControl),
      showSearch: boolean(ui.showSearch, defaults.ui.showSearch),
      showPublish: boolean(ui.showPublish, defaults.ui.showPublish),
      controlCss: nullableString(ui.controlCss)
    },
    mapDocuments: {
      allowed: nullableList(documents.allowed, { numeric: true }),
      initiallyActive: documents.initiallyActive === undefined
        ? defaults.mapDocuments.initiallyActive
        : nullableIdentifier(documents.initiallyActive, { numeric: true, allowDynamic: true })
    },
    baseMaps: {
      allowed: nullableList(baseMaps.allowed),
      initial: nullableIdentifier(baseMaps.initial)
    },
    interaction: {
      selectionEnabled: boolean(interaction.selectionEnabled, defaults.interaction.selectionEnabled),
      popupEnabled: boolean(interaction.popupEnabled, defaults.interaction.popupEnabled),
      zoomOnSelection: boolean(interaction.zoomOnSelection, defaults.interaction.zoomOnSelection)
    }
  };
}

function normalizeConfig(source, defaults) {
  const configuredDefaults = source.defaults || {};
  const document = source.dynamicDocument || {};

  return {
    defaults: {
      zoomToPointInKM: nullablePositiveNumber(configuredDefaults.zoomToPointInKM),
      symbology: nullableJsonObject(configuredDefaults.symbology),
      selectSymbology: nullableJsonObject(configuredDefaults.selectSymbology),
      preventContinuousWorldBasemap: boolean(
        configuredDefaults.preventContinuousWorldBasemap,
        defaults.defaults.preventContinuousWorldBasemap
      ),
      markerClustering: boolean(configuredDefaults.markerClustering, defaults.defaults.markerClustering),
      maxAllowedFeatures: allowedFeatureLimit(
        configuredDefaults.maxAllowedFeatures,
        defaults.defaults.maxAllowedFeatures
      ),
      dynamicRequests: boolean(configuredDefaults.dynamicRequests, defaults.defaults.dynamicRequests),
      popupTemplate: nullableString(configuredDefaults.popupTemplate)
    },
    dynamicDocument: {
      enabled: boolean(document.enabled, defaults.dynamicDocument.enabled),
      title: stringValue(document.title, defaults.dynamicDocument.title),
      minZoom: nullableZoom(document.minZoom),
      maxZoom: nullableZoom(document.maxZoom),
      minimumZoomKm: nullablePositiveNumber(document.minimumZoomKm),
      maximumZoomKm: nullablePositiveNumber(document.maximumZoomKm),
      bounds: normalizeBounds(document.bounds)
    }
  };
}

function boolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function stringValue(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value) {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' ? value : String(value);
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullablePositiveNumber(value) {
  const number = nullableNumber(value);
  return number !== null && number > 0 ? number : null;
}

function nullableZoom(value) {
  const number = nullableNumber(value);
  return number !== null && number >= 0 && number <= 22 ? number : null;
}

function allowedFeatureLimit(value, fallback) {
  const number = Number(value);
  return [500, 1000, 2000, 5000].includes(number) ? number : fallback;
}

function nullableIdentifier(value, { numeric = false, allowDynamic = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (allowDynamic && String(value) === 'dynamic') return 'dynamic';
  if (!numeric) return String(value);
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nullableList(value, { numeric = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (!Array.isArray(value)) return null;
  const result = [];
  for (const item of value) {
    const normalized = nullableIdentifier(item, { numeric });
    if (normalized !== null && !result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function normalizeBounds(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const west = nullableNumber(value.west);
  const south = nullableNumber(value.south);
  const east = nullableNumber(value.east);
  const north = nullableNumber(value.north);
  if ([west, south, east, north].some((item) => item === null)) return null;
  return { west, south, east, north };
}

function nullableJsonObject(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return clone(value);
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
