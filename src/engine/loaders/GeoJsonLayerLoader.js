/**
 * GeoJsonLayerLoader.js - Heurist GeoJSON layer loader
 *
 * @fileOverview Loads query, record, or inline GeoJSON sources and produces normalized engine-neutral runtime layers.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { normalizeGeoJson } from '../../utils/normalizeGeoJson.js';

/**
 * Loads Heurist query, record, and inline GeoJSON MapLayers.
 */
export class GeoJsonLayerLoader {
  /**
   * Create and initialize the class instance.
   */
  constructor({ queryGeoData }) {
    this.queryGeoData = queryGeoData;
  }

  /**
   * Load a MapLayer using the loader registered for its source type.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async load(mapLayer, context) {
    const source = mapLayer.source;
    let geoJson;

    switch (source.type) {
      case 'heurist-query':
        geoJson = await this.queryGeoData.searchAll({
          query: source.query,
          limit: source.limit || 1000,
          simplify: source.simplify === true,
          signal: context.signal
        });
        break;
      case 'record':
        geoJson = await this.queryGeoData.getRecord(source.recordId, {
          simplify: source.simplify === true,
          signal: context.signal
        });
        break;
      case 'inline-geojson':
        geoJson = source.data;
        break;
      default:
        throw new Error(`Unsupported GeoJSON source type "${source.type}"`);
    }

    return createGeoJsonRuntimeLayer(mapLayer, context, geoJson);
  }
}

/**
 * Create geo json runtime layer.
 *
 * @returns {*} Function result.
 */
export function createGeoJsonRuntimeLayer(mapLayer, context, geoJson) {
  const id = context.reference.id ?? `map-layer-${context.reference.recordId}`;
  return {
    id,
    recordId: mapLayer.id,
    title: mapLayer.title,
    description: mapLayer.description,
    type: 'geojson',
    visible: mapLayer.visible !== false,
    visibilityMinZoom: mapLayer.options?.effectiveMinZoom ?? mapLayer.options?.minZoom,
    visibilityMaxZoom: mapLayer.options?.effectiveMaxZoom ?? mapLayer.options?.maxZoom,
    selectable: mapLayer.selectable !== false,
    data: normalizeGeoJson(geoJson, { layerId: id, sourceType: mapLayer.source.type }),
    style: mapLayer.style,
    popup: normalizePopup(mapLayer.options?.popup),
    options: mapLayer.options,
    source: mapLayer.source,
    order: context.reference.order ?? 0
  };
}

function normalizePopup(value) {
  if (value === false) {
    return { enabled: false };
  }
  const popup = value && typeof value === 'object' ? value : {};
  return {
    enabled: popup.enabled !== false,
    titleField: popup.titleField || null,
    fields: Array.isArray(popup.fields) ? [...popup.fields] : [],
    showRecordId: popup.showRecordId !== false
  };
}
