import { normalizeLayerStyle } from '../symbology/normalizeLayerStyle.js';

export const MAP_LAYER_FORMAT = 'heurist-map-layer';
export const MAP_LAYER_VERSION = 1;

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
    options: source.options && typeof source.options === 'object'
      ? { ...source.options }
      : {}
  };
}

function normalizeSource(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...source,
    type: String(source.type || ''),
    recordId: positiveIntegerOrNull(source.recordId),
    title: String(source.title || '')
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

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
