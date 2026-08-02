/**
 * HeuristMapPublicApi.js - Stable public mapping API
 *
 * @fileOverview Exposes a narrow engine-neutral API for direct use and same-origin iframe wrappers without leaking application or Leaflet internals.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

/**
 * Stable public facade for direct and same-origin iframe integrations.
 */
export class HeuristMapPublicApi {
  /**
   * Create and initialize the class instance.
   */
  constructor(application) {
    this.application = application;
    this.readyPromise = null;
  }

  /**
   * Set the promise that resolves when application initialization completes.
   * @returns {*} Method result.
   */
  setReadyPromise(promise) {
    this.readyPromise = promise;
  }

  /**
   * Return the application initialization promise.
   * @returns {Promise<HeuristMapPublicApi>} Initialization promise.
   */
  ready() {
    return this.readyPromise || Promise.resolve(this);
  }

  /**
   * Return the current public MapDocument representation.
   * @returns {*} Method result.
   */
  getMapDocument() {
    return this.application.getMapDocument();
  }

  /**
   * Load, prepare, and render a MapDocument and its ordered MapLayer references.
   * @returns {*} Method result.
   */
  loadMapDocument(recordId, options = {}) {
    return this.application.loadMapDocument(recordId, options);
  }


  /** Load a lightweight list of available MapDocuments. */
  loadMapDocuments(query = null, options = {}) {
    return this.application.loadMapDocuments(query, options);
  }

  /** Return lightweight available MapDocument entries. */
  getMapDocuments() { return this.application.getMapDocuments(); }

  /** Activate one mutually exclusive persisted MapDocument. */
  activateMapDocument(documentId, options = {}) {
    return this.application.activateMapDocument(documentId, options);
  }

  /** Return the active lightweight MapDocument entry. */
  getActiveMapDocument() { return this.application.getActiveMapDocument(); }

  /** Zoom to a MapDocument bookmark or bounds. */
  zoomToMapDocument(documentId) { return this.application.zoomToMapDocument(documentId); }

  /** Return configured base maps. */
  getBaseMaps() { return this.application.getBaseMaps(); }

  /** Return the active base map. */
  getActiveBaseMap() { return this.application.getActiveBaseMap(); }

  /** Replace the active base map. */
  setBaseMap(baseMapId) { return this.application.setBaseMap(baseMapId); }

  /** Zoom to a rendered or bounded layer. */
  zoomToLayer(layerId) { return this.application.zoomToLayer(layerId); }

  /** Set a runtime global opacity multiplier; accepts 0-1 or 0-100. */
  setLayerOpacity(layerId, opacity) { return this.application.setLayerOpacity(layerId, opacity); }

  /** Dispatch an edit request without coupling the map to Heurist forms. */
  requestEditMapDocument(documentId) { return this.application.requestEditMapDocument(documentId); }

  /** Dispatch an edit request without coupling the map to Heurist forms. */
  requestEditLayer(layerId) { return this.application.requestEditLayer(layerId); }

  /** Subscribe to public map lifecycle events. */
  addEventListener(name, handler, options) { this.application.container.addEventListener(name, handler, options); }

  /** Unsubscribe from public map lifecycle events. */
  removeEventListener(name, handler, options) { this.application.container.removeEventListener(name, handler, options); }

  /**
   * Cancel the currently active MapDocument or data-loading request.
   * @returns {boolean} Operation result.
   */
  cancelPendingRequests(reason) {
    return this.application.cancelPendingRequests(reason);
  }

  /**
   * Add an engine-neutral runtime layer and register its application state.
   * @returns {*} Method result.
   */
  addLayer(definition) {
    return this.application.addLayer(definition);
  }

  /**
   * Remove a runtime layer from the map and application registry.
   * @returns {Promise<boolean>} Resolves with whether a layer was removed.
   */
  removeLayer(layerId) {
    return this.application.removeLayer(layerId);
  }

  /**
   * Show or hide a runtime layer.
   * @returns {*} Method result.
   */
  setLayerVisibility(layerId, visible) {
    return this.application.setLayerVisibility(layerId, visible);
  }

  /**
   * Return all registered runtime layers in display order.
   * @returns {Array<Object>} Cloned runtime layer descriptions.
   */
  getLayers() {
    return this.application.getLayers();
  }

  /**
   * Return one registered runtime layer by ID.
   * @returns {?Object} Cloned runtime layer description, or null.
   */
  getLayer(layerId) {
    return this.application.getLayer(layerId);
  }

  /**
   * Reload a persisted MapLayer record and replace its rendered runtime layer.
   * @returns {*} Method result.
   */
  reloadLayer(layerId, options = {}) {
    return this.application.reloadLayer(layerId, options);
  }

  /**
   * Remove all runtime layers from the application.
   * @returns {*} Method result.
   */
  clearLayers() {
    return this.application.clearLayers();
  }

  /**
   * Set the map center and zoom.
   * @returns {*} Method result.
   */
  setView(center, zoom, options = {}) {
    return this.application.setView(center, zoom, options);
  }

  /**
   * Fit the map viewport to geographic bounds.
   * @returns {*} Method result.
   */
  fitBounds(bounds, options = {}) {
    return this.application.fitBounds(bounds, options);
  }

  /**
   * Notify the map engine that its container dimensions changed.
   * @returns {*} Method result.
   */
  invalidateSize() {
    return this.application.invalidateSize();
  }

  /**
   * Return the current engine-neutral map view state.
   * @returns {*} Method result.
   */
  getViewState() {
    return this.application.getViewState();
  }

  /**
   * Return supported application or map-engine capabilities.
   * @returns {*} Method result.
   */
  getCapabilities() {
    return this.application.getCapabilities();
  }

  /**
   * Release resources, handlers, requests, layers, and host integrations.
   * @returns {*} Method result.
   */
  destroy() {
    return this.application.destroy();
  }
}
