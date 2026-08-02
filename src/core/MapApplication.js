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
    this.deferredLayers = new Map();
    this.pendingLayerLoads = new Map();
    this.initialized = false;
    this.destroyed = false;
    this.activeLoadController = null;
    this.documentActivationSerial = 0;
    this.defaultBaseMapId = config.baseMaps?.[0]?.id || null;
    this.mapDocuments = new Map();
    this.activeMapDocumentId = null;
    this.controlPanel = null;
    this.baseMaps = new Map((config.baseMaps || []).map((item) => [String(item.id), clonePlain(item)]));
    this.activeBaseMapId = config.mapDocument?.worldBaseMap?.code || config.baseMaps?.[0]?.id || null;
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

  /** Load the lightweight list of available MapDocuments. */
  async loadMapDocuments(query = null, { signal, activateFirst = true } = {}) {
    this.assertActive();
    if (!this.providers.mapDocumentList) {
      throw new Error('MapDocument list provider is not configured');
    }
    this.dispatch('heurist-map-documents-loading', { query });
    const previousActiveId = this.activeMapDocumentId;
    try {
      const result = await this.providers.mapDocumentList.search(query, { signal });
      this.mapDocuments.clear();
      for (const entry of result.items) {
        const active = entry.id === previousActiveId;
        this.mapDocuments.set(entry.id, {
          ...entry, kind: 'record', active, activating: false,
          loadState: active ? 'loaded' : 'available', error: null
        });
      }
      if (previousActiveId && !this.mapDocuments.has(previousActiveId)) this.activeMapDocumentId = null;
      this.dispatch('heurist-map-documents-loaded', { documents: this.getMapDocuments(), pagination: result.pagination });
      const targetId = this.activeMapDocumentId && this.mapDocuments.has(this.activeMapDocumentId)
        ? this.activeMapDocumentId
        : result.items[0]?.id;
      if (activateFirst && targetId && this.config.mapDocument?.id !== targetId) {
        await this.activateMapDocument(targetId, { signal });
      }
      return this.getMapDocuments();
    } catch (error) {
      this.dispatch('heurist-map-error', { operation: 'load-map-documents', error: serializeError(error) });
      throw addContext(error, 'Cannot load MapDocument list');
    }
  }

  /** Return available MapDocuments in API order. */
  getMapDocuments() { return [...this.mapDocuments.values()].map(clonePlain); }

  /** Return the active MapDocument list entry. */
  getActiveMapDocument() {
    const item = this.mapDocuments.get(this.activeMapDocumentId);
    return item ? clonePlain(item) : null;
  }

  /** Activate exactly one persisted MapDocument. */
  async activateMapDocument(documentId, { signal, force = false } = {}) {
    const id = Number(documentId);
    const item = this.mapDocuments.get(id);
    if (!item) throw new Error(`MapDocument ${documentId} is not in the available document list`);
    if (!force && this.activeMapDocumentId === id && this.config.mapDocument?.id === id) {
      return this.config.mapDocument;
    }

    const activationSerial = ++this.documentActivationSerial;
    this.cancelPendingRequests('Superseded by a newer MapDocument activation');
    for (const document of this.mapDocuments.values()) document.activating = false;
    item.activating = true;
    item.loadState = 'loading';
    item.error = null;
    this.dispatch('heurist-map-document-activating', { document: clonePlain(item) });
    this.dispatch('heurist-map-documents-changed', { documents: this.getMapDocuments() });

    try {
      const document = await this.loadMapDocument(id, { signal });
      if (activationSerial !== this.documentActivationSerial) {
        throw new DOMException('Stale MapDocument activation', 'AbortError');
      }

      for (const documentItem of this.mapDocuments.values()) {
        documentItem.active = documentItem.id === id;
        documentItem.activating = false;
      }
      this.activeMapDocumentId = id;
      item.loadState = 'loaded';
      item.error = null;
      await this.applyDocumentBaseMap(document);
      this.dispatch('heurist-map-document-activated', { document: clonePlain(item), mapDocument: document });
      this.dispatch('heurist-map-documents-changed', { documents: this.getMapDocuments() });
      return document;
    } catch (error) {
      if (activationSerial === this.documentActivationSerial) {
        item.activating = false;
        item.loadState = isAbortError(error) ? 'available' : 'error';
        item.error = isAbortError(error) ? null : serializeError(error);
        this.dispatch('heurist-map-document-state-changed', { document: clonePlain(item) });
        this.dispatch('heurist-map-documents-changed', { documents: this.getMapDocuments() });
      }
      throw error;
    }
  }

  /** Reload a persisted MapDocument and keep it active. */
  async reloadMapDocument(documentId = this.activeMapDocumentId, options = {}) {
    if (!documentId) throw new Error('No MapDocument is active');
    return this.activateMapDocument(documentId, { ...options, force: true });
  }

  /** Unload the active MapDocument layers and restore the default base map. */
  async unloadMapDocument(documentId = this.activeMapDocumentId) {
    const id = Number(documentId);
    if (!id || id !== this.activeMapDocumentId) return false;
    this.documentActivationSerial += 1;
    this.cancelPendingRequests('MapDocument unloaded');
    await this.clearLayers();
    const item = this.mapDocuments.get(id);
    if (item) { item.active = false; item.activating = false; item.loadState = 'available'; item.error = null; }
    this.activeMapDocumentId = null;
    this.config.mapDocument = normalizeMapDocument({});
    await this.restoreDefaultBaseMap();
    this.dispatch('heurist-map-document-unloaded', { documentId: id });
    this.dispatch('heurist-map-documents-changed', { documents: this.getMapDocuments() });
    return true;
  }

  /** Zoom to a document bookmark, bounds, or combined visible layer extent. */
  async zoomToMapDocument(documentId) {
    const id = Number(documentId);
    const document = this.config.mapDocument?.id === id
      ? this.config.mapDocument
      : await this.providers.mapDocument.getById(id);
    const view = createMapEnvironment(document).initialView;
    if (view.type === 'bounds') return this.fitBounds(view.bounds, { animate: false });
    if (document.mapBookmark?.type === 'point' || (document.mapBookmark?.type === 'view' && document.mapBookmark?.raw)) {
      return this.setView(view.center, view.zoom, { animate: false });
    }
    const combined = await this.mapEngine.getVisibleLayerBounds?.();
    if (combined) return this.fitBounds(combined, { animate: false });
    return this.setView(view.center, view.zoom, { animate: false });
  }

  /** Zoom to the active MapDocument. */
  async zoomHome() {
    if (this.activeMapDocumentId) return this.zoomToMapDocument(this.activeMapDocumentId);
    const view = this.mapEnvironment.initialView;
    if (view.type === 'bounds') return this.fitBounds(view.bounds, { animate: false });
    return this.setView(view.center, view.zoom, { animate: false });
  }

  /** Return configured engine-neutral base-map definitions. */
  getBaseMaps() { return [...this.baseMaps.values()].map(clonePlain); }

  /** Return the active base-map definition. */
  getActiveBaseMap() {
    const item = this.baseMaps.get(String(this.activeBaseMapId));
    return item ? clonePlain(item) : null;
  }

  /** Replace the active base map while preserving operational layers. */
  async setBaseMap(baseMapId) {
    const item = this.baseMaps.get(String(baseMapId));
    if (!item) throw new Error(`Unknown base map "${baseMapId}"`);
    await this.mapEngine.setBaseMap(item.type === 'none' ? null : item);
    this.activeBaseMapId = item.id;
    this.dispatch('heurist-map-basemap-changed', { baseMap: clonePlain(item) });
    return clonePlain(item);
  }

  async applyDocumentBaseMap(document) {
    const code = document?.worldBaseMap?.code;
    if (code && this.baseMaps.has(String(code))) return this.setBaseMap(code);
    if (document?.worldBaseMap === null && this.baseMaps.has('None')) return this.setBaseMap('None');
    return this.restoreDefaultBaseMap();
  }

  async restoreDefaultBaseMap() {
    if (this.defaultBaseMapId != null && this.baseMaps.has(String(this.defaultBaseMapId))) {
      return this.setBaseMap(this.defaultBaseMapId);
    }
    await this.mapEngine.setBaseMap(null);
    this.activeBaseMapId = null;
    this.dispatch('heurist-map-basemap-changed', { baseMap: null });
    return null;
  }

  /** Zoom to a layer extent from source metadata or the map engine. */
  async zoomToLayer(layerId) {
    const layer = this.layers.get(layerId);
    if (!layer) throw new Error(`Layer "${layerId}" is not registered`);
    const bounds = layer.source?.bounds || await this.mapEngine.getLayerBounds(layerId);
    if (!bounds) throw new Error(`Layer "${layer.title || layerId}" does not define an extent`);
    return this.fitBounds(bounds, { animate: false });
  }

  /** Apply a runtime global opacity multiplier; accepts 0-1 or 0-100. */
  async setLayerOpacity(layerId, opacity) {
    const value = normalizeRuntimeOpacity(opacity);
    const layer = this.layers.get(layerId);
    if (!layer) throw new Error(`Layer "${layerId}" is not registered`);
    layer.opacity = value;
    if (!this.deferredLayers.has(layerId)) await this.mapEngine.setLayerOpacity(layerId, value);
    this.dispatch('heurist-map-layer-opacity-changed', { layerId, opacity: value, layer: this.getLayer(layerId) });
    return value;
  }

  requestEditMapDocument(documentId) {
    this.dispatch('heurist-map-edit-document-requested', { documentId: Number(documentId) });
  }

  requestEditLayer(layerId) {
    const layer = this.layers.get(layerId);
    this.dispatch('heurist-map-edit-layer-requested', { layerId, recordId: layer?.recordId ?? null });
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
      const preparedLayers = await this.prepareReferencedLayers(mapDocument, combinedSignal);
      const environment = createMapEnvironment(mapDocument);

      throwIfAborted(combinedSignal);
      await this.replaceMapEnvironment(mapDocument, environment, preparedLayers);

      this.dispatch('heurist-map-document-loaded', {
        mapDocument,
        layerCount: preparedLayers.length,
        loadedLayerCount: preparedLayers.filter((item) => item.runtimeLayer).length,
        deferredLayerCount: preparedLayers.filter((item) => !item.runtimeLayer).length
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
      this.dispatch('heurist-map-layer-state-changed', { layer: this.getLayer(state.id) });
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

    const pending = this.pendingLayerLoads.get(layerId);
    if (pending) {
      pending.abort(new DOMException('Layer was removed', 'AbortError'));
      this.pendingLayerLoads.delete(layerId);
    }

    if (this.deferredLayers.has(layerId)) {
      this.deferredLayers.delete(layerId);
      return this.layers.delete(layerId);
    }

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
    const nextVisible = Boolean(visible);
    const layer = this.layers.get(layerId);

    if (!layer) {
      throw new Error(`Layer "${layerId}" is not registered`);
    }

    const pending = this.pendingLayerLoads.get(layerId);
    if (!nextVisible && pending) {
      pending.controller.abort(new DOMException('Layer hidden while loading', 'AbortError'));
      const currentDeferred = this.deferredLayers.get(layerId);
      if (currentDeferred) {
        layer.loadState = 'deferred';
        layer.error = null;
      }
    } else if (nextVisible && this.deferredLayers.has(layerId)) {
      await this.loadDeferredLayer(layerId);
    } else if (!this.deferredLayers.has(layerId)) {
      await this.mapEngine.setLayerVisibility(layerId, nextVisible);
    }

    const current = this.layers.get(layerId);
    if (current) {
      current.visible = nextVisible;
    }

    this.dispatch('heurist-map-layer-visibility-changed', {
      layerId, visible: nextVisible, layer: this.getLayer(layerId)
    });
    this.dispatch('heurist-map-layer-state-changed', { layer: this.getLayer(layerId) });
  }

  /**
   * Register an initially hidden MapLayer without loading its source data.
   *
   * @param {Object} mapLayer Normalized public MapLayer definition.
   * @param {Object} reference MapDocument layer reference.
   * @returns {Object} Lightweight registered layer state.
   */
  registerDeferredLayer(mapLayer, reference) {
    const id = reference.id ?? `map-layer-${reference.recordId}`;
    const definition = {
      id,
      recordId: mapLayer.id,
      title: mapLayer.title,
      description: mapLayer.description,
      type: mapLayer.source?.type || null,
      visible: false,
      selectable: mapLayer.selectable !== false,
      source: mapLayer.source,
      style: mapLayer.style,
      options: mapLayer.options,
      order: reference.order ?? 0
    };
    const state = createLayerState(definition);
    state.visible = false;
    state.loadState = 'deferred';
    this.layers.set(id, state);
    this.deferredLayers.set(id, { mapLayer, reference });
    return state;
  }

  /**
   * Load and render a previously deferred layer on first visibility request.
   * Concurrent requests for the same layer share one promise.
   *
   * @param {string|number} layerId Runtime layer identifier.
   * @returns {Promise<Object>} Rendered runtime layer definition.
   */
  async loadDeferredLayer(layerId) {
    const deferred = this.deferredLayers.get(layerId);
    if (!deferred) {
      return this.getLayer(layerId);
    }

    const existing = this.pendingLayerLoads.get(layerId);
    if (existing?.promise) {
      return existing.promise;
    }

    const controller = new AbortController();
    const state = this.layers.get(layerId);
    if (state) {
      state.loadState = 'loading';
      state.error = null;
      this.dispatch('heurist-map-layer-state-changed', {
        layer: this.getLayer(layerId)
      });
    }

    const promise = (async () => {
      try {
        const runtimeLayer = await this.createRuntimeLayer(
          deferred.mapLayer,
          deferred.reference,
          controller.signal
        );
        runtimeLayer.visible = true;
        await this.mapEngine.addLayer(runtimeLayer);

        const loadedState = createLayerState(runtimeLayer);
        loadedState.visible = true;
        loadedState.loadState = 'loaded';
        this.layers.set(layerId, loadedState);
        this.deferredLayers.delete(layerId);

        this.dispatch('heurist-map-layer-loaded', {
          layer: this.getLayer(layerId),
          deferred: true
        });
        return runtimeLayer;
      } catch (error) {
        if (state) {
          state.loadState = isAbortError(error) ? 'deferred' : 'error';
          state.error = isAbortError(error) ? null : serializeError(error);
        }
        if (!isAbortError(error)) {
          this.dispatch('heurist-map-error', {
            operation: 'load-deferred-layer',
            layer: this.getLayer(layerId),
            error: serializeError(error)
          });
          throw addContext(error, `Cannot load deferred layer "${state?.title || layerId}"`);
        }
        throw error;
      } finally {
        this.pendingLayerLoads.delete(layerId);
      }
    })();

    this.pendingLayerLoads.set(layerId, { controller, promise });
    return promise;
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
    const shouldBeVisible = current.visible !== false;
    await this.removeLayer(layerId);

    if (!shouldBeVisible) {
      return this.registerDeferredLayer(mapLayer, reference);
    }

    const runtimeLayer = await this.createRuntimeLayer(mapLayer, reference, signal);
    runtimeLayer.visible = true;
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
    for (const pending of this.pendingLayerLoads.values()) {
      pending.controller.abort(new DOMException('Map application destroyed', 'AbortError'));
    }
    this.pendingLayerLoads.clear();
    this.deferredLayers.clear();
    this.layers.clear();
    this.controlPanel?.destroy();
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

      if (mapLayer.visible === false) {
        result.push({ mapLayer, reference, runtimeLayer: null });
        continue;
      }

      try {
        result.push({
          mapLayer,
          reference,
          runtimeLayer: await this.createRuntimeLayer(mapLayer, reference, signal)
        });
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
  async replaceMapEnvironment(mapDocument, environment, preparedLayers) {
    await this.mapEngine.destroy();
    this.deferredLayers.clear();
    this.layers.clear();

    try {
      await this.initializeMapEngine(environment);
      for (const item of preparedLayers) {
        if (item.runtimeLayer) {
          await this.addLayer(item.runtimeLayer);
        } else {
          this.registerDeferredLayer(item.mapLayer, item.reference);
        }
      }
      await this.applyInitialView(environment.initialView);
    } catch (error) {
      await this.mapEngine.destroy();
      this.deferredLayers.clear();
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
      controls: {
        zoom: this.config.ui?.showZoomControl !== false,
        scale: this.config.ui?.showScaleControl !== false,
        attribution: true
      },
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
    opacity: normalizeRuntimeOpacity(definition.opacity ?? 1),
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

function normalizeRuntimeOpacity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  const normalized = number > 1 ? number / 100 : number;
  return Math.min(1, Math.max(0, normalized));
}
