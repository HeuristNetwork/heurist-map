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

import { normalizeMapDocument } from './map-document/MapDocument.js';

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
  const documentQuery = parseDocumentQuery(url.searchParams.get('doc'));

  return {
    containerId: runtime.containerId || runtime.id || 'heurist-map',
    engine: runtime.engine || 'leaflet',
    readonly: runtime.readonly !== false,
    apiBaseUrl: runtime.apiBaseUrl || null,
    serverUrl: runtime.serverUrl || null,
    database: runtime.database || runtime.db || null,
    accessToken: runtime.accessToken || null,
    requestHeaders: runtime.requestHeaders || {},
    host: runtime.host || null,
    documents: {
      query: runtime.documents?.query ?? documentQuery ?? null,
      autoLoad: runtime.documents?.autoLoad !== false,
      activateFirst: runtime.documents?.activateFirst !== false
    },
    dynamicDocument: {
      enabled: runtime.dynamicDocument?.enabled !== false,
      id: String(runtime.dynamicDocument?.id || 'dynamic'),
      title: String(runtime.dynamicDocument?.title || 'Dynamic map'),
      initiallyActive: runtime.dynamicDocument?.initiallyActive === true,
      keepContent: runtime.dynamicDocument?.keepContent !== false,
      layers: Array.isArray(runtime.dynamicDocument?.layers)
        ? runtime.dynamicDocument.layers.map((item) => ({ ...item }))
        : []
    },
    baseMaps: normalizeBaseMaps(runtime.baseMaps),
    ui: {
      enabled: runtime.ui?.enabled !== false,
      placement: runtime.ui?.placement || 'overlay',
      containerId: runtime.ui?.containerId || null,
      position: runtime.ui?.position || 'top-right',
      initiallyExpanded: runtime.ui?.initiallyExpanded !== false,
      showCurrentDocument: runtime.ui?.showCurrentDocument === true,
      showMapDocuments: runtime.ui?.showMapDocuments !== false,
      showLayers: runtime.ui?.showLayers !== false,
      showBaseMaps: runtime.ui?.showBaseMaps !== false,
      showZoomControl: runtime.ui?.showZoomControl !== false,
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

function normalizeBaseMaps(value) {
  const defaults = [
    { id: 'OpenStreetMap', title: 'OpenStreetMap', type: 'tile', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 },
    { id: 'None', title: 'None', type: 'none' }
  ];
  return Array.isArray(value) && value.length ? value : defaults;
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
