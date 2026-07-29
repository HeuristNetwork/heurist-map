import L from 'leaflet';
import { MapEngineAdapter } from './MapEngineAdapter.js';

/**
 * Leaflet implementation hidden behind the engine-neutral adapter contract.
 */
export class LeafletMapAdapter extends MapEngineAdapter {
  constructor() {
    super();
    this.map = null;
    this.layers = new Map();
  }

  async initialize(container, options) {
    this.map = L.map(container, {
      zoomControl: options.controls?.zoom !== false,
      attributionControl: options.controls?.attribution !== false,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom
    });

    this.map.setView(
      [options.center.latitude, options.center.longitude],
      options.zoom
    );

    if (options.baseLayer) {
      this.addTileLayer({
        id: '__base__',
        ...options.baseLayer,
        visible: true
      });
    }
  }

  async addLayer(definition) {
    this.assertInitialized();
    validateLayerDefinition(definition);

    if (this.layers.has(definition.id)) {
      throw new Error(`Layer "${definition.id}" already exists`);
    }

    switch (definition.type) {
      case 'geojson':
        return this.addGeoJsonLayer(definition);
      case 'tile':
        return this.addTileLayer(definition);
      default:
        throw new Error(`Unsupported Leaflet layer type: ${definition.type}`);
    }
  }

  async removeLayer(layerId) {
    const entry = this.layers.get(layerId);
    if (!entry) {
      return false;
    }

    entry.layer.removeFrom(this.map);
    this.layers.delete(layerId);
    return true;
  }

  async setLayerVisibility(layerId, visible) {
    const entry = this.getLayerEntry(layerId);

    if (visible && !this.map.hasLayer(entry.layer)) {
      entry.layer.addTo(this.map);
    } else if (!visible && this.map.hasLayer(entry.layer)) {
      entry.layer.removeFrom(this.map);
    }

    entry.visible = Boolean(visible);
  }

  async setView(center, zoom, options = {}) {
    const point = normalizeCenter(center);
    this.map.setView([point.latitude, point.longitude], zoom, options);
  }

  async fitBounds(bounds, options = {}) {
    const normalized = normalizeBounds(bounds);
    this.map.fitBounds(
      [
        [normalized.south, normalized.west],
        [normalized.north, normalized.east]
      ],
      options
    );
  }

  async invalidateSize() {
    this.map.invalidateSize();
  }

  getViewState() {
    this.assertInitialized();
    const center = this.map.getCenter();
    const bounds = this.map.getBounds();

    return {
      center: {
        latitude: center.lat,
        longitude: center.lng
      },
      zoom: this.map.getZoom(),
      bounds: {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth()
      }
    };
  }

  getCapabilities() {
    return {
      engine: 'leaflet',
      geojson: true,
      tileLayers: true,
      imageOverlays: false,
      customCrs: false,
      drawing: false,
      markerClustering: false
    };
  }

  async destroy() {
    if (!this.map) {
      return;
    }

    const map = this.map;
    this.map = null;
    this.layers.clear();

    // Remove handlers and DOM references while the container is still
    // attached. This also makes repeated Vite HMR initialization safe.
    map.off();
    map.remove();
  }

  addGeoJsonLayer(definition) {
    const symbol = definition.style?.symbol ?? definition.style ?? {};
    const pointStyle = compactOptions({
      radius: symbol.radius,
      color: symbol.color,
      weight: symbol.weight,
      opacity: symbol.opacity,
      fillColor: symbol.fillColor,
      fillOpacity: symbol.fillOpacity,
      fill: symbol.fill,
      stroke: symbol.stroke
    });

    const layer = L.geoJSON(definition.data, {
      style: definition.style?.type === 'simple' ? symbol : definition.style,
      pointToLayer: definition.pointToLayer
        || ((feature, latlng) => L.circleMarker(latlng, pointStyle)),
      onEachFeature: definition.onEachFeature
    });

    return this.registerLayer(definition, layer);
  }

  addTileLayer(definition) {
    if (!definition.url) {
      throw new TypeError(
        `Tile layer "${definition.id}" requires a URL; named base maps must be resolved by the host adapter`
      );
    }

    // Do not pass undefined properties. In particular, explicitly assigning
    // `subdomains: undefined` overrides Leaflet's default "abc" value and
    // causes TileLayer._getSubdomain() to read `.length` from undefined.
    const options = compactOptions({
      ...definition.options,
      attribution: definition.attribution,
      minZoom: definition.minZoom,
      maxZoom: definition.maxZoom,
      subdomains: definition.subdomains
    });

    const layer = L.tileLayer(definition.url, options);
    return this.registerLayer(definition, layer);
  }

  registerLayer(definition, layer) {
    const visible = definition.visible !== false;
    const entry = { definition, layer, visible };

    this.layers.set(definition.id, entry);

    if (visible) {
      layer.addTo(this.map);
    }

    return {
      id: definition.id,
      type: definition.type
    };
  }

  getLayerEntry(layerId) {
    const entry = this.layers.get(layerId);
    if (!entry) {
      throw new Error(`Unknown layer "${layerId}"`);
    }
    return entry;
  }

  assertInitialized() {
    if (!this.map) {
      throw new Error('Leaflet map is not initialized');
    }
  }
}

function validateLayerDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('Layer definition must be an object');
  }
  if (!definition.id) {
    throw new TypeError('Layer definition requires an id');
  }
  if (!definition.type) {
    throw new TypeError('Layer definition requires a type');
  }
}

function normalizeCenter(center) {
  const latitude = Number(center?.latitude ?? center?.lat ?? center?.[0]);
  const longitude = Number(center?.longitude ?? center?.lng ?? center?.lon ?? center?.[1]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new TypeError('Invalid map center');
  }

  return { latitude, longitude };
}

function normalizeBounds(bounds) {
  const west = Number(bounds?.west);
  const south = Number(bounds?.south);
  const east = Number(bounds?.east);
  const north = Number(bounds?.north);

  if (![west, south, east, north].every(Number.isFinite)) {
    throw new TypeError('Invalid map bounds');
  }

  return { west, south, east, north };
}


function compactOptions(options) {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined)
  );
}
