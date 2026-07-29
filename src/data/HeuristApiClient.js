import { HeuristApiError } from './HeuristApiError.js';

/**
 * Small fetch-based client for the public Heurist API.
 */
export class HeuristApiClient {
  constructor({
    apiBaseUrl,
    serverUrl,
    database,
    accessToken = null,
    headers = {},
    fetchImpl = globalThis.fetch
  } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('A fetch implementation is required');
    }

    this.apiBaseUrl = normalizeApiBaseUrl(apiBaseUrl || serverUrl);
    this.database = normalizeDatabase(database);
    this.accessToken = accessToken;
    this.headers = { ...headers };
    this.fetchImpl = fetchImpl;
  }

  isConfigured() {
    return Boolean(this.apiBaseUrl && this.database);
  }

  async get(path, { query, signal, headers } = {}) {
    return this.request(path, { method: 'GET', query, signal, headers });
  }

  async post(path, { body, signal, headers } = {}) {
    return this.request(path, { method: 'POST', body, signal, headers });
  }

  async request(path, {
    method = 'GET',
    query = null,
    body = undefined,
    signal,
    headers = {}
  } = {}) {
    this.assertConfigured();

    const url = this.buildUrl(path, query);
    const requestHeaders = {
      Accept: 'application/json',
      ...this.headers,
      ...headers
    };

    if (this.accessToken) {
      requestHeaders.Authorization = `Bearer ${this.accessToken}`;
    }

    const init = {
      method,
      headers: requestHeaders,
      signal
    };

    if (body !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) {
        throw error;
      }

      throw new HeuristApiError(
        `Cannot connect to the Heurist API at ${url}`,
        { url, method, cause: error }
      );
    }

    const payload = await readResponsePayload(response);

    if (!response.ok) {
      throw createResponseError(response, payload, method, url);
    }

    if (payload === null && response.status !== 204) {
      throw new HeuristApiError(
        `The Heurist API returned an empty response for ${method} ${url}`,
        { status: response.status, statusText: response.statusText, url, method }
      );
    }

    return payload;
  }

  buildUrl(path, query = null) {
    const normalizedPath = String(path || '').startsWith('/')
      ? String(path)
      : `/${String(path || '')}`;

    const url = new URL(
      `${this.apiBaseUrl}/${encodeURIComponent(this.database)}${normalizedPath}`,
      globalThis.location?.href || 'http://localhost/'
    );

    if (query && typeof query === 'object') {
      for (const [name, value] of Object.entries(query)) {
        if (value === undefined || value === null) {
          continue;
        }
        url.searchParams.set(name, serializeQueryValue(value));
      }
    }

    return url.toString();
  }

  assertConfigured() {
    if (!this.apiBaseUrl) {
      throw new HeuristApiError(
        'Heurist API base URL is not configured. Set heuristMapOptions.apiBaseUrl or serverUrl.'
      );
    }
    if (!this.database) {
      throw new HeuristApiError(
        'Heurist database is not configured. Set heuristMapOptions.database.'
      );
    }
  }
}

function normalizeApiBaseUrl(value) {
  if (!value) {
    return null;
  }

  let result = String(value).trim().replace(/\/+$/, '');
  if (!result) {
    return null;
  }

  if (!/\/api$/i.test(result)) {
    result += '/api';
  }

  return result;
}

function normalizeDatabase(value) {
  const result = value == null ? '' : String(value).trim();
  return result || null;
}

function serializeQueryValue(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  return JSON.stringify(value);
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new HeuristApiError(
      `The Heurist API returned invalid JSON for ${response.url}`,
      {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        details: text.slice(0, 1000),
        cause: error
      }
    );
  }
}

function createResponseError(response, payload, method, url) {
  const message = extractErrorMessage(payload)
    || `${response.status} ${response.statusText}`.trim()
    || 'Heurist API request failed';

  return new HeuristApiError(
    `Heurist API request failed: ${message}`,
    {
      status: response.status,
      statusText: response.statusText,
      url,
      method,
      code: payload?.error?.code ?? payload?.code ?? null,
      details: payload
    }
  );
}

function extractErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload.error?.message
    || payload.error?.error
    || payload.message
    || payload.error
    || null;
}
