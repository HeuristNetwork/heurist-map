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
    mapDocument
  };
}
