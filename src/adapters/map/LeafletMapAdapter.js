/**
 * LeafletMapAdapter.js - Leaflet map engine adapter
 *
 * @fileOverview Implements the engine-neutral map contract with Leaflet while keeping Leaflet objects private to the adapter.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import L from 'leaflet';
import { normalizeBounds as normalizeGeographicBounds } from '../../geo/normalizeBounds.js';
import { MapEngineAdapter } from './MapEngineAdapter.js';
import { createImageFilterCss } from '../../symbology/normalizeImageFilter.js';

/**
 * Leaflet implementation hidden behind the engine-neutral adapter contract.
 */
export class LeafletMapAdapter extends MapEngineAdapter {
  /**
   * Create and initialize the class instance.
   */
  constructor() {
    super();
    this.map = null;
    this.layers = new Map();
  }

  /**
   * Initialize the component and its required resources.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
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

  /**
   * Add an engine-neutral runtime layer and register its application state.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
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
      case 'image':
        return this.addImageLayer(definition);
      default:
        throw new Error(`Unsupported Leaflet layer type: ${definition.type}`);
    }
  }

  /**
   * Remove a runtime layer from the map and application registry.
   * @returns {Promise<boolean>} Resolves with whether a layer was removed.
   */
  async removeLayer(layerId) {
    const entry = this.layers.get(layerId);
    if (!entry) {
      return false;
    }

    entry.layer.removeFrom(this.map);
    this.layers.delete(layerId);
    return true;
  }

  /**
   * Show or hide a runtime layer.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async setLayerVisibility(layerId, visible) {
    const entry = this.getLayerEntry(layerId);

    if (visible && !this.map.hasLayer(entry.layer)) {
      entry.layer.addTo(this.map);
    } else if (!visible && this.map.hasLayer(entry.layer)) {
      entry.layer.removeFrom(this.map);
    }

    entry.visible = Boolean(visible);
  }

  /** Replace the current base map without touching operational layers. */
  async setBaseMap(definition) {
    await this.removeLayer('__base__');
    if (definition) {
      this.addTileLayer({ id: '__base__', ...definition, visible: true });
      const base = this.layers.get('__base__')?.layer;
      if (typeof base?.bringToBack === 'function') base.bringToBack();
    }
  }

  /** Apply a global opacity multiplier without changing persisted symbology. */
  async setLayerOpacity(layerId, opacity) {
    const entry = this.getLayerEntry(layerId);
    const value = Math.min(1, Math.max(0, Number(opacity)));
    entry.opacity = value;
    const nativeLayer = entry.layer;
    if (typeof nativeLayer.setOpacity === 'function') {
      nativeLayer.setOpacity(value);
      return;
    }
    if (typeof nativeLayer.eachLayer === 'function') {
      nativeLayer.eachLayer((child) => applyChildOpacity(child, value, entry.baseOpacity));
    }
  }

  /** Return geographic bounds for a rendered layer. */
  async getLayerBounds(layerId) {
    const entry = this.getLayerEntry(layerId);
    const bounds = typeof entry.layer.getBounds === 'function' ? entry.layer.getBounds() : null;
    if (!bounds?.isValid?.()) return entry.definition?.bounds || null;
    return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
  }

  /**
   * Set the map center and zoom.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async setView(center, zoom, options = {}) {
    const point = normalizeCenter(center);
    this.map.setView([point.latitude, point.longitude], zoom, options);
  }

  /**
   * Fit the map viewport to geographic bounds.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
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

  /**
   * Notify the map engine that its container dimensions changed.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async invalidateSize() {
    this.map.invalidateSize();
  }

  /**
   * Return the current engine-neutral map view state.
   * @returns {*} Method result.
   */
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

  /**
   * Return supported application or map-engine capabilities.
   * @returns {*} Method result.
   */
  getCapabilities() {
    return {
      engine: 'leaflet',
      geojson: true,
      tileLayers: true,
      imageOverlays: true,
      customCrs: false,
      drawing: false,
      markerClustering: false
    };
  }

  /**
   * Release resources, handlers, requests, layers, and host integrations.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
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

  /**
   * Create and register a Leaflet GeoJSON layer.
   * @returns {*} Method result.
   */
  addGeoJsonLayer(definition) {
    const symbol = definition.style?.symbol ?? {};
    const pathStyle = compactOptions({
      color: symbol.color,
      weight: symbol.weight,
      opacity: symbol.opacity,
      fillColor: symbol.fillColor,
      fillOpacity: symbol.fillOpacity,
      fill: symbol.fill,
      stroke: symbol.stroke,
      dashArray: symbol.dashArray
    });
    const pointToLayer = createPointLayerFactory(symbol);
    const popupEnabled = definition.popup?.enabled !== false;

    const layer = L.geoJSON(definition.data, {
      style: () => pathStyle,
      pointToLayer,
      // Popup HTML and Leaflet popup instances are created lazily. This avoids
      // expensive per-feature DOM/string work while a large layer is loading.
      onEachFeature: popupEnabled
        ? (feature, nativeLayer) => {
            nativeLayer.once('click', () => {
              const popupHtml = createPopupHtml(feature, definition.popup);
              if (popupHtml) {
                nativeLayer.bindPopup(popupHtml).openPopup();
              }
            });
          }
        : undefined
    });

    return this.registerLayer(definition, layer);
  }

  /**
   * Create and register a Leaflet tile layer.
   * @returns {*} Method result.
   */
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
      subdomains: definition.subdomains,
      tms: definition.tms,
      bounds: toLeafletBounds(definition.bounds),
      noWrap: definition.noWrap,
      opacity: definition.opacity
    });

    const layer = L.tileLayer(definition.url, options);
    return this.registerLayer(definition, layer);
  }

  /**
   * Create and register a Leaflet image overlay.
   *
   * @param {Object} definition Engine-neutral runtime image layer.
   * @returns {Object} Public native-layer registration result.
   */
  addImageLayer(definition) {
    if (!definition.url) {
      throw new TypeError(`Image layer "${definition.id}" requires a URL`);
    }

    const normalized = normalizeBounds(definition.bounds);
    const leafletBounds = [
      [normalized.south, normalized.west],
      [normalized.north, normalized.east]
    ];

    const options = compactOptions({
      ...definition.options,
      opacity: definition.opacity,
      interactive: false,
      className: `heurist-map-image-layer heurist-map-image-layer-${sanitizeClassToken(definition.id)}`
    });

    const layer = L.imageOverlay(definition.url, leafletBounds, options);
    const filterCss = createImageFilterCss(definition.imageFilter);

    const applyFilter = () => {
      const image = layer.getElement();
      if (image) {
        image.style.filter = filterCss;
      }
    };

    layer.on('load', applyFilter);
    const result = this.registerLayer(definition, layer);
    applyFilter();
    return result;
  }

  /**
   * Register a native Leaflet layer and optionally add it to the map.
   * @returns {*} Method result.
   */
  registerLayer(definition, layer) {
    const visible = definition.visible !== false;
    const entry = { definition, layer, visible, opacity: 1, baseOpacity: new WeakMap() };

    this.layers.set(definition.id, entry);

    if (visible) {
      layer.addTo(this.map);
    }

    return {
      id: definition.id,
      type: definition.type
    };
  }

  /**
   * Return a native Leaflet layer registry entry.
   * @returns {*} Method result.
   */
  getLayerEntry(layerId) {
    const entry = this.layers.get(layerId);
    if (!entry) {
      throw new Error(`Unknown layer "${layerId}"`);
    }
    return entry;
  }

  /**
   * Throw when the map engine has not been initialized.
   * @returns {*} Method result.
   */
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
  const normalized = normalizeGeographicBounds(bounds);
  if (!normalized) {
    throw new TypeError('Invalid map bounds');
  }
  return normalized;
}

function toLeafletBounds(bounds) {
  const normalized = normalizeGeographicBounds(bounds);
  return normalized
    ? [
        [normalized.south, normalized.west],
        [normalized.north, normalized.east]
      ]
    : undefined;
}


function compactOptions(options) {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined)
  );
}


function createPointLayerFactory(symbol) {
  if ((symbol.iconType === 'icon' || symbol.iconType === 'marker') && symbol.iconUrl) {
    const icon = L.icon(compactOptions({
      iconUrl: symbol.iconUrl,
      iconSize: symbol.iconSize,
      iconAnchor: symbol.iconAnchor,
      popupAnchor: symbol.popupAnchor
    }));
    return (_feature, latlng) => L.marker(latlng, { icon });
  }

  if (symbol.iconType === 'iconfont') {
    const icon = createIconFontIcon(symbol);
    return (_feature, latlng) => L.marker(latlng, { icon });
  }

  const options = compactOptions({
    radius: symbol.radius,
    color: symbol.color,
    weight: symbol.weight,
    opacity: symbol.opacity,
    fillColor: symbol.fillColor,
    fillOpacity: symbol.fillOpacity,
    fill: symbol.fill,
    stroke: symbol.stroke
  });
  return (_feature, latlng) => L.circleMarker(latlng, options);
}

function createIconFontIcon(symbol) {
  const iconFont = symbol.iconFont || 'ui-icon-location';
  let className;

  const classes = String(iconFont)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const isFontAwesome = classes.some((name) =>
    name === 'fa'
    || name === 'fas'
    || name === 'far'
    || name === 'fab'
    || name.startsWith('fa-')
  );

  if (isFontAwesome) {
    const hasStyleClass = classes.some((name) =>
      name === 'fa-solid'
      || name === 'fa-regular'
      || name === 'fa-brands'
      || name === 'fas'
      || name === 'far'
      || name === 'fab'
    );
    if (!hasStyleClass) {
      classes.unshift('fa-solid');
    }
    className = classes.join(' ');
  } else {
    const iconClass = classes.find((name) => name.startsWith('ui-icon-')) || iconFont;
    className = `ui-icon ${iconClass.startsWith('ui-icon-') ? iconClass : `ui-icon-${iconClass}`}`;
  }

  const safeClassName = className
    .split(/\s+/)
    .filter((name) => /^[A-Za-z0-9_-]+$/.test(name))
    .join(' ');

  let width = 24;
  let height = 24;
  if (Array.isArray(symbol.iconSize)) {
    width = Number(symbol.iconSize[0]) || 24;
    height = Number(symbol.iconSize[1]) || width;
  } else if (Number(symbol.iconSize) > 0) {
    width = height = Number(symbol.iconSize);
  }

  const fontSize = Math.min(width, height);
  const color = symbol.color || '#000000';
  const backgroundStyle = symbol.fillColor
    ? `background-color:${symbol.fillColor};`
    : 'background:none;';

  return L.divIcon({
    className: 'heurist-map-iconfont-marker',
    html: `<span class="${safeClassName}" style="display:flex;align-items:center;justify-content:center;border:none;font-size:${fontSize}px;width:${width}px;height:${height}px;color:${color};${backgroundStyle}"></span>`,
    iconSize: [width, height],
    iconAnchor: symbol.iconAnchor || [width / 2, height / 2]
  });
}

function sanitizeClassToken(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, '-');
}

function createPopupHtml(feature, popup) {
  const properties = feature?.properties || {};
  const metadata = properties.heurist || {};
  const titleField = popup?.titleField;
  const title = titleField && properties[titleField] != null
    ? String(properties[titleField])
    : metadata.title || properties.rec_Title || properties.title || properties.name || '';

  const parts = [];
  if (title) {
    parts.push(`<strong>${escapeHtml(title)}</strong>`);
  }

  if (popup?.showRecordId !== false && metadata.recordId) {
    parts.push(`<div>Record ${escapeHtml(metadata.recordId)}</div>`);
  }

  for (const field of popup?.fields || []) {
    const descriptor = typeof field === 'string' ? { name: field, label: field } : field;
    const value = properties[descriptor.name];
    if (value === undefined || value === null || value === '') continue;
    parts.push(
      `<div><span>${escapeHtml(descriptor.label || descriptor.name)}:</span> ${escapeHtml(formatPopupValue(value))}</div>`
    );
  }

  return parts.join('');
}

function formatPopupValue(value) {
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function applyChildOpacity(layer, multiplier, baseOpacity) {
  let base = baseOpacity.get(layer);
  if (!base) {
    const options = layer.options || {};
    base = {
      opacity: finiteOpacity(options.opacity, 1),
      fillOpacity: finiteOpacity(options.fillOpacity, 0.2)
    };
    baseOpacity.set(layer, base);
  }

  if (typeof layer.setStyle === 'function') {
    layer.setStyle({
      opacity: base.opacity * multiplier,
      fillOpacity: base.fillOpacity * multiplier
    });
    return;
  }

  if (typeof layer.setOpacity === 'function') {
    layer.setOpacity(base.opacity * multiplier);
    return;
  }

  const element = typeof layer.getElement === 'function' ? layer.getElement() : null;
  if (element) element.style.opacity = String(base.opacity * multiplier);
}

function finiteOpacity(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
