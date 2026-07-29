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
    serverUrl: runtime.serverUrl || null,
    database: runtime.database || runtime.db || null,
    host: runtime.host || null,
    mapDocument
  };
}
