/**
 * QueryGeoDataProvider.js - GeoJSON data provider
 *
 * @fileOverview Loads record and query GeoJSON from the public map API, including paging, POST fallback, validation, and cancellation.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { HeuristApiError } from './HeuristApiError.js';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

/**
 * Loads GeoJSON from the public /map endpoints.
 */
export class QueryGeoDataProvider {
  /**
   * Create and initialize the class instance.
   */
  constructor({ apiClient }) {
    this.apiClient = apiClient;
  }

  /**
   * Load GeoJSON for one Heurist record.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async getRecord(recordId, { simplify = false, signal } = {}) {
    const id = requireRecordId(recordId);
    const response = await this.apiClient.get(`/map/${id}`, {
      query: { simplify },
      signal
    });
    return validateGeoJsonResponse(response);
  }

  /**
   * Load one page of GeoJSON for a Heurist query.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
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
    maxPages = 100,
    maxFeatures = null
  }) {
    const pageSize = normalizeLimit(limit);
    const featureLimit = normalizeFeatureLimit(maxFeatures);
    const features = [];
    let offset = 0;
    let page = 0;
    let latestMeta = {};
    let complete = false;

    while (page < maxPages) {
      throwIfAborted(signal);

      const remaining = featureLimit == null ? pageSize : Math.max(0, featureLimit - features.length);
      if (remaining === 0) {
        complete = true;
        break;
      }

      const response = await this.search({
        query,
        limit: Math.min(pageSize, remaining),
        offset,
        simplify,
        method,
        signal
      });

      const accepted = featureLimit == null
        ? response.features
        : response.features.slice(0, Math.max(0, featureLimit - features.length));
      features.push(...accepted);
      latestMeta = response.meta || {};
      page += 1;

      const total = Number(latestMeta.total);
      const received = response.features.length;
      offset += received;

      if ((featureLimit != null && features.length >= featureLimit)
        || received === 0
        || received < Math.min(pageSize, remaining)
        || (Number.isFinite(total) && offset >= total)) {
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

function normalizeFeatureLimit(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, MAX_LIMIT) : null;
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
