/**
 * Stable public facade for direct and same-origin iframe integrations.
 */
export class HeuristMapPublicApi {
  constructor(application) {
    this.application = application;
    this.readyPromise = null;
  }

  setReadyPromise(promise) {
    this.readyPromise = promise;
  }

  ready() {
    return this.readyPromise || Promise.resolve(this);
  }

  getMapDocument() {
    return this.application.getMapDocument();
  }

  loadMapDocument(recordId, options = {}) {
    return this.application.loadMapDocument(recordId, options);
  }

  cancelPendingRequests(reason) {
    return this.application.cancelPendingRequests(reason);
  }

  addLayer(definition) {
    return this.application.addLayer(definition);
  }

  removeLayer(layerId) {
    return this.application.removeLayer(layerId);
  }

  setLayerVisibility(layerId, visible) {
    return this.application.setLayerVisibility(layerId, visible);
  }

  setView(center, zoom, options = {}) {
    return this.application.setView(center, zoom, options);
  }

  fitBounds(bounds, options = {}) {
    return this.application.fitBounds(bounds, options);
  }

  invalidateSize() {
    return this.application.invalidateSize();
  }

  getViewState() {
    return this.application.getViewState();
  }

  getCapabilities() {
    return this.application.getCapabilities();
  }

  destroy() {
    return this.application.destroy();
  }
}
