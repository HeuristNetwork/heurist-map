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
          query: context.viewport ? addViewportToQuery(source.query, context.viewport) : source.query,
          limit: source.limit || mapLayer.options?.maxAllowedFeatures || 1000,
          maxFeatures: source.limit || mapLayer.options?.maxAllowedFeatures || 1000,
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
    resultMeta: normalizeResultMeta(geoJson?.meta),
    style: mapLayer.style,
    popup: normalizePopup(mapLayer.options?.popup, mapLayer.options?.popupTemplate),
    options: mapLayer.options,
    source: mapLayer.source,
    order: context.reference.order ?? 0
  };
}

function normalizePopup(value, template = null) {
  if (value === false) {
    return { enabled: false };
  }
  const popup = value && typeof value === 'object' ? value : {};
  return {
    enabled: popup.enabled !== false,
    titleField: popup.titleField || null,
    fields: Array.isArray(popup.fields) ? [...popup.fields] : [],
    showRecordId: popup.showRecordId !== false,
    template: typeof template === 'string' && template.trim() ? template : null
  };
}

function normalizeResultMeta(value) {
  if (!value || typeof value !== 'object') return null;
  const numberOrNull = (item) => {
    const number = Number(item);
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  return {
    totalRecords: numberOrNull(value.totalRecords ?? value.total),
    returnedRecords: numberOrNull(value.returnedRecords),
    returnedFeatures: numberOrNull(value.returnedFeatures),
    offset: numberOrNull(value.offset) ?? 0,
    limit: numberOrNull(value.limit),
    isPartial: value.isPartial === true
  };
}


/** Build a temporary viewport-constrained query without mutating the stored source query. */
export function addViewportToQuery(query, bounds) {
  const viewport = normalizeViewport(bounds);
  if (!viewport) return query;
  const geoPredicate = { geo: viewport };

  if (Array.isArray(query)) {
      return [...query, geoPredicate];
  }
  if (query && typeof query === 'object') {
      return [query, geoPredicate];
  }

  if (typeof query === 'string') {
    const trimmed = query.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return JSON.stringify([...parsed, geoPredicate]);
        }

        if (parsed && typeof parsed === 'object') {
            return JSON.stringify([parsed, geoPredicate]);
        }
      } catch { /* legacy/plain query */ }
    }
    return `${query}${query && !/\s$/.test(query) ? ' ' : ''}geo:"${viewport.west},${viewport.south},${viewport.east},${viewport.north}"`;
  }
  return query;
}



function normalizeViewport(bounds) {
  if (!bounds || typeof bounds !== 'object') return null;
  const west = Number(bounds.west);
  const south = Number(bounds.south);
  const east = Number(bounds.east);
  const north = Number(bounds.north);
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return {
    west: clamp(west, -180, 180),
    south: clamp(south, -90, 90),
    east: clamp(east, -180, 180),
    north: clamp(north, -90, 90)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
