export const MAP_DOCUMENT_FORMAT = 'heurist-map-document';
export const MAP_DOCUMENT_VERSION = 1;

const DEFAULT_BOOKMARK = Object.freeze({
  raw: null,
  type: 'view',
  center: Object.freeze({ latitude: 0, longitude: 0 }),
  zoom: 2
});

/**
 * Normalize the public/API MapDocument domain representation.
 *
 * This function deliberately preserves Heurist identities and raw field
 * values. Engine-specific defaults and Leaflet options belong to the private
 * MapEnvironment created by createMapEnvironment().
 *
 * @param {Object} value MapDocument-like value supplied by the host or API.
 * @returns {Object} Canonical MapDocument version 1.
 */
export function normalizeMapDocument(value = {}) {
  const source = isObject(value) ? value : {};

  return {
    format: source.format || MAP_DOCUMENT_FORMAT,
    version: normalizeVersion(source.version),

    id: source.id ?? source.rec_ID ?? null,
    title: source.title ?? source.rec_Title ?? source.name ?? 'Default map document',

    mapBookmark: normalizeMapBookmark(
      source.mapBookmark ?? source.bookmark ?? source.DT_MAP_BOOKMARK
    ),
    geoObject: source.geoObject ?? source.DT_GEO_OBJECT ?? null,
    symbology: source.symbology ?? source.DT_SYMBOLOGY ?? null,

    // These values preserve the RT_MAP_DOCUMENT fields. They represent
    // geographic distance/scale semantics, not native map-engine zoom levels.
    minimumZoom: finiteNumberOrNull(
      source.minimumZoom ?? source.minZoom ?? source.DT_MINIMUM_ZOOM
    ),
    maximumZoom: finiteNumberOrNull(
      source.maximumZoom ?? source.maxZoom ?? source.DT_MAXIMUM_ZOOM
    ),
    zoomToPointInKM: finiteNumberOrNull(
      source.zoomToPointInKM ?? source.DT_ZOOM_KM_POINT
    ),

    worldBaseMap: normalizeBaseMapReference(
      source.worldBaseMap ?? source.baseMap ?? source.baseLayer ?? source.DT_WORLD_BASEMAP
    ),
    crs: normalizeCrsReference(source.crs ?? source.DT_CRS),
    layers: normalizeLayers(source.layers ?? source.initialLayers),

    // Preserve the exact source for round-trip/debugging without making it the
    // runtime model consumed by a map engine.
    raw: source
  };
}

export function normalizeMapBookmark(value) {
  if (typeof value === 'string') {
    return parseLegacyBookmark(value);
  }

  if (isObject(value)) {
    const raw = value.raw ?? value;
    const type = String(value.type || '').toLowerCase();
    const bounds = normalizeBounds(value.bounds ?? value.extent ?? value);

    if (type === 'extent' || bounds) {
      return bounds
        ? { raw, type: 'extent', bounds }
        : { ...DEFAULT_BOOKMARK, raw };
    }

    const center = normalizeCenter(value.center ?? value);
    if (center) {
      return {
        raw,
        type: 'view',
        center,
        zoom: finiteNumberOrNull(value.zoom) ?? DEFAULT_BOOKMARK.zoom
      };
    }
  }

  return {
    raw: value ?? DEFAULT_BOOKMARK.raw,
    type: DEFAULT_BOOKMARK.type,
    center: { ...DEFAULT_BOOKMARK.center },
    zoom: DEFAULT_BOOKMARK.zoom
  };
}

function parseLegacyBookmark(value) {
  const parts = value.split(',').map((part) => part.trim());

  if (parts[0]?.toLowerCase() === 'extent' && parts.length >= 5) {
    const south = Number(parts[1]);
    const west = Number(parts[2]);
    const north = Number(parts[3]);
    const east = Number(parts[4]);

    if ([west, south, east, north].every(Number.isFinite)) {
      return {
        raw: value,
        type: 'extent',
        bounds: { west, south, east, north }
      };
    }
  }

  return {
    raw: value,
    type: DEFAULT_BOOKMARK.type,
    center: { ...DEFAULT_BOOKMARK.center },
    zoom: DEFAULT_BOOKMARK.zoom
  };
}

function normalizeBaseMapReference(value) {
  if (value === false || value === null || value === 'None') {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return {
      id: typeof value === 'number' ? value : null,
      code: String(value),
      label: String(value)
    };
  }

  if (!isObject(value)) {
    return { id: null, code: 'OpenStreetMap', label: 'OpenStreetMap' };
  }

  return {
    id: value.id ?? value.termId ?? value.trm_ID ?? null,
    code: value.code ?? value.termCode ?? value.name ?? value.title ?? 'OpenStreetMap',
    label: value.label ?? value.title ?? value.name ?? value.code ?? 'OpenStreetMap',

    // Optional custom provider definition. Known providers normally need only
    // id/code/label and are resolved by the base-map registry.
    type: value.type ?? null,
    url: value.url ?? null,
    attribution: value.attribution ?? null,
    minZoom: finiteNumberOrNull(value.minZoom),
    maxZoom: finiteNumberOrNull(value.maxZoom),
    subdomains: value.subdomains ?? null,
    options: isObject(value.options) ? value.options : {}
  };
}

function normalizeCrsReference(value) {
  if (!value) {
    return { id: null, code: 'EPSG:3857', label: 'Web Mercator' };
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const code = String(value) === 'XY' ? 'Simple' : String(value);
    return { id: typeof value === 'number' ? value : null, code, label: code };
  }

  const codeValue = value.code ?? value.termCode ?? value.name ?? value.label ?? 'EPSG:3857';
  const code = String(codeValue) === 'XY' ? 'Simple' : String(codeValue);

  return {
    id: value.id ?? value.termId ?? value.trm_ID ?? null,
    code,
    label: value.label ?? value.title ?? value.name ?? code
  };
}

function normalizeLayers(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((layer, index) => normalizeLayer(layer, index))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

function normalizeLayer(value, index) {
  if (typeof value === 'number' || typeof value === 'string') {
    return {
      id: value,
      title: null,
      order: index,
      visible: true,
      source: {
        type: 'heurist-map-layer',
        recordId: value
      }
    };
  }

  if (!isObject(value)) {
    return null;
  }

  const id = value.id ?? value.recordId ?? value.rec_ID ?? `layer-${index + 1}`;
  let source = isObject(value.source) ? { ...value.source } : null;

  if (!source && (value.recordId ?? value.rec_ID)) {
    source = {
      type: 'heurist-map-layer',
      recordId: value.recordId ?? value.rec_ID
    };
  }

  if (!source && value.type === 'geojson' && value.data) {
    source = { type: 'inline-geojson', data: value.data };
  }

  return {
    ...value,
    id,
    title: value.title ?? value.name ?? null,
    order: finiteNumberOrNull(value.order) ?? index,
    visible: value.visible !== false,
    source
  };
}

function normalizeVersion(value) {
  const version = Number(value);
  return Number.isInteger(version) && version > 0
    ? version
    : MAP_DOCUMENT_VERSION;
}

function normalizeCenter(value) {
  const latitude = Number(value?.latitude ?? value?.lat ?? value?.[0]);
  const longitude = Number(value?.longitude ?? value?.lng ?? value?.lon ?? value?.[1]);

  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function normalizeBounds(value) {
  const west = Number(value?.west);
  const south = Number(value?.south);
  const east = Number(value?.east);
  const north = Number(value?.north);

  return [west, south, east, north].every(Number.isFinite)
    ? { west, south, east, north }
    : null;
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
