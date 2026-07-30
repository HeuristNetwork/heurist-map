import { normalizeMapDocument } from '../map-document/MapDocument.js';
import { createMapEnvironment } from '../map-document/createMapEnvironment.js';

/**
 * Engine-neutral application controller.
 */
export class MapApplication {
  constructor({ container, config, mapEngine, host, providers = {} }) {
    this.container = container;
    this.config = config;
    this.mapEngine = mapEngine;
    this.host = host;
    this.providers = providers;
    this.mapEnvironment = createMapEnvironment(config.mapDocument);
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
      this.dispatch('heurist-map-ready', {
        mapDocument: this.config.mapDocument
      });
    } catch (error) {
      await this.mapEngine.destroy();
      await this.host.destroy();
      throw error;
    }
  }

  /**
   * Load a MapDocument and every referenced MapLayer from the public API.
   * The existing map remains visible until all API data has been prepared.
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
    return this.mapEngine.addLayer(definition);
  }

  async removeLayer(layerId) {
    this.assertActive();
    return this.mapEngine.removeLayer(layerId);
  }

  async setLayerVisibility(layerId, visible) {
    this.assertActive();
    return this.mapEngine.setLayerVisibility(layerId, visible);
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
    return this.config.mapDocument;
  }

  getCapabilities() {
    return {
      ...this.mapEngine.getCapabilities(),
      publicApi: Boolean(this.config.apiBaseUrl || this.config.serverUrl)
        && Boolean(this.config.database),
      mapDocuments: Boolean(this.providers.mapDocument),
      queryGeoJson: Boolean(this.providers.queryGeoData),
      timeline: false,
      editing: !this.config.readonly && this.host.supportsEditing()
    };
  }

  async destroy() {
    if (this.destroyed) {
      return;
    }

    this.cancelPendingRequests('Map application destroyed');
    await this.mapEngine.destroy();
    await this.host.destroy();
    this.destroyed = true;
    this.initialized = false;
  }

  async prepareReferencedLayers(mapDocument, signal) {
    const references = [...mapDocument.layers].sort(compareLayerReferences);
    const result = [];
    // Sequential loading preserves deterministic request/addition order and
    // avoids overloading a Heurist instance with many simultaneous searches.
    for (const reference of references) {
      throwIfAborted(signal);

      let mapLayer;
      try {
        mapLayer = await this.providers.mapLayer.getById(reference.recordId, { signal });
      } catch (error) {
        throw addContext(error, `Cannot load MapLayer record ${reference.recordId}`);
      }

      let runtimeLayer;
      try {
        runtimeLayer = await this.createRuntimeLayer(mapLayer, reference, signal);
      } catch (error) {
        throw addContext(error, `Cannot prepare MapLayer record ${reference.recordId}`);
      }

      result.push(runtimeLayer);
    }

    return result;
  }

  async createRuntimeLayer(mapLayer, reference, signal) {
    const source = mapLayer.source;
    let geoJson;
console.log('createRuntimeLayer', mapLayer, reference, source);
    switch (source.type) {
      case 'heurist-query':
        geoJson = await this.providers.queryGeoData.searchAll({
          query: source.query,
          limit: source.limit || 1000,
          simplify: source.simplify === true,
          signal
        });
        break;

      case 'record':
        geoJson = await this.providers.queryGeoData.getRecord(
          source.recordId,
          { simplify: source.simplify === true, signal }
        );
        break;

      case 'inline-geojson':
        geoJson = source.data;
        break;

      default:
        throw new Error(
          `MapLayer source type "${source.type}" is not supported in Phase 2`
        );
    }

    return {
      id: mapLayer.id,
      recordId: mapLayer.id,
      title: reference.title || mapLayer.title,
      type: 'geojson',
      visible: reference.visible !== false && mapLayer.visible !== false,
      selectable: mapLayer.selectable,
      data: geoJson,
      style: mapLayer.style,
      options: mapLayer.options,
      source
    };
  }

  async replaceMapEnvironment(mapDocument, environment, runtimeLayers) {
    await this.mapEngine.destroy();

    try {
      await this.initializeMapEngine(environment);
      for (const layer of runtimeLayers) {
        await this.addLayer(layer);
      }
      await this.applyInitialView(environment.initialView);
    } catch (error) {
      await this.mapEngine.destroy();
      throw error;
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

function combineAbortSignals(internalSignal, externalSignal) {
  if (!externalSignal) {
    return internalSignal;
  }
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([internalSignal, externalSignal]);
  }

  const controller = new AbortController();
  const abort = (signal) => {
    controller.abort(signal.reason || new DOMException('The request was aborted', 'AbortError'));
  };

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
  if (isAbortError(error)) {
    return error;
  }

  const contextualError = new Error(`${context}: ${error?.message || String(error)}`, {
    cause: error
  });
  contextualError.name = error?.name || 'Error';

  for (const property of ['status', 'statusText', 'url', 'method', 'code', 'details']) {
    if (error?.[property] !== undefined) {
      contextualError[property] = error[property];
    }
  }

  return contextualError;
}
