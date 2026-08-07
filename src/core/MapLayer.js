/**
 * MapLayer.js - MapLayer domain normalization
 *
 * @fileOverview Validates and normalizes public MapLayer responses, source definitions, styles, options, and supported source types.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { normalizeLayerStyle } from '../utils/normalizeLayerStyle.js';
import { normalizeBounds } from '../utils/normalizeBounds.js';

export const MAP_LAYER_FORMAT = 'heurist-map-layer';
export const MAP_LAYER_VERSION = 1;

/**
 * Normalize map layer.
 *
 * @returns {*} Function result.
 */
export function normalizeMapLayer(value = {}) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    format: source.format || MAP_LAYER_FORMAT,
    version: Number(source.version) || MAP_LAYER_VERSION,
    id: positiveIntegerOrNull(source.id),
    title: String(source.title || ''),
    description: String(source.description || ''),
    visible: source.visible !== false,
    selectable: source.selectable !== false,
    source: normalizeSource(source.source),
    style: normalizeStyle(source.style),
    timeline: normalizeTimeline(source.timeline),
    options: normalizeOptions(source.options)
  };
}

function normalizeSource(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...source,
    type: String(source.type || ''),
    recordId: positiveIntegerOrNull(source.recordId),
    title: String(source.title || ''),
    bounds: normalizeBounds(source.bounds)
  };
}

function normalizeStyle(value) {
  return normalizeLayerStyle(value);
}

function normalizeTimeline(value) {
  const timeline = value && typeof value === 'object' ? value : {};
  return {
    enabled: timeline.enabled === true,
    fields: Array.isArray(timeline.fields) ? [...timeline.fields] : []
  };
}

function normalizeOptions(value) {
  const options = value && typeof value === 'object' ? { ...value } : {};
  return {
    ...options,
    minZoom: finiteNumberOrNull(options.minZoom),
    maxZoom: finiteNumberOrNull(options.maxZoom),
    minimumZoomKm: finiteNumberOrNull(options.minimumZoomKm ?? options.minimumZoom),
    maximumZoomKm: finiteNumberOrNull(options.maximumZoomKm ?? options.maximumZoom)
  };
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
