import { HeuristApiError } from './HeuristApiError.js';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 1000;

/**
 * Loads GeoJSON from the public /map endpoints.
 */
export class QueryGeoDataProvider {
  constructor({ apiClient }) {
    this.apiClient = apiClient;
  }

  async getRecord(recordId, { simplify = false, signal } = {}) {
    const id = requireRecordId(recordId);
    const response = await this.apiClient.get(`/map/${id}`, {
      query: { simplify },
      signal
    });
    return validateGeoJsonResponse(response);
  }

  async search({
    query,
    limit = DEFAULT_LIMIT,
    offset = 0,
    simplify = false,
    method = 'auto',
    signal
  }) {
    if (query === undefined || query === null || query === '') {
      throw new TypeError('A Heurist query is required');
    }

    const normalizedLimit = normalizeLimit(limit);
    const normalizedOffset = normalizeOffset(offset);
    const usePost = method === 'post'
      || (method === 'auto' && shouldUsePost(query));

console.log('QueryGeoDataProvider.search', { query, usePost });

    const response = usePost
      ? await this.apiClient.post('/map', {
          body: {
            query,
            limit: normalizedLimit,
            offset: normalizedOffset,
            simplify: Boolean(simplify)
          },
          signal
        })
      : await this.apiClient.get('/map', {
          query: {
            q: query,
            limit: normalizedLimit,
            offset: normalizedOffset,
            simplify: Boolean(simplify)
          },
          signal
        });

    return validateGeoJsonResponse(response);
  }

  /**
   * Load every API page and merge it into one FeatureCollection.
   */
  async searchAll({
    query,
    limit = DEFAULT_LIMIT,
    simplify = false,
    method = 'auto',
    signal,
    maxPages = 100
  }) {
    const pageSize = normalizeLimit(limit);
    const features = [];
    let offset = 0;
    let page = 0;
    let latestMeta = {};
    let complete = false;

    while (page < maxPages) {
      throwIfAborted(signal);

      const response = await this.search({
        query,
        limit: pageSize,
        offset,
        simplify,
        method,
        signal
      });

      features.push(...response.features);
      latestMeta = response.meta || {};
      page += 1;

      const total = Number(latestMeta.total);
      const received = response.features.length;
      offset += received;

      if (received === 0 || received < pageSize || (Number.isFinite(total) && offset >= total)) {
        complete = true;
        break;
      }
    }

    if (!complete && page >= maxPages) {
      throw new HeuristApiError(
        `GeoJSON search exceeded the safety limit of ${maxPages} pages`
      );
    }

    return {
      type: 'FeatureCollection',
      features,
      meta: {
        ...latestMeta,
        offset: 0,
        limit: pageSize,
        returned: features.length
      }
    };
  }
}

function validateGeoJsonResponse(value) {
  if (!value || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new HeuristApiError(
      'The map API returned an invalid GeoJSON FeatureCollection'
    );
  }

  if (!value.meta || typeof value.meta !== 'object') {
    throw new HeuristApiError('The map API response is missing its meta object');
  }

  return value;
}

function shouldUsePost(query) {
  return typeof query === 'object' || String(query).length > 1500;
}

function normalizeLimit(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(number, MAX_LIMIT);
}

function normalizeOffset(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function requireRecordId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new TypeError('Record ID must be a positive integer');
  }
  return id;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('The request was aborted', 'AbortError');
  }
}
