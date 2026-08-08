/**
 * mapConfig.js - Runtime configuration normalization
 *
 * @fileOverview Reads browser configuration, validates runtime options, and produces the normalized application configuration.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { normalizeMapDocument } from './core/MapDocument.js';
import { normalizeMapConfigurationSettings } from './ui/config/mapConfigurationSchema.js';

/**
 * Read the public MapDocument and separate runtime-only application options.
 *
 * @returns {Object} Application configuration.
 */
export function getHeuristMapConfig() {
  const url = new URL(globalThis.location?.href || 'http://localhost/');
  const hostConfiguration = getHostConfiguration(url.searchParams.get('hostInstance'));
  const mapDocument = normalizeMapDocument(
    hostConfiguration?.mapDocument || window.heuristMapConfig || {}
  );
  const runtime = hostConfiguration?.heuristMapOptions || window.heuristMapOptions || {};
  const published = window.heuristMapPublished || null;
  const persisted = normalizeMapConfigurationSettings(
    published ? { options: published.options, config: published.config } : (runtime.heuristMapSettings || {})
  );
console.log(runtime.heuristMapSettings, persisted);  
  const documentQuery = parseDocumentQuery(url.searchParams.get('doc'));
  const configuredDefaultDocumentId = runtime.documents?.initiallyActive ?? persisted.options.mapDocuments.initiallyActive;
  const defaultDocumentId = configuredDefaultDocumentId == null ? 'dynamic' : configuredDefaultDocumentId;
  const preventContinuousWorldBasemap = runtime.dynamicDocument?.preventContinuousWorldBasemap
    ?? persisted.config.dynamicDocument.preventContinuousWorldBasemap;

  return {
    viewerMode: runtime.viewerMode === 'configuration' ? 'configuration' : 'map',
    configurationMode: runtime.configurationMode || 'website',
    configurationValue: runtime.configurationValue || null,
    containerId: runtime.containerId || runtime.id || 'heurist-map',
    engine: runtime.engine || 'leaflet',
    readonly: runtime.readonly !== false,
    apiBaseUrl: runtime.apiBaseUrl || null,
    serverUrl: runtime.serverUrl || null,
    database: runtime.database || runtime.db || null,
    accessToken: runtime.accessToken || null,
    requestHeaders: runtime.requestHeaders || {},
    host: runtime.host || null,
    persistedSettings: persisted,
    initialState: published?.state || runtime.initialState || null,
    documents: {
      query: runtime.documents?.query ?? persisted.options.mapDocuments.allowed ?? documentQuery ?? null,
      autoLoad: runtime.documents?.autoLoad !== false,
      activateFirst: runtime.documents?.activateFirst !== false,
      initiallyActive: defaultDocumentId
    },
    dynamicDocument: {
      enabled: runtime.dynamicDocument?.enabled ?? persisted.config.dynamicDocument.enabled,
      id: String(runtime.dynamicDocument?.id || 'dynamic'),
      title: String(runtime.dynamicDocument?.title || persisted.config.dynamicDocument.title || 'Dynamic map'),
      initiallyActive: defaultDocumentId === 'dynamic',
      selectSymbology: runtime.dynamicDocument?.selectSymbology ?? persisted.config.dynamicDocument.selectSymbology,
      preventContinuousWorldBasemap,
      keepContent: runtime.dynamicDocument?.keepContent !== false,
      layers: Array.isArray(runtime.dynamicDocument?.layers)
        ? runtime.dynamicDocument.layers.map((item) => ({ ...item }))
        : []
    },
    baseMaps: normalizeBaseMaps(runtime.baseMaps, persisted.options.baseMaps, preventContinuousWorldBasemap),
    currentResultsLayer: persisted.config.currentResultsLayer,
    ui: {
      enabled: runtime.ui?.enabled ?? persisted.options.ui.enabled,
      placement: runtime.ui?.placement || persisted.options.ui.placement || 'overlay',
      containerId: runtime.ui?.containerId || null,
      position: runtime.ui?.position || persisted.options.ui.position || 'top-right',
      initiallyExpanded: runtime.ui?.initiallyExpanded ?? persisted.options.ui.initiallyExpanded,
      showCurrentDocument: runtime.ui?.showCurrentDocument ?? persisted.options.ui.showCurrentDocument,
      showMapDocuments: runtime.ui?.showMapDocuments ?? persisted.options.ui.showMapDocuments,
      showLayers: runtime.ui?.showLayers ?? persisted.options.ui.showLayers,
      showBaseMaps: runtime.ui?.showBaseMaps ?? persisted.options.ui.showBaseMaps,
      showZoomControl: runtime.ui?.showZoomControl ?? persisted.options.ui.showZoomControl,
      showPublish: runtime.ui?.showPublish ?? persisted.options.ui.showPublish,
      controlCss: runtime.ui?.controlCss ?? persisted.options.ui.controlCss,
      showOptions: runtime.ui?.showOptions !== false,
      showScaleControl: runtime.ui?.showScaleControl !== false,
      showHomeControl: runtime.ui?.showHomeControl !== false,
      baseMapsInitiallyExpanded: runtime.ui?.baseMapsInitiallyExpanded !== false,
      maxHeight: runtime.ui?.controlPanelMaxHeight || runtime.ui?.maxHeight || '70vh'
    },
    mapDocument
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


/**
 * Resolve one same-origin wrapper configuration registered by the parent page.
 * The registry entry is consumed once so destroyed/reloaded frames do not retain
 * access tokens or stale runtime options in the host window.
 */
function getHostConfiguration(instanceId) {
  if (!instanceId || globalThis.parent === globalThis) return null;

  try {
    const registry = globalThis.parent.HEURIST_MAP_INSTANCES;
    const configuration = registry?.[instanceId] || null;
    if (configuration) delete registry[instanceId];
    return configuration;
  } catch {
    // Cross-origin frames cannot access the parent registry. A future
    // postMessage-based integration can handle that case.
    return null;
  }
}
