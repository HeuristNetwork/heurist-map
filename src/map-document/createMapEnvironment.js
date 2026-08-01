/**
 * createMapEnvironment.js - Map environment builder
 *
 * @fileOverview Converts a normalized MapDocument into the private runtime environment used to initialize the map engine.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

const BASE_MAP_REGISTRY = Object.freeze({
  OpenStreetMap: Object.freeze({
    id: '__base__',
    title: 'OpenStreetMap',
    type: 'tile',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    visible: true
  })
});

/**
 * Convert a public MapDocument into the private, engine-neutral runtime model.
 *
 * @param {Object} mapDocument Canonical MapDocument.
 * @returns {Object} MapEnvironment consumed by MapApplication/adapters.
 */
export function createMapEnvironment(mapDocument) {
  return {
    initialView: createInitialView(mapDocument.mapBookmark, mapDocument.bounds),
    crs: {
      code: mapDocument.crs?.code || 'EPSG:3857'
    },
    baseMap: resolveBaseMap(mapDocument.worldBaseMap),
    visibilityRangeKM: {
      minimum: mapDocument.minimumZoom,
      maximum: mapDocument.maximumZoom
    },
    zoomToPointInKM: mapDocument.zoomToPointInKM,
    layers: mapDocument.layers
  };
}

function createInitialView(bookmark, documentBounds) {
  if (bookmark?.type === 'extent' && bookmark.bounds) {
    return {
      type: 'bounds',
      bounds: bookmark.bounds,
      center: {
        latitude: (bookmark.bounds.south + bookmark.bounds.north) / 2,
        longitude: (bookmark.bounds.west + bookmark.bounds.east) / 2
      },
      zoom: 2
    };
  }

  if (bookmark?.type === 'point' && bookmark.point) {
    return {
      type: 'view',
      center: bookmark.point,
      zoom: bookmark.zoom ?? 10
    };
  }

  // A deliberately supplied view bookmark takes precedence over document
  // bounds. The synthetic default bookmark (0,0 at zoom 2) does not.
  if (bookmark?.type === 'view' && !isSyntheticDefaultView(bookmark)) {
    return {
      type: 'view',
      center: bookmark.center,
      zoom: bookmark.zoom ?? 2
    };
  }

  if (documentBounds) {
    return {
      type: 'bounds',
      bounds: documentBounds,
      center: {
        latitude: (documentBounds.south + documentBounds.north) / 2,
        longitude: (documentBounds.west + documentBounds.east) / 2
      },
      zoom: 2
    };
  }

  return {
    type: 'view',
    center: bookmark?.center || { latitude: 0, longitude: 0 },
    zoom: bookmark?.zoom ?? 2
  };
}

function isSyntheticDefaultView(bookmark) {
  return bookmark?.type === 'view'
    && !bookmark.raw
    && Number(bookmark.center?.latitude) === 0
    && Number(bookmark.center?.longitude) === 0
    && Number(bookmark.zoom ?? 2) === 2;
}

function resolveBaseMap(reference) {
  if (!reference) {
    return null;
  }

  if (reference.url) {
    return compact({
      id: '__base__',
      title: reference.label || reference.code || 'Base map',
      type: reference.type || 'tile',
      url: reference.url,
      attribution: reference.attribution,
      minZoom: reference.minZoom,
      maxZoom: reference.maxZoom,
      subdomains: reference.subdomains,
      options: reference.options,
      visible: true
    });
  }

  const provider = BASE_MAP_REGISTRY[reference.code];
  if (!provider) {
    throw new Error(`Unknown base-map provider "${reference.code}"`);
  }

  return { ...provider };
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)
  );
}
