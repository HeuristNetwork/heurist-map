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
    geoFields = null,
    method = 'auto',
    signal
  }) {
    if (query === undefined || query === null || query === '') {
      throw new TypeError('A Heurist query is required');
    }

    const normalizedLimit = normalizeLimit(limit);
    const normalizedOffset = normalizeOffset(offset);
    const hasGeoFields = Array.isArray(geoFields) && geoFields.length > 0;
    const usePost = method === 'post'
      || (method === 'auto' && (hasGeoFields || shouldUsePost(query)));


    const response = usePost
      ? await this.apiClient.post('/map', {
          body: {
            query,
            limit: normalizedLimit,
            offset: normalizedOffset,
            simplify: Boolean(simplify),
            ...(hasGeoFields ? { geofields: geoFields } : {})
          },
          signal
        })
      : await this.apiClient.get('/map', {
          query: {
            q: query,
            limit: normalizedLimit,
            offset: normalizedOffset,
            simplify: Boolean(simplify),
            ...(hasGeoFields ? { geofields: geoFields } : {})
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
    geoFields = null,
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
    let truncatedByFeatureLimit = false;

    while (page < maxPages) {
      throwIfAborted(signal);

      if (featureLimit != null && features.length >= featureLimit) {
        complete = true;
        break;
      }

      const response = await this.search({
        query,
        limit: pageSize,
        offset,
        simplify,
        geoFields,
        method,
        signal
      });

      const remaining = featureLimit == null
        ? response.features.length
        : Math.max(0, featureLimit - features.length);
      const accepted = featureLimit == null
        ? response.features
        : response.features.slice(0, remaining);
      if (accepted.length < response.features.length) {
        truncatedByFeatureLimit = true;
      }
      features.push(...accepted);
      latestMeta = response.meta || {};
      page += 1;

      const total = Number(latestMeta.totalRecords ?? latestMeta.total);
      const received = response.features.length;
      const returnedRecords = Number(latestMeta.returnedRecords);
      const recordStep = Number.isFinite(returnedRecords) && returnedRecords >= 0
        ? returnedRecords
        : received;
      offset += recordStep;

      if ((featureLimit != null && features.length >= featureLimit)
        || recordStep === 0
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

    const totalRecords = Number(latestMeta.totalRecords ?? latestMeta.total);
    return {
      type: 'FeatureCollection',
      features,
      meta: {
        ...latestMeta,
        offset: 0,
        limit: pageSize,
        returnedFeatures: features.length,
        isPartial: truncatedByFeatureLimit
          || (Number.isFinite(totalRecords) ? offset < totalRecords : Boolean(latestMeta.isPartial))
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
