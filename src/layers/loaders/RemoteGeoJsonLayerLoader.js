import { HeuristApiError } from '../../data/HeuristApiError.js';
import { createGeoJsonRuntimeLayer } from './GeoJsonLayerLoader.js';

function defaultFetch(...args) {
  return globalThis.fetch(...args);
}

export class RemoteGeoJsonLayerLoader {
  constructor({ fetchImpl = defaultFetch } = {}) {
    this.fetchImpl = fetchImpl;
  }

  async load(mapLayer, context) {
    const source = mapLayer.source;
    if (!source.url) {
      throw new TypeError('remote-geojson source requires url');
    }

    let response;
    try {
      response = await this.fetchImpl(source.url, {
        method: 'GET',
        headers: { Accept: 'application/geo+json, application/json' },
        signal: context.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError' || context.signal?.aborted) {
        throw error;
      }
      throw new HeuristApiError(`Cannot load remote GeoJSON from ${source.url}`, {
        url: source.url,
        method: 'GET',
        cause: error
      });
    }

    if (!response.ok) {
      throw new HeuristApiError(
        `Remote GeoJSON request failed: ${response.status} ${response.statusText}`.trim(),
        { status: response.status, statusText: response.statusText, url: source.url, method: 'GET' }
      );
    }

    let geoJson;
    try {
      geoJson = await response.json();
    } catch (error) {
      throw new HeuristApiError(`Remote GeoJSON returned invalid JSON: ${source.url}`, {
        url: source.url,
        method: 'GET',
        cause: error
      });
    }

    return createGeoJsonRuntimeLayer(mapLayer, context, geoJson);
  }
}
