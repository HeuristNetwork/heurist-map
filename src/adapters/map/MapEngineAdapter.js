/**
 * Contract implemented by concrete map engines.
 */
export class MapEngineAdapter {
  async initialize() {
    throw new Error('MapEngineAdapter.initialize() is not implemented');
  }

  async addLayer() {
    throw new Error('MapEngineAdapter.addLayer() is not implemented');
  }

  async removeLayer() {
    throw new Error('MapEngineAdapter.removeLayer() is not implemented');
  }

  async setLayerVisibility() {
    throw new Error('MapEngineAdapter.setLayerVisibility() is not implemented');
  }

  async setView() {
    throw new Error('MapEngineAdapter.setView() is not implemented');
  }

  async fitBounds() {
    throw new Error('MapEngineAdapter.fitBounds() is not implemented');
  }

  async invalidateSize() {
    throw new Error('MapEngineAdapter.invalidateSize() is not implemented');
  }

  getViewState() {
    throw new Error('MapEngineAdapter.getViewState() is not implemented');
  }

  getCapabilities() {
    return {};
  }

  async destroy() {}
}
