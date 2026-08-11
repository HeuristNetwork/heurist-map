/**
 * mapConfig.js - Bootstrap configuration normalization
 *
 * Consumes one bootstrap contract: { runtime, settings, state }.
 * Runtime transport/host values are deliberately separate from persisted map
 * settings. Basemap definitions and application mechanics are internal.
 *
 * @project     Heurist mapping application
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { normalizeMapDocument } from './core/MapDocument.js';
import { normalizeMapConfigurationSettings } from './ui/config/mapConfigurationSchema.js';

const BUILT_IN_BASE_MAPS = Object.freeze([
  Object.freeze({
    id: 'OpenStreetMap',
    title: 'OpenStreetMap',
    type: 'tile',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }),
  Object.freeze({ id: 'None', title: 'None', type: 'none' })
]);

/**
 * Return normalized application configuration from the single bootstrap object.
 * Missing settings are filled entirely from canonical configuration defaults.
 */
export function getHeuristMapConfig() {
  const url = new URL(globalThis.location?.href || 'http://localhost/');
  const bridge = getHostBridge();
  const bootstrap = bridge?.getConfiguration?.() || getStandaloneBootstrap();
  const runtime = bootstrap?.runtime || {};
  const settings = normalizeMapConfigurationSettings(bootstrap?.settings || {});
  const state = bootstrap?.state ?? null;

  const documentQuery = parseDocumentQuery(url.searchParams.get('doc'));
  const configuredDefaultDocumentId = settings.options.mapDocuments.initiallyActive;
  const defaultDocumentId = configuredDefaultDocumentId == null ? 'dynamic' : configuredDefaultDocumentId;
  const preventContinuousWorldBasemap = settings.config.defaults.preventContinuousWorldBasemap;

  return {
    viewerMode: runtime.viewerMode === 'configuration' ? 'configuration' : 'map',
    configurationMode: runtime.configurationMode || 'website',

    // Application mechanics are internal constants rather than bootstrap options.
    containerId: 'heurist-map',
    engine: 'leaflet',
    readonly: true,

    apiBaseUrl: runtime.apiBaseUrl || null,
    database: runtime.database || null,
    accessToken: runtime.accessToken || null,
    requestHeaders: runtime.requestHeaders || {},
    host: buildHostConfiguration(runtime, bridge),

    persistedSettings: settings,
    initialState: state,

    // MapDocuments are controlled only by persisted settings. The optional
    // standalone ?doc= URL parameter remains a convenient explicit startup filter.
    documents: {
      query: settings.options.mapDocuments.allowed ?? documentQuery ?? null,
      initiallyActive: defaultDocumentId
    },

    defaults: settings.config.defaults,

    dynamicDocument: {
      enabled: settings.config.dynamicDocument.enabled,
      id: 'dynamic',
      title: String(settings.config.dynamicDocument.title || 'Current results'),
      minZoom: settings.config.dynamicDocument.minZoom,
      maxZoom: settings.config.dynamicDocument.maxZoom,
      minimumZoomKm: settings.config.dynamicDocument.minimumZoomKm,
      maximumZoomKm: settings.config.dynamicDocument.maximumZoomKm,
      bounds: settings.config.dynamicDocument.bounds,
      dynamicRequests: settings.config.dynamicDocument.dynamicRequests === true,
      keepContent: true,
      layers: []
    },

    // Basemap definitions come from the built-in catalog; settings only filter
    // the catalog and select its initial item. Continuous-world behavior is a
    // global default even though it affects the map engine rather than layers.
    baseMaps: normalizeBaseMaps(settings.options.baseMaps, preventContinuousWorldBasemap),
    interaction: settings.options.interaction,
    ui: {
      ...settings.options.ui,
      // Internal Map Control defaults that are not persisted configuration.
      showOptions: true,
      showScaleControl: true,
      showHomeControl: true,
      baseMapsInitiallyExpanded: true,
      maxHeight: '70vh'
    },

    // Internal mutable representation of the currently rendered MapDocument.
    // It is intentionally not part of heuristMapBootstrap.
    mapDocument: normalizeMapDocument({})
  };
}

function getHostBridge() {
  try {
    if (globalThis.frameElement?.heuristMapHost) {
      return globalThis.frameElement.heuristMapHost;
    }
  } catch {
    // Cross-origin embedding cannot use the direct bridge.
  }
  return null;
}

/**
 * Standalone bootstrap. Standalone callers define window.heuristMapBootstrap
 * using the same { runtime, settings, state } contract as mapViewer.
 */
function getStandaloneBootstrap() {
  const bootstrap = globalThis.heuristMapBootstrap;
  if (bootstrap && typeof bootstrap === 'object') {
    return {
      runtime: bootstrap.runtime && typeof bootstrap.runtime === 'object'
        ? bootstrap.runtime
        : {},
      settings: bootstrap.settings && typeof bootstrap.settings === 'object'
        ? bootstrap.settings
        : null,
      state: bootstrap.state ?? null
    };
  }

  return { runtime: {}, settings: null, state: null };
}

/** Build Heurist internal host persistence only when a Heurist base URL exists. */
function buildHostConfiguration(runtime, bridge) {
  if (!runtime?.baseUrl) return null;
  return {
    type: 'heurist',
    baseUrl: runtime.baseUrl,
    database: runtime.database || null,
    bridge: bridge || null
  };
}

function parseDocumentQuery(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return /^\d+(?:,\d+)*$/.test(text) ? text.split(',').map(Number) : text;
}

function normalizeBaseMaps(settings = {}, preventContinuousWorldBasemap = false) {
  let result = BUILT_IN_BASE_MAPS.map((item) => ({ ...item }));
  if (Array.isArray(settings.allowed)) {
    const allowed = new Set(settings.allowed.map(String));
    result = result.filter((item) => allowed.has(String(item.id)));
  }
  if (preventContinuousWorldBasemap) {
    result = result.map((item) => item.type === 'tile' ? { ...item, noWrap: true } : item);
  }
  if (settings.initial != null) {
    const index = result.findIndex((item) => String(item.id) === String(settings.initial));
    if (index > 0) result = [result[index], ...result.slice(0, index), ...result.slice(index + 1)];
  }
  return result;
}
