import { normalizeMapDocument } from '../map-document/MapDocument.js';
import { createMapEnvironment } from '../map-document/createMapEnvironment.js';

/**
 * Engine-neutral application controller.
 */
export class MapApplication {
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

  cancelPendingRequests(reason = 'Map request cancelled') {
    if (!this.activeLoadController) {
      return false;
    }
    this.activeLoadController.abort(new DOMException(reason, 'AbortError'));
    this.activeLoadController = null;
    return true;
  }

  async addLayer(definition) {
    this.assertActive();
    const normalized = clonePlain(definition);
    if (!normalized?.id) {
      throw new TypeError('Layer definition requires an id');
    }
    if (this.layers.has(normalized.id)) {
      throw new Error(`Layer "${normalized.id}" already exists`);
    }

    const state = {
      ...normalized,
      visible: normalized.visible !== false,
      loadState: 'loading',
      error: null
    };
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

  async removeLayer(layerId) {
    this.assertActive();
    const removed = await this.mapEngine.removeLayer(layerId);
    if (removed) {
      this.layers.delete(layerId);
    }
    return removed;
  }

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

  getLayers() {
    return [...this.layers.values()]
      .sort(compareRuntimeLayers)
      .map(clonePlain);
  }

  getLayer(layerId) {
    const layer = this.layers.get(layerId);
    return layer ? clonePlain(layer) : null;
  }

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

  async clearLayers() {
    for (const layerId of [...this.layers.keys()]) {
      await this.removeLayer(layerId);
    }
  }

  async setView(center, zoom, options = {}) {
    this.assertActive();
    return this.mapEngine.setView(center, zoom, options);
  }

  async fitBounds(bounds, options = {}) {
    this.assertActive();
    return this.mapEngine.fitBounds(bounds, options);
  }

  async invalidateSize() {
    this.assertActive();
    return this.mapEngine.invalidateSize();
  }

  getViewState() {
    this.assertActive();
    return this.mapEngine.getViewState();
  }

  getMapDocument() {
    return clonePlain(this.config.mapDocument);
  }

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

  async createRuntimeLayer(mapLayer, reference, signal) {
    if (!this.layerLoaders) {
      throw new Error('MapLayer loader registry is not configured');
    }
    return this.layerLoaders.load(mapLayer, { reference, signal, application: this });
  }

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

  async applyInitialView(initialView) {
    if (initialView.type === 'bounds') {
      await this.fitBounds(initialView.bounds, { animate: false });
    }
  }

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

  dispatch(name, detail) {
    this.container.dispatchEvent(new CustomEvent(name, { detail }));
  }

  assertActive() {
    if (this.destroyed) {
      throw new Error('The map application has been destroyed');
    }
  }
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
