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
  const mapDocument = normalizeMapDocument(window.heuristMapConfig || {});
  const runtime = window.heuristMapOptions || {};
  const url = new URL(globalThis.location?.href || 'http://localhost/');
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
      showBaseMaps: runtime.ui?.showBaseMaps !== false
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
