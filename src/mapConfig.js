/**
 * mapConfig.js - Bootstrap configuration normalization
 *
 * Consumes one bootstrap contract: { runtime, settings, state, mapDocument }.
 * Runtime transport/host values are deliberately separate from persisted map
 * settings so configuration precedence is resolved only once by the host.
 *
 * @project     Heurist mapping application
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { normalizeMapDocument } from './core/MapDocument.js';
import { normalizeMapConfigurationSettings } from './ui/config/mapConfigurationSchema.js';

/**
 * Return normalized application configuration from the single bootstrap object.
 * No preference/widget precedence merge is performed here.
 */
export function getHeuristMapConfig() {
  const url = new URL(globalThis.location?.href || 'http://localhost/');
  const bridge = getHostBridge();
  const bootstrap = bridge?.getConfiguration?.() || getStandaloneBootstrap();
  const runtime = bootstrap?.runtime || {};
  const published = globalThis.heuristMapPublished || null;
  const settings = normalizeMapConfigurationSettings(
    bootstrap?.settings || (published ? { options: published.options, config: published.config } : {})
  );
  const state = bootstrap?.state ?? published?.state ?? null;
  const mapDocument = normalizeMapDocument(
    bootstrap?.mapDocument || globalThis.heuristMapConfig || {}
  );

  const documentQuery = parseDocumentQuery(url.searchParams.get('doc'));
  const configuredDefaultDocumentId = settings.options.mapDocuments.initiallyActive;
  const defaultDocumentId = configuredDefaultDocumentId == null ? 'dynamic' : configuredDefaultDocumentId;
  const preventContinuousWorldBasemap = settings.config.dynamicDocument.preventContinuousWorldBasemap;
  const runtimeDocuments = runtime.documents || {};
  const uiRuntime = runtime.uiRuntime || {};

  return {
    viewerMode: runtime.viewerMode === 'configuration' ? 'configuration' : 'map',
    configurationMode: runtime.configurationMode || 'website',
    containerId: runtime.containerId || 'heurist-map',
    engine: runtime.engine || 'leaflet',
    readonly: runtime.readonly !== false,
    apiBaseUrl: runtime.apiBaseUrl || null,
    serverUrl: runtime.serverUrl || null,
    database: runtime.database || null,
    accessToken: runtime.accessToken || null,
    requestHeaders: runtime.requestHeaders || {},
    host: buildHostConfiguration(runtime.host, runtime.database, bridge),
    persistedSettings: settings,
    initialState: state,
    documents: {
      query: settings.options.mapDocuments.allowed ?? runtimeDocuments.query ?? documentQuery ?? null,
      autoLoad: runtimeDocuments.autoLoad !== false,
      activateFirst: runtimeDocuments.activateFirst !== false,
      initiallyActive: defaultDocumentId
    },
    dynamicDocument: {
      enabled: settings.config.dynamicDocument.enabled,
      id: 'dynamic',
      title: String(settings.config.dynamicDocument.title || 'Dynamic map'),
      initiallyActive: defaultDocumentId === 'dynamic',
      selectSymbology: settings.config.dynamicDocument.selectSymbology,
      preventContinuousWorldBasemap,
      keepContent: true,
      layers: []
    },
    baseMaps: normalizeBaseMaps(runtime.baseMaps?.available, settings.options.baseMaps, preventContinuousWorldBasemap),
    currentResultsLayer: settings.config.currentResultsLayer,
    interaction: settings.options.interaction,
    ui: {
      ...settings.options.ui,
      showOptions: uiRuntime.showOptions !== false,
      showScaleControl: uiRuntime.showScaleControl !== false,
      showHomeControl: uiRuntime.showHomeControl !== false,
      baseMapsInitiallyExpanded: uiRuntime.baseMapsInitiallyExpanded !== false,
      maxHeight: uiRuntime.maxHeight || '70vh'
    },
    mapDocument
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
 * Standalone compatibility path. It constructs the same bootstrap shape used by
 * mapViewer, but does not merge host preferences because no host owns them here.
 */
function getStandaloneBootstrap() {
  if (globalThis.heuristMapBootstrap && typeof globalThis.heuristMapBootstrap === 'object') {
    return globalThis.heuristMapBootstrap;
  }

  const legacy = globalThis.heuristMapOptions || {};
  const published = globalThis.heuristMapPublished || null;
  const settings = published
    ? { format: 'heurist-map-settings', version: 1, options: published.options || {}, config: published.config || {} }
    : (legacy.heuristMapSettings || extractLegacySettings(legacy));

  return {
    runtime: {
      viewerMode: legacy.viewerMode,
      configurationMode: legacy.configurationMode,
      containerId: legacy.containerId || legacy.id,
      engine: legacy.engine,
      readonly: legacy.readonly,
      database: legacy.database || legacy.db,
      apiBaseUrl: legacy.apiBaseUrl,
      serverUrl: legacy.serverUrl,
      accessToken: legacy.accessToken,
      requestHeaders: legacy.requestHeaders,
      host: legacy.host,
      documents: {
        query: legacy.documents?.query,
        autoLoad: legacy.documents?.autoLoad,
        activateFirst: legacy.documents?.activateFirst
      },
      baseMaps: {
        available: Array.isArray(legacy.baseMaps)
          ? legacy.baseMaps
          : (Array.isArray(legacy.baseMaps?.available) ? legacy.baseMaps.available : null)
      },
      uiRuntime: {
        showOptions: legacy.ui?.showOptions,
        showScaleControl: legacy.ui?.showScaleControl,
        showHomeControl: legacy.ui?.showHomeControl,
        baseMapsInitiallyExpanded: legacy.ui?.baseMapsInitiallyExpanded,
        maxHeight: legacy.ui?.controlPanelMaxHeight || legacy.ui?.maxHeight
      }
    },
    settings,
    state: published?.state || legacy.initialState || null,
    mapDocument: globalThis.heuristMapConfig || null
  };
}

function extractLegacySettings(source) {
  const options = {};
  const config = {};
  if (source.ui) options.ui = { ...source.ui };
  if (source.mapDocuments) options.mapDocuments = { ...source.mapDocuments };
  if (source.interaction) options.interaction = { ...source.interaction };
  if (source.baseMaps && !Array.isArray(source.baseMaps)) {
    const baseMaps = {};
    if (source.baseMaps.allowed !== undefined) baseMaps.allowed = source.baseMaps.allowed;
    if (source.baseMaps.initial !== undefined) baseMaps.initial = source.baseMaps.initial;
    if (Object.keys(baseMaps).length) options.baseMaps = baseMaps;
  }
  if (source.dynamicDocument) {
    config.dynamicDocument = { ...source.dynamicDocument };
    delete config.dynamicDocument.id;
    delete config.dynamicDocument.keepContent;
    delete config.dynamicDocument.layers;
  }
  if (source.currentResultsLayer) {
    config.currentResultsLayer = { ...source.currentResultsLayer };
    delete config.currentResultsLayer.id;
  }
  return { format: 'heurist-map-settings', version: 1, options, config };
}

function buildHostConfiguration(host, database, bridge) {
  if (!host) return null;
  return {
    ...host,
    database: host.database || database || null,
    bridge: bridge || null
  };
}

function parseDocumentQuery(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return /^\d+(?:,\d+)*$/.test(text) ? text.split(',').map(Number) : text;
}

function normalizeBaseMaps(value, settings = {}, preventContinuousWorldBasemap = false) {
  const defaults = [
    { id: 'OpenStreetMap', title: 'OpenStreetMap', type: 'tile', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 },
    { id: 'None', title: 'None', type: 'none' }
  ];
  let result = Array.isArray(value) && value.length ? value : defaults;
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
