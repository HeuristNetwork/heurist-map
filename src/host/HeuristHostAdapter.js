/**
 * HeuristHostAdapter.js - Main Heurist host integration
 *
 * Uses the internal FrontController endpoints for preferences and published maps.
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */
import { HostAdapter } from '@heurist/client-core/host';

export class HeuristHostAdapter extends HostAdapter {
  constructor({ baseUrl, database, fetchImpl = null, bridge = null } = {}) {
    super();
    this.baseUrl = String(baseUrl || '').replace(/\?$/, '');
    this.database = database || null;
    this.bridge = bridge || null;
    this.fetchImpl = typeof fetchImpl === 'function'
      ? fetchImpl
      : (...args) => globalThis.fetch(...args);
  }

  supportsEditing() {
    return typeof this.bridge?.editRecord === 'function';
  }

  supportsSymbologyEditing() {
    return typeof this.bridge?.editSymbology === 'function';
  }

  async editSymbology(value, options = {}) {
    if (!this.supportsSymbologyEditing()) {
      throw new Error('Symbology editing is not available from the Heurist host');
    }
    return this.bridge.editSymbology(value ?? null, options || {});
  }

  getCapabilities() {
    return { mapPreferences: true, mapPublishing: true };
  }

  /**
   * Apply legacy Heurist map symbol preferences as runtime defaults.
   *
   * This is a temporary compatibility bridge while old and new mapping coexist.
   * Explicit heurist-map defaults always win; legacy preferences only fill null
   * symbology/selectSymbology values and are never copied into persistedSettings.
   */
  async initialize({ config } = {}) {
    const defaults = config?.defaults;
    if (!defaults) return;

    const requests = [];
    if (defaults.symbology == null) {
      requests.push(this.loadLegacySymbolPreference('map_default_style')
        .then((symbol) => { if (symbol) defaults.symbology = symbol; }));
    }
    if (defaults.selectSymbology == null) {
      requests.push(this.loadLegacySymbolPreference('map_select_style')
        .then((symbol) => { if (symbol) defaults.selectSymbology = symbol; }));
    }

    // Legacy preferences are compatibility defaults, not a startup dependency.
    // A failed preference read must not prevent the map itself from loading.
    if (requests.length) await Promise.allSettled(requests);
  }

  async loadLegacySymbolPreference(key) {
    const response = await this.request('UserController', 'get_prefs', { key });
    return normalizeSymbolPreference(response);
  }

  async editRecord(recordId) {
    const id = Number(recordId);
    if (!(id > 0)) throw new Error('A valid Heurist record ID is required for editing');
    if (!this.supportsEditing()) {
      throw new Error('Record editing is not available from the Heurist host');
    }
    return this.bridge.editRecord(id);
  }

  async addRecord(recordTypeId) {
    const id = Number(recordTypeId);
    if (!(id > 0)) throw new Error('A valid Heurist record type ID is required for creation');
    if (!this.supportsEditing() || typeof this.bridge?.addRecord !== 'function') {
      throw new Error('Record creation is not available from the Heurist host');
    }
    return this.bridge.addRecord(id);
  }

  async loadMapPreferences() {
    let response = await this.request('UserController', 'get_prefs', { key: 'heurist-map' });

    // UserController may return the preference exactly as stored, i.e. as a
    // JSON string. Keep the host boundary responsible for converting that
    // transport representation into the settings object expected by the
    // configuration dialog.
    if (typeof response === 'string' && response) {
      try {
        response = JSON.parse(response);
      } catch {
        return null;
      }
    }

    return response && typeof response === 'object' && !Array.isArray(response)
      ? response
      : null;
  }

  async saveMapPreferences(settings) {
    const result = await this.request('UserController', 'save_prefs', {}, {
      key: 'heurist-map', value: JSON.stringify(settings)
    });
    this.bridge?.updateSettings?.(settings);
    return result;
  }

  async publishMap(payload) {
    return this.request('PublicationController', 'save', { type: 'map' }, { data: JSON.stringify(payload) });
  }

  async loadPublishedMap(id) {
    return this.request('PublicationController', 'get', { id, type: 'map' });
  }

  async deletePublishedMap(id) {
    return this.request('PublicationController', 'delete', { id, type: 'map' }, {});
  }

  async request(controller, action, query = {}, post = null) {
    if (!this.baseUrl || !this.database || typeof this.fetchImpl !== 'function') {
      throw new Error('Heurist host FrontController is not configured');
    }
    const url = new URL(this.baseUrl, globalThis.location?.href || 'http://localhost/');
    url.searchParams.set('db', this.database);
    url.searchParams.set('controller', controller);
    url.searchParams.set('action', action);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    });

    const init = { credentials: 'same-origin' };
    if (post !== null) {
      init.method = 'POST';
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };
      const body = new URLSearchParams();
      Object.entries(post).forEach(([key, value]) => body.set(key, String(value)));
      init.body = body.toString();
    }

    const response = await this.fetchImpl(url.toString(), init);
    if (!response.ok) throw new Error(`FrontController request failed (${response.status})`);
    const payload = await response.json();
    if (!payload || !isSuccessStatus(payload.status)) {
      const message = payload?.message || payload?.error?.message || payload?.data?.message || 'FrontController request failed';
      throw new Error(message);
    }
    return payload.data;
  }
}

function normalizeSymbolPreference(value) {
  if (typeof value === 'string' && value.trim()) {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return JSON.parse(JSON.stringify(value));
}

function isSuccessStatus(status) {
  return status === 0 || status === '0' || String(status || '').toLowerCase() === 'ok';
}
