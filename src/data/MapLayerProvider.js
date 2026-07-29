import {
  MAP_LAYER_FORMAT,
  MAP_LAYER_VERSION,
  normalizeMapLayer
} from '../map-layer/MapLayer.js';
import { HeuristApiError } from './HeuristApiError.js';

export class MapLayerProvider {
  constructor({ apiClient }) {
    this.apiClient = apiClient;
  }

  async getById(recordId, { signal } = {}) {
    const id = requireRecordId(recordId);
    const response = await this.apiClient.get(`/map/layer/${id}`, { signal });

    validateResponse(response);
    return normalizeMapLayer(response);
  }
}

function requireRecordId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new TypeError('MapLayer record ID must be a positive integer');
  }
  return id;
}

function validateResponse(value) {
  if (!value || typeof value !== 'object') {
    throw new HeuristApiError('The MapLayer API returned an invalid response');
  }
  if (value.format !== MAP_LAYER_FORMAT) {
    throw new HeuristApiError(
      `Unsupported MapLayer format "${value.format ?? 'missing'}"; expected "${MAP_LAYER_FORMAT}"`
    );
  }
  if (value.version !== MAP_LAYER_VERSION) {
    throw new HeuristApiError(
      `Unsupported MapLayer version "${value.version ?? 'missing'}"; expected ${MAP_LAYER_VERSION}`
    );
  }
}
