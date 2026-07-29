import { createMapEnvironment } from '../map-document/createMapEnvironment.js';

/**
 * Engine-neutral application controller.
 */
export class MapApplication {
  constructor({ container, config, mapEngine, host }) {
    this.container = container;
    this.config = config;
    this.mapEngine = mapEngine;
    this.host = host;
    this.mapEnvironment = createMapEnvironment(config.mapDocument);
    this.initialized = false;
    this.destroyed = false;
  }

  async initialize() {
    this.assertActive();

    const environment = this.mapEnvironment;
    const initialView = environment.initialView;

    await this.host.initialize({ application: this, config: this.config });

    try {
      await this.mapEngine.initialize(this.container, {
        center: initialView.center,
        zoom: initialView.zoom,
        crs: environment.crs,
        controls: { zoom: true, attribution: true },
        baseLayer: environment.baseMap
      });

      for (const layer of environment.layers) {
        // Phase 1 can render inline engine-neutral layers. References to
        // RT_MAP_LAYER records will be resolved by the Phase 2 data provider.
        if (layer.source?.type === 'heurist-map-layer') {
          continue;
        }

        await this.addLayer(toRuntimeLayer(layer));
      }

      if (initialView.type === 'bounds') {
        await this.fitBounds(initialView.bounds, { animate: false });
      }

      this.initialized = true;
      this.container.dispatchEvent(new CustomEvent('heurist-map-ready', {
        detail: { mapDocument: this.config.mapDocument }
      }));
    } catch (error) {
      await this.mapEngine.destroy();
      await this.host.destroy();
      throw error;
    }
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
      editing: !this.config.readonly && this.host.supportsEditing()
    };
  }

  async destroy() {
    if (this.destroyed) {
      return;
    }

    await this.mapEngine.destroy();
    await this.host.destroy();
    this.destroyed = true;
    this.initialized = false;
  }

  assertActive() {
    if (this.destroyed) {
      throw new Error('The map application has been destroyed');
    }
  }
}

function toRuntimeLayer(layer) {
  if (layer.source?.type === 'inline-geojson') {
    return {
      ...layer,
      type: 'geojson',
      data: layer.source.data
    };
  }

  return layer;
}
