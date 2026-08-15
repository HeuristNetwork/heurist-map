/**
 * HeuristMapConfigurationApi.js - Lightweight configuration-only public API
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */
import { MapConfigurationDialog } from '../ui/config/MapConfigurationDialog.js';
import { createMapConfigurationDefaults } from '../ui/config/mapConfigurationDefaults.js';
import {
  normalizeMapConfigurationSettings,
  serializeMapConfigurationSettings
} from '../ui/config/mapConfigurationSchema.js';

/** Public API used when heurist-map is loaded only as a configuration editor. */
export class HeuristMapConfigurationApi {
  constructor({ mapDocumentListProvider = null, baseMapCatalog = [] } = {}) {
    this.configurationDialog = null;
    this.mapDocumentListProvider = mapDocumentListProvider;
    this.baseMapCatalog = Array.isArray(baseMapCatalog) ? baseMapCatalog : [];
  }

  ready() { return Promise.resolve(this); }

  openConfigurationDialog(options = {}) {
    this.configurationDialog?.close?.();
    this.configurationDialog = new MapConfigurationDialog({
      ...options,
      mapDocumentListProvider: options.mapDocumentListProvider || this.mapDocumentListProvider,
      baseMapCatalog: options.baseMapCatalog || this.baseMapCatalog
    });
    this.configurationDialog.open();
    return this.configurationDialog;
  }

  normalizeConfiguration(value = {}) {
    return normalizeMapConfigurationSettings(value);
  }

  serializeConfiguration(value = {}) {
    return serializeMapConfigurationSettings(value);
  }

  getConfigurationDefaults() {
    return createMapConfigurationDefaults();
  }

  destroy() {
    this.configurationDialog?.close?.();
    this.configurationDialog = null;
  }
}
