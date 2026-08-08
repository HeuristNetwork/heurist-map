/**
 * initHeuristMap.js - Mapping application initializer
 *
 * @fileOverview Creates the map engine, host adapter, API providers, layer loaders, application controller, and stable public API.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { MapApplication } from './core/MapApplication.js';
import { createMapEngine } from './engine/createMapEngine.js';
import { createHostAdapter } from './host/createHostAdapter.js';
import { HeuristMapPublicApi } from './host/HeuristMapPublicApi.js';
import { HeuristApiClient } from './data/HeuristApiClient.js';
import { MapDocumentProvider } from './data/MapDocumentProvider.js';
import { MapLayerProvider } from './data/MapLayerProvider.js';
import { QueryGeoDataProvider } from './data/QueryGeoDataProvider.js';
import { RecordTypeProvider } from './data/RecordTypeProvider.js';
import { MapDocumentListProvider } from './data/MapDocumentListProvider.js';
import { MapControlPanel } from './ui/MapControlPanel.js';
import { MapConfigurationDialog } from './ui/config/MapConfigurationDialog.js';
import { createLayerLoaderRegistry } from './engine/loaders/createLayerLoaderRegistry.js';

/**
 * Initialize the standalone map and expose its stable same-origin public API.
 *
 * @param {Object} config Runtime configuration containing a MapDocument.
 * @returns {Promise<HeuristMapPublicApi>}
 */
export async function initHeuristMap(config) {
  const container = document.getElementById(config.containerId);
  if (!container) {
    throw new Error(`Map container #${config.containerId} was not found`);
  }

  const mapEngine = createMapEngine(config.engine);
  const host = createHostAdapter(config.host);
  const apiClient = new HeuristApiClient({
    apiBaseUrl: config.apiBaseUrl,
    serverUrl: config.serverUrl,
    database: config.database,
    accessToken: config.accessToken,
    headers: config.requestHeaders
  });

  const recordTypes = new RecordTypeProvider({ apiClient });
  const providers = {
    recordTypes,
    mapDocumentList: new MapDocumentListProvider({ apiClient, recordTypes }),
    mapDocument: new MapDocumentProvider({ apiClient }),
    mapLayer: new MapLayerProvider({ apiClient }),
    queryGeoData: new QueryGeoDataProvider({ apiClient })
  };
  const layerLoaders = createLayerLoaderRegistry({
    queryGeoData: providers.queryGeoData
  });

  const application = new MapApplication({
    container,
    config,
    mapEngine,
    host,
    providers,
    layerLoaders
  });

  const publicApi = new HeuristMapPublicApi(application);
  publicApi.setConfigurationDialogFactory((options = {}) => {
    const dialog = new MapConfigurationDialog(options);
    dialog.open();
    return dialog;
  });
  let controlPanel = null;
  const readyPromise = application.initialize().then(async () => {
    controlPanel = new MapControlPanel({
      api: publicApi,
      mapContainer: container,
      options: config.ui
    });
    controlPanel.mount();
    application.controlPanel = controlPanel;

    if (config.documents.autoLoad !== false && apiClient.isConfigured()) {
      await publicApi.loadMapDocuments(config.documents.query, {
        activateFirst: config.documents.activateFirst !== false
      });
    }
    return publicApi;
  });
  publicApi.setReadyPromise(readyPromise);

  // Narrow, stable API for same-origin iframe and direct host integrations.
  window.heuristMap = publicApi;

  return readyPromise;
}
