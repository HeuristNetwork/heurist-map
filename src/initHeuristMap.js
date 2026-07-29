import { MapApplication } from './core/MapApplication.js';
import { createMapEngine } from './adapters/map/createMapEngine.js';
import { createHostAdapter } from './host/createHostAdapter.js';
import { HeuristMapPublicApi } from './public-api/HeuristMapPublicApi.js';
import { HeuristApiClient } from './data/HeuristApiClient.js';
import { MapDocumentProvider } from './data/MapDocumentProvider.js';
import { MapLayerProvider } from './data/MapLayerProvider.js';
import { QueryGeoDataProvider } from './data/QueryGeoDataProvider.js';

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

  const application = new MapApplication({
    container,
    config,
    mapEngine,
    host,
    providers: {
      mapDocument: new MapDocumentProvider({ apiClient }),
      mapLayer: new MapLayerProvider({ apiClient }),
      queryGeoData: new QueryGeoDataProvider({ apiClient })
    }
  });

  const publicApi = new HeuristMapPublicApi(application);
  const readyPromise = application.initialize().then(() => publicApi);
  publicApi.setReadyPromise(readyPromise);

  // Narrow, stable API for same-origin iframe and direct host integrations.
  window.heuristMap = publicApi;

  return readyPromise;
}
