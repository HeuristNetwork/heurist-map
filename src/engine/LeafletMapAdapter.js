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
import { normalizeBounds as normalizeGeographicBounds } from '../utils/normalizeBounds.js';
import { MapEngineAdapter } from './MapEngineAdapter.js';
import { createImageFilterCss } from '../utils/normalizeImageFilter.js';
import { normalizeZoomLimit } from '../utils/normalizeZoomLimit.js';

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
    this.interactionHandlers = {};
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

    this.map.on('zoomend', () => {
      this.refreshZoomRangeVisibility();
    });

    this.map.on('click', (event) => {
      // Leaflet may bubble a feature click to the map even after the DOM event
      // has been stopped. Do not treat such a click as a background-map click,
      // otherwise the selection made by onFeatureClick is cleared immediately.
      if (event.originalEvent?._stopped) {
        return;
      }

      this.interactionHandlers.onMapClick?.({
        latlng: toPublicLatLng(event.latlng)
      });
    });

    if (options.controls?.scale !== false) {
      L.control.scale({ position: 'bottomleft' }).addTo(this.map);
    }

    if (options.baseLayer) {
      this.addTileLayer({
        ...options.baseLayer,
        id: '__base__',
        visible: true
      });
      const base = this.layers.get('__base__')?.layer;
      if (typeof base?.bringToBack === 'function') base.bringToBack();
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
    entry.visible = Boolean(visible);
    this.applyLayerEffectiveVisibility(entry);
  }

  /** Configure callbacks without exposing Leaflet event objects. */
  setInteractionHandlers(handlers = {}) {
    this.interactionHandlers = { ...handlers };
  }

  /**
   * Apply selection styling to one GeoJSON layer.
   *
   * Only features whose selected state changed are touched. This is important
   * for large result layers: a normal click must not walk every rendered
   * feature just to restore the previously selected item.
   */
  async setFeatureSelection(layerId, featureIds = []) {
    const entry = this.getLayerEntry(layerId);
    if (!entry.featureLayers) return false;

    const previous = entry.selectedFeatureIds || new Set();
    const selected = new Set(featureIds.map(String));

    // Restore only features that were selected before and are no longer selected.
    for (const featureId of previous) {
      if (selected.has(featureId)) continue;
      const nativeLayer = entry.featureLayers.get(featureId);
      if (nativeLayer) {
        applyNativeSelection(nativeLayer, false, entry.selectionBaseStyles, entry.opacity, entry.selectionSymbol);
      }
    }

    // Apply selection styling only to newly selected features. Features that
    // remain selected already have the correct native style.
    for (const featureId of selected) {
      if (previous.has(featureId)) continue;
      const nativeLayer = entry.featureLayers.get(featureId);
      if (nativeLayer) {
        applyNativeSelection(nativeLayer, true, entry.selectionBaseStyles, entry.opacity, entry.selectionSymbol);
      }
    }

    entry.selectedFeatureIds = selected;
    return true;
  }

  /** Resolve the record ID attached to one rendered feature. */
  getFeatureRecordId(layerId, featureId) {
    const entry = this.getLayerEntry(layerId);
    return entry.featureRecordIds?.get(String(featureId)) ?? null;
  }

  /** Resolve all rendered feature IDs attached to one record. */
  getFeatureIdsByRecord(layerId, recordId) {
    const entry = this.getLayerEntry(layerId);
    return [...(entry.recordFeatureIds?.get(Number(recordId)) || [])];
  }

  /** Return bounds of selected native features. */
  async getSelectionBounds(layerId, featureIds = []) {
    const entry = this.getLayerEntry(layerId);
    if (!entry.featureLayers) return null;
    let combined = null;
    for (const featureId of featureIds.map(String)) {
      const nativeLayer = entry.featureLayers.get(featureId);
      if (!nativeLayer) continue;
      const bounds = getNativeFeatureBounds(nativeLayer);
      if (!bounds?.isValid?.()) continue;
      combined = combined ? combined.extend(bounds) : L.latLngBounds(bounds);
    }
    return combined?.isValid?.()
      ? { west: combined.getWest(), south: combined.getSouth(), east: combined.getEast(), north: combined.getNorth() }
      : null;
  }

  /** Replace the current base map without touching operational layers. */
  async setBaseMap(definition) {
    await this.removeLayer('__base__');

    if (!definition) {
      return true;
    }

    this.addTileLayer({
      ...definition,
      id: '__base__',
      visible: true
    });

    const base = this.layers.get('__base__')?.layer;
    if (typeof base?.bringToBack === 'function') {
      base.bringToBack();
    }

    return true;
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
      if (entry.featureLayers && entry.selectedFeatureIds?.size) {
        for (const [featureId, child] of entry.featureLayers) {
          if (entry.selectedFeatureIds.has(featureId)) {
            applyNativeSelection(child, true, entry.selectionBaseStyles, value, entry.selectionSymbol);
          }
        }
      }
    }
  }

  /** Return geographic bounds for a rendered layer. */
  async getLayerBounds(layerId) {
    const entry = this.getLayerEntry(layerId);
    const bounds = typeof entry.layer.getBounds === 'function' ? entry.layer.getBounds() : null;
    if (!bounds?.isValid?.()) return entry.definition?.bounds || null;
    return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
  }

  /** Return combined bounds for visible operational layers. */
  async getVisibleLayerBounds() {
    let combined = null;
    for (const [id, entry] of this.layers) {
      if (id === '__base__' || !entry.visible || !this.map.hasLayer(entry.layer)) continue;
      const nativeBounds = typeof entry.layer.getBounds === 'function' ? entry.layer.getBounds() : null;
      if (nativeBounds?.isValid?.()) {
        combined = combined ? combined.extend(nativeBounds) : L.latLngBounds(nativeBounds);
      } else if (entry.definition?.bounds) {
        const bounds = toLeafletBounds(entry.definition.bounds);
        if (bounds) combined = combined ? combined.extend(bounds) : L.latLngBounds(bounds);
      }
    }
    return combined?.isValid?.()
      ? { west: combined.getWest(), south: combined.getSouth(), east: combined.getEast(), north: combined.getNorth() }
      : null;
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

  /** Apply document-wide native zoom limits. */
  async setZoomLimits({ minZoom = null, maxZoom = null } = {}) {
    this.assertInitialized();

    // Leaflet uses undefined to mean "no explicit document limit". Do not
    // coerce null through Number(): Number(null) is 0 and would incorrectly
    // lock an unrestricted MapDocument to zoom level 0.
    const normalizedMinZoom = normalizeZoomLimit(minZoom);
    const normalizedMaxZoom = normalizeZoomLimit(maxZoom);

    this.map.setMinZoom(normalizedMinZoom ?? undefined);
    this.map.setMaxZoom(normalizedMaxZoom ?? undefined);

    const current = this.map.getZoom();
    const effectiveMinZoom = this.map.getMinZoom();
    const effectiveMaxZoom = this.map.getMaxZoom();
    const next = Math.max(effectiveMinZoom, Math.min(effectiveMaxZoom, current));
    if (next !== current) this.map.setZoom(next, { animate: false });
    this.refreshZoomRangeVisibility();
  }

  /**
   * Convert a target viewport width in kilometres to a Leaflet zoom level.
   * The calculation uses Web-Mercator ground resolution at the supplied
   * latitude and the current map container width.
   */
  distanceKmToZoom(distanceKm, { latitude = null } = {}) {
    this.assertInitialized();
    const km = Number(distanceKm);
    if (!(km > 0)) return null;

    const lat = Number.isFinite(Number(latitude))
      ? Number(latitude)
      : this.map.getCenter().lat;
    const width = Math.max(1, this.map.getSize().x || 1024);
    const metresPerPixel = (km * 1000) / width;
    const latitudeFactor = Math.max(0.000001, Math.cos(lat * Math.PI / 180));
    const zoom = Math.log2((156543.03392804097 * latitudeFactor) / metresPerPixel);
    return Number.isFinite(zoom) ? Math.max(0, Math.round(zoom)) : null;
  }

  /** Re-evaluate all operational layers after a zoom change. */
  refreshZoomRangeVisibility() {
    if (!this.map) return;
    for (const [id, entry] of this.layers) {
      if (id === '__base__') continue;
      this.applyLayerEffectiveVisibility(entry);
    }
  }

  applyLayerEffectiveVisibility(entry) {
    if (!this.map || !entry) return;
    const zoom = this.map.getZoom();
    const minZoom = normalizeZoomLimit(entry.definition?.visibilityMinZoom);
    const maxZoom = normalizeZoomLimit(entry.definition?.visibilityMaxZoom);
    const inRange = (minZoom == null || zoom >= minZoom)
      && (maxZoom == null || zoom <= maxZoom);
    const shouldShow = entry.visible && inRange;

    if (shouldShow && !this.map.hasLayer(entry.layer)) entry.layer.addTo(this.map);
    else if (!shouldShow && this.map.hasLayer(entry.layer)) entry.layer.removeFrom(this.map);
    entry.zoomVisible = inRange;
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
      markerClustering: false,
      featureSelection: true,
      multiSelection: true
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
    const selectable = definition.selectable !== false;
    const featureLayers = new Map();
    const featureRecordIds = new Map();
    const recordFeatureIds = new Map();
    const selectionBaseStyles = new WeakMap();

    const layer = L.geoJSON(definition.data, {
      style: () => pathStyle,
      pointToLayer,
      onEachFeature: (feature, nativeLayer) => {
        const metadata = getFeatureSelectionMetadata(feature);
        featureLayers.set(metadata.featureId, nativeLayer);
        featureRecordIds.set(metadata.featureId, metadata.recordId);
        if (metadata.recordId != null) {
          if (!recordFeatureIds.has(metadata.recordId)) recordFeatureIds.set(metadata.recordId, new Set());
          recordFeatureIds.get(metadata.recordId).add(metadata.featureId);
        }
        rememberSelectionBaseStyle(nativeLayer, selectionBaseStyles);

        // A click on a GeoJSON feature must not bubble to the map background.
        // Otherwise MapApplication handles onFeatureClick and then immediately
        // handles onMapClick, which clears the new selection.
        nativeLayer.options.bubblingMouseEvents = false;

        nativeLayer.on('click', (event) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);

          if (popupEnabled && !nativeLayer.getPopup?.()) {
            const popupHtml = createPopupHtml(feature, definition.popup);
            if (popupHtml) {
              nativeLayer.bindPopup(popupHtml);
              nativeLayer.openPopup();
            }
          }

          this.interactionHandlers.onFeatureClick?.({
            layerId: definition.id,
            featureId: metadata.featureId,
            recordId: metadata.recordId,
            selectable,
            additive: Boolean(event.originalEvent?.ctrlKey || event.originalEvent?.metaKey || event.originalEvent?.shiftKey),
            latlng: toPublicLatLng(event.latlng)
          });
        });
      }
    });

    const result = this.registerLayer(definition, layer);
    const entry = this.layers.get(definition.id);
    entry.featureLayers = featureLayers;
    entry.featureRecordIds = featureRecordIds;
    entry.recordFeatureIds = recordFeatureIds;
    entry.selectionBaseStyles = selectionBaseStyles;
    entry.selectionSymbol = definition.style?.selectSymbol || null;
    entry.selectedFeatureIds = new Set();
    return result;
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
      noWrap: definition.noWrap
      /*
      bounds: toLeafletBounds(definition.bounds),
      opacity: definition.opacity
      */
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
    const entry = { definition, layer, visible, zoomVisible: true, opacity: 1, baseOpacity: new WeakMap(), featureLayers: null, featureRecordIds: null, recordFeatureIds: null, selectionBaseStyles: new WeakMap(), selectedFeatureIds: new Set() };

    this.layers.set(definition.id, entry);
    this.applyLayerEffectiveVisibility(entry);

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
  const color = escapeHtml(symbol.color || '#000000');
  const backgroundStyle = symbol.fill && symbol.fillColor
    ? `background-color:${escapeHtml(symbol.fillColor)};`
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
  if (typeof popup?.template === 'string' && popup.template.trim()) {
    return renderPopupTemplate(popup.template, properties, metadata);
  }
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

function renderPopupTemplate(template, properties, metadata) {
  const valueFor = (name) => {
    const parts = String(name || '').trim().split('.').filter(Boolean);
    let value = parts[0] === 'heurist' ? metadata : properties;
    if (parts[0] === 'heurist') parts.shift();
    for (const part of parts) {
      if (!value || typeof value !== 'object') return '';
      value = value[part];
    }
    return value == null ? '' : formatPopupValue(value);
  };
  const rendered = String(template).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, name) => valueFor(name));
  return escapeHtml(rendered).replaceAll('\n', '<br>');
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

function getFeatureSelectionMetadata(feature) {
  const metadata = feature?.properties?.heurist || {};
  return {
    featureId: String(metadata.featureId ?? feature?.id ?? ''),
    recordId: Number.isInteger(Number(metadata.recordId)) ? Number(metadata.recordId) : null
  };
}

function toPublicLatLng(latlng) {
  return latlng ? { latitude: latlng.lat, longitude: latlng.lng } : null;
}

function rememberSelectionBaseStyle(layer, storage) {
  const options = layer.options || {};
  storage.set(layer, {
    color: options.color,
    weight: options.weight,
    opacity: options.opacity,
    fillColor: options.fillColor,
    fillOpacity: options.fillOpacity,
    radius: typeof layer.getRadius === 'function' ? layer.getRadius() : null
  });
}

function applyNativeSelection(layer, selected, storage, opacityMultiplier = 1, selectionSymbol = null) {
  const base = storage.get(layer) || {};
  const symbol = selectionSymbol && typeof selectionSymbol === 'object' ? selectionSymbol : {};
  if (typeof layer.setStyle === 'function') {
    const restoredStyle = compactOptions({
      color: base.color,
      weight: base.weight,
      opacity: finiteOpacity(base.opacity, 1) * opacityMultiplier,
      fillColor: base.fillColor,
      fillOpacity: finiteOpacity(base.fillOpacity, 0.2) * opacityMultiplier
    });
    const selectedWeight = symbol.weight ?? Math.max(Number(base.weight) || 2, 4);
    const selectedFillOpacity = symbol.fillOpacity
      ?? Math.max(Number(base.fillOpacity) || 0, 0.35);
    layer.setStyle(selected ? compactOptions({
      color: symbol.color ?? '#ff0000',
      weight: selectedWeight,
      opacity: finiteOpacity(symbol.opacity, 1) * opacityMultiplier,
      fillColor: symbol.fillColor ?? '#ffff00',
      fillOpacity: finiteOpacity(selectedFillOpacity, 0.35) * opacityMultiplier,
      dashArray: symbol.dashArray,
      fill: symbol.fill,
      stroke: symbol.stroke
    }) : restoredStyle);
    if (base.radius != null && typeof layer.setRadius === 'function') {
      const radius = Number(symbol.radius);
      layer.setRadius(selected
        ? (Number.isFinite(radius) && radius >= 0 ? radius : base.radius * 1.5)
        : base.radius);
    }
  }
  const element = typeof layer.getElement === 'function' ? layer.getElement() : null;
  element?.classList.toggle('heurist-map-feature-selected', selected);
  if (selected && typeof layer.bringToFront === 'function') layer.bringToFront();
}

function getNativeFeatureBounds(layer) {
  if (typeof layer.getBounds === 'function') return layer.getBounds();
  if (typeof layer.getLatLng === 'function') {
    const point = layer.getLatLng();
    return point ? L.latLngBounds(point, point) : null;
  }
  return null;
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
