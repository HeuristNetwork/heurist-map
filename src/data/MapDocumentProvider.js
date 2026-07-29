import {
  MAP_DOCUMENT_FORMAT,
  MAP_DOCUMENT_VERSION,
  normalizeMapDocument
} from '../map-document/MapDocument.js';
import { HeuristApiError } from './HeuristApiError.js';

export class MapDocumentProvider {
  constructor({ apiClient }) {
    this.apiClient = apiClient;
  }

  async getById(recordId, { signal } = {}) {
    const id = requireRecordId(recordId, 'MapDocument');
    const response = await this.apiClient.get(`/map/document/${id}`, { signal });

    validateFormat(response, MAP_DOCUMENT_FORMAT, MAP_DOCUMENT_VERSION, 'MapDocument');
    return normalizeMapDocument(response);
  }
}

function requireRecordId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new TypeError(`${label} record ID must be a positive integer`);
  }
  return id;
}

function validateFormat(value, format, version, label) {
  if (!value || typeof value !== 'object') {
    throw new HeuristApiError(`The ${label} API returned an invalid response`);
  }
  if (value.format !== format) {
    throw new HeuristApiError(
      `Unsupported ${label} format "${value.format ?? 'missing'}"; expected "${format}"`
    );
  }
  if (value.version !== version) {
    throw new HeuristApiError(
      `Unsupported ${label} version "${value.version ?? 'missing'}"; expected ${version}`
    );
  }
}
