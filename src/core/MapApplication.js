/**
 * MapApplication.js - Engine-neutral map controller
 *
 * @fileOverview Coordinates map initialization, MapDocument loading, layer preparation, rendering, application state, cancellation, and public map operations.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { normalizeMapDocument } from '../map-document/MapDocument.js';
import { createMapEnvironment } from '../map-document/createMapEnvironment.js';

/**
 * Engine-neutral application controller.
 */
export class MapApplication {
  /**
   * Create and initialize the class instance.
   */
  constructor({ container, config, mapEngine, host, providers = {}, layerLoaders }) {
    this.container = container;
    this.config = config;
    this.mapEngine = mapEngine;
    this.host = host;
    this.providers = providers;
    this.layerLoaders = layerLoaders;
    this.mapEnvironment = createMapEnvironment(config.mapDocument);
    this.layers = new Map();
    this.initialized = false;
    this.destroyed = false;
    this.activeLoadController = null;
  }

  /**
   * Initialize the component and its required resources.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async initialize() {
    this.assertActive();
    await this.host.initialize({ application: this, config: this.config });

    try {
      await this.initializeMapEngine(this.mapEnvironment);
      await this.applyInitialView(this.mapEnvironment.initialView);
      this.initialized = true;
      this.dispatch('heurist-map-ready', { mapDocument: this.config.mapDocument });
    } catch (error) {
      await this.mapEngine.destroy();
      await this.host.destroy();
      throw addContext(error, 'Cannot initialize map rendering');
    }
  }

  /**
   * Load, prepare, and render a MapDocument and its ordered MapLayer references.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async loadMapDocument(recordId, { signal } = {}) {
    this.assertActive();
    this.assertDataIntegrationConfigured();

    this.cancelPendingRequests('Superseded by a newer MapDocument request');
    const controller = new AbortController();
    this.activeLoadController = controller;
    const combinedSignal = combineAbortSignals(controller.signal, signal);

    try {
      const mapDocument = await this.providers.mapDocument.getById(recordId, {
        signal: combinedSignal
      });
      const runtimeLayers = await this.prepareReferencedLayers(mapDocument, combinedSignal);
      const environment = createMapEnvironment(mapDocument);

      throwIfAborted(combinedSignal);
      await this.replaceMapEnvironment(mapDocument, environment, runtimeLayers);

      this.dispatch('heurist-map-document-loaded', {
        mapDocument,
        layerCount: runtimeLayers.length
      });
      return mapDocument;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      throw addContext(error, `Cannot load MapDocument record ${recordId}`);
    } finally {
      if (this.activeLoadController === controller) {
        this.activeLoadController = null;
      }
    }
  }

  /**
   * Cancel the currently active MapDocument or data-loading request.
   * @returns {boolean} Operation result.
   */
  cancelPendingRequests(reason = 'Map request cancelled') {
    if (!this.activeLoadController) {
      return false;
    }
    this.activeLoadController.abort(new DOMException(reason, 'AbortError'));
    this.activeLoadController = null;
    return true;
  }

  /**
   * Add an engine-neutral runtime layer and register its application state.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async addLayer(definition) {
    this.assertActive();
    if (!definition?.id) {
      throw new TypeError('Layer definition requires an id');
    }
    if (this.layers.has(definition.id)) {
      throw new Error(`Layer "${definition.id}" already exists`);
    }

    // Keep only lightweight, engine-neutral metadata in the application
    // registry. Large GeoJSON payloads remain in the rendering pipeline and
    // are never cloned by getLayer(), getLayers(), or layer events.
    const state = createLayerState(definition);
    this.layers.set(state.id, state);

    try {
      const result = await this.mapEngine.addLayer(definition);
      state.loadState = 'loaded';
      this.dispatch('heurist-map-layer-loaded', { layer: this.getLayer(state.id) });
      return result;
    } catch (error) {
      state.loadState = 'error';
      state.error = serializeError(error);
      this.dispatch('heurist-map-error', {
        operation: 'add-layer',
        layer: this.getLayer(state.id),
        error: state.error
      });
      throw addContext(error, `Cannot render layer "${state.title || state.id}"`);
    }
  }

  /**
   * Remove a runtime layer from the map and application registry.
   * @returns {Promise<boolean>} Resolves with whether a layer was removed.
   */
  async removeLayer(layerId) {
    this.assertActive();
    const removed = await this.mapEngine.removeLayer(layerId);
    if (removed) {
      this.layers.delete(layerId);
    }
    return removed;
  }

  /**
   * Show or hide a runtime layer.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async setLayerVisibility(layerId, visible) {
    this.assertActive();
    await this.mapEngine.setLayerVisibility(layerId, visible);
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.visible = Boolean(visible);
    }
    this.dispatch('heurist-map-layer-visibility-changed', {
      layerId,
      visible: Boolean(visible)
    });
  }

  /**
   * Return all registered runtime layers in display order.
   * @returns {Array<Object>} Cloned runtime layer descriptions.
   */
  getLayers() {
    return [...this.layers.values()]
      .sort(compareRuntimeLayers)
      .map(clonePlain);
  }

  /**
   * Return one registered runtime layer by ID.
   * @returns {?Object} Cloned runtime layer description, or null.
   */
  getLayer(layerId) {
    const layer = this.layers.get(layerId);
    return layer ? clonePlain(layer) : null;
  }

  /**
   * Reload a persisted MapLayer record and replace its rendered runtime layer.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async reloadLayer(layerId, { signal } = {}) {
    this.assertDataIntegrationConfigured();
    const current = this.layers.get(layerId);
    if (!current?.recordId) {
      throw new Error(`Layer "${layerId}" is not backed by a MapLayer record`);
    }

    const reference = {
      id: current.id,
      recordId: current.recordId,
      order: current.order
    };
    const mapLayer = await this.providers.mapLayer.getById(current.recordId, { signal });
    const runtimeLayer = await this.createRuntimeLayer(mapLayer, reference, signal);
    await this.removeLayer(layerId);
    return this.addLayer(runtimeLayer);
  }

  /**
   * Remove all runtime layers from the application.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async clearLayers() {
    for (const layerId of [...this.layers.keys()]) {
      await this.removeLayer(layerId);
    }
  }

  /**
   * Set the map center and zoom.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async setView(center, zoom, options = {}) {
    this.assertActive();
    return this.mapEngine.setView(center, zoom, options);
  }

  /**
   * Fit the map viewport to geographic bounds.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async fitBounds(bounds, options = {}) {
    this.assertActive();
    return this.mapEngine.fitBounds(bounds, options);
  }

  /**
   * Notify the map engine that its container dimensions changed.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async invalidateSize() {
    this.assertActive();
    return this.mapEngine.invalidateSize();
  }

  /**
   * Return the current engine-neutral map view state.
   * @returns {*} Method result.
   */
  getViewState() {
    this.assertActive();
    return this.mapEngine.getViewState();
  }

  /**
   * Return the current public MapDocument representation.
   * @returns {*} Method result.
   */
  getMapDocument() {
    return clonePlain(this.config.mapDocument);
  }

  /**
   * Return supported application or map-engine capabilities.
   * @returns {*} Method result.
   */
  getCapabilities() {
    return {
      ...this.mapEngine.getCapabilities(),
      publicApi: Boolean(this.config.apiBaseUrl || this.config.serverUrl)
        && Boolean(this.config.database),
      mapDocuments: Boolean(this.providers.mapDocument),
      queryGeoJson: Boolean(this.providers.queryGeoData),
      remoteGeoJson: true,
      timeline: false,
      editing: !this.config.readonly && this.host.supportsEditing()
    };
  }

  /**
   * Release resources, handlers, requests, layers, and host integrations.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async destroy() {
    if (this.destroyed) {
      return;
    }
    this.cancelPendingRequests('Map application destroyed');
    this.layers.clear();
    await this.mapEngine.destroy();
    await this.host.destroy();
    this.destroyed = true;
    this.initialized = false;
  }

  /**
   * Prepare referenced layers.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async prepareReferencedLayers(mapDocument, signal) {
    const references = [...mapDocument.layers].sort(compareLayerReferences);
    const result = [];

    for (const reference of references) {
      throwIfAborted(signal);
      let mapLayer;
      try {
        mapLayer = await this.providers.mapLayer.getById(reference.recordId, { signal });
      } catch (error) {
        throw addContext(error, `Cannot load MapLayer record ${reference.recordId}`);
      }

      try {
        result.push(await this.createRuntimeLayer(mapLayer, reference, signal));
      } catch (error) {
        throw addContext(error, `Cannot prepare MapLayer record ${reference.recordId}`);
      }
    }
    return result;
  }

  /**
   * Create runtime layer.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async createRuntimeLayer(mapLayer, reference, signal) {
    if (!this.layerLoaders) {
      throw new Error('MapLayer loader registry is not configured');
    }
    return this.layerLoaders.load(mapLayer, { reference, signal, application: this });
  }

  /**
   * Replace map environment.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async replaceMapEnvironment(mapDocument, environment, runtimeLayers) {
    await this.mapEngine.destroy();
    this.layers.clear();

    try {
      await this.initializeMapEngine(environment);
      for (const layer of runtimeLayers) {
        await this.addLayer(layer);
      }
      await this.applyInitialView(environment.initialView);
    } catch (error) {
      await this.mapEngine.destroy();
      this.layers.clear();
      throw addContext(
        error,
        'Map data was loaded but the new MapDocument could not be rendered; the map must be reinitialized'
      );
    }

    this.config.mapDocument = normalizeMapDocument(mapDocument);
    this.mapEnvironment = environment;
    this.initialized = true;
  }

  /**
   * Initialize map engine.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async initializeMapEngine(environment) {
    const initialView = environment.initialView;
    await this.mapEngine.initialize(this.container, {
      center: initialView.center,
      zoom: initialView.zoom,
      crs: environment.crs,
      controls: { zoom: true, attribution: true },
      baseLayer: environment.baseMap
    });
  }

  /**
   * Apply initial view.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async applyInitialView(initialView) {
    if (initialView.type === 'bounds') {
      await this.fitBounds(initialView.bounds, { animate: false });
    }
  }

  /**
   * Assert data integration configured.
   * @returns {*} Method result.
   */
  assertDataIntegrationConfigured() {
    if (!this.providers.mapDocument || !this.providers.mapLayer || !this.providers.queryGeoData) {
      throw new Error('Heurist public API providers are not configured');
    }
    if (!(this.config.apiBaseUrl || this.config.serverUrl) || !this.config.database) {
      throw new Error(
        'MapDocument loading requires heuristMapOptions.apiBaseUrl (or serverUrl) and database'
      );
    }
  }

  /**
   * Dispatch.
   * @returns {*} Method result.
   */
  dispatch(name, detail) {
    this.container.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /**
   * Assert active.
   * @returns {*} Method result.
   */
  assertActive() {
    if (this.destroyed) {
      throw new Error('The map application has been destroyed');
    }
  }
}

function createLayerState(definition) {
  return {
    id: definition.id,
    recordId: definition.recordId ?? null,
    title: definition.title ?? '',
    description: definition.description ?? '',
    type: definition.type ?? null,
    source: clonePlain(definition.source ?? null),
    style: clonePlain(definition.style ?? null),
    popup: clonePlain(definition.popup ?? null),
    options: clonePlain(definition.options ?? null),
    order: Number(definition.order ?? 0),
    visible: definition.visible !== false,
    selectable: definition.selectable !== false,
    featureCount: getFeatureCount(definition),
    loadState: 'loading',
    error: null
  };
}

function getFeatureCount(definition) {
  if (definition.type !== 'geojson') {
    return null;
  }
  if (Array.isArray(definition.data?.features)) {
    return definition.data.features.length;
  }
  return definition.data ? 1 : 0;
}

function compareLayerReferences(a, b) {
  const orderDifference = Number(a.order || 0) - Number(b.order || 0);
  return orderDifference || Number(a.recordId || a.id) - Number(b.recordId || b.id);
}

function compareRuntimeLayers(a, b) {
  return Number(a.order || 0) - Number(b.order || 0)
    || String(a.id).localeCompare(String(b.id));
}

function combineAbortSignals(internalSignal, externalSignal) {
  if (!externalSignal) return internalSignal;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([internalSignal, externalSignal]);
  }
  const controller = new AbortController();
  const abort = (signal) => controller.abort(
    signal.reason || new DOMException('The request was aborted', 'AbortError')
  );
  for (const signal of [internalSignal, externalSignal]) {
    if (signal.aborted) {
      abort(signal);
      break;
    }
    signal.addEventListener('abort', () => abort(signal), { once: true });
  }
  return controller.signal;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('The request was aborted', 'AbortError');
  }
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function addContext(error, context) {
  if (isAbortError(error)) return error;
  const contextualError = new Error(`${context}: ${error?.message || String(error)}`, { cause: error });
  contextualError.name = error?.name || 'Error';
  for (const property of ['status', 'statusText', 'url', 'method', 'code', 'details']) {
    if (error?.[property] !== undefined) contextualError[property] = error[property];
  }
  return contextualError;
}

function clonePlain(value) {
  if (value === undefined) return undefined;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function serializeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code ?? null,
    status: error?.status ?? null
  };
}
