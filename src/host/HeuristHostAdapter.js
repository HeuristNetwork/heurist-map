/**
 * HeuristHostAdapter.js - Main Heurist host integration
 *
 * Uses the internal FrontController endpoints for preferences and published maps.
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */
import { HostAdapter } from './HostAdapter.js';

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

  getCapabilities() {
    return { mapPreferences: true, mapPublishing: true };
  }

  async editRecord(recordId) {
    const id = Number(recordId);
    if (!(id > 0)) throw new Error('A valid Heurist record ID is required for editing');
    if (!this.supportsEditing()) {
      throw new Error('Record editing is not available from the Heurist host');
    }
    return this.bridge.editRecord(id);
  }

  async loadMapPreferences() {
    const response = await this.request('UserController', 'get_prefs', { key: 'heurist-map' });
    return response ?? null;
  }

  async saveMapPreferences(settings) {
    const result = await this.request('UserController', 'save_prefs', {}, {
      key: 'heurist-map', value: JSON.stringify(settings)
    });
    this.bridge?.updateSettings?.(settings);
    return result;
  }

  async publishMap(payload) {
    return this.request('MapPublishedController', 'save', {}, { data: JSON.stringify(payload) });
  }

  async loadPublishedMap(id) {
    return this.request('MapPublishedController', 'get', { id });
  }

  async deletePublishedMap(id) {
    return this.request('MapPublishedController', 'delete', { id }, {});
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

function isSuccessStatus(status) {
  return status === 0 || status === '0' || String(status || '').toLowerCase() === 'ok';
}
