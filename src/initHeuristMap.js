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
import { HeuristApiClient } from '@heurist/client-core/api';
import { MapDocumentProvider } from './data/MapDocumentProvider.js';
import { MapLayerProvider } from './data/MapLayerProvider.js';
import { QueryGeoDataProvider } from './data/QueryGeoDataProvider.js';
import { ThematicAttributeProvider } from './data/ThematicAttributeProvider.js';
import { RecordTypeProvider } from './data/RecordTypeProvider.js';
import { MapDocumentListProvider } from './data/MapDocumentListProvider.js';
import { PopupProvider } from './data/PopupProvider.js';
import { ReportTemplateProvider } from './data/ReportTemplateProvider.js';
import { MapControlPanel } from './ui/MapControlPanel.js';
import { MapConfigurationDialog } from './ui/config/MapConfigurationDialog.js';
import { createLayerLoaderRegistry } from './engine/loaders/createLayerLoaderRegistry.js';
import { DrawController } from './draw/DrawController.js';
import { DrawPanel } from './ui/DrawPanel.js';

/**
 * Initialize the standalone map and expose its stable same-origin public API.
 *
 * @param {Object} config Normalized runtime/application configuration.
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
    database: config.database,
    accessToken: config.accessToken,
    headers: config.requestHeaders
  });

  const recordTypes = new RecordTypeProvider({ apiClient });
  const heuristBaseUrl = resolveHeuristBaseUrl(config);
  const providers = {
    recordTypes,
    mapDocumentList: new MapDocumentListProvider({ apiClient, recordTypes }),
    mapDocument: new MapDocumentProvider({ apiClient }),
    mapLayer: new MapLayerProvider({ apiClient }),
    queryGeoData: new QueryGeoDataProvider({ apiClient }),
    thematicAttributes: new ThematicAttributeProvider({ apiClient }),
    popup: new PopupProvider({ baseUrl: heuristBaseUrl, database: config.database }),
    reportTemplates: new ReportTemplateProvider({ baseUrl: heuristBaseUrl, database: config.database })
  };
  const layerLoaders = createLayerLoaderRegistry({
    queryGeoData: providers.queryGeoData,
    thematicAttributes: providers.thematicAttributes
  });

  const application = new MapApplication({
    container,
    config,
    mapEngine,
    host,
    providers,
    layerLoaders
  });

  const drawController = new DrawController({
    mapEngine,
    dispatch: (name, detail) => application.dispatch(name, detail)
  });
  const publicApi = new HeuristMapPublicApi(application, drawController);
  publicApi.setConfigurationDialogFactory((options = {}) => {
    const dialog = new MapConfigurationDialog({
      ...options,
      reportTemplateProvider: providers.reportTemplates,
      onEditSymbology: options.onEditSymbology || ((value, editorOptions) => publicApi.editSymbology(value, editorOptions)),
      onEditExtent: options.onEditExtent || (typeof config.host?.bridge?.editExtent === 'function'
        ? ((bounds, editorOptions) => config.host.bridge.editExtent(bounds, editorOptions))
        : null)
    });
    dialog.open();
    return dialog;
  });
  let controlPanel = null;
  let drawPanel = null;
  const readyPromise = application.initialize().then(async () => {
    controlPanel = new MapControlPanel({
      api: publicApi,
      mapContainer: container,
      options: config.ui
    });
    controlPanel.mount();
    application.controlPanel = controlPanel;
    if (config.viewerMode === 'draw') {
      drawPanel = new DrawPanel({ api: publicApi, container }).mount();
      application.drawPanel = drawPanel;
    }

    if (apiClient.isConfigured()) {
      // Published state owns startup activation when it names a document. Do not
      // first activate mapDocuments.initiallyActive and then switch documents again.
      await publicApi.loadMapDocuments(config.documents.query, {
        activateFirst: config.viewerMode !== 'draw' && config.initialState?.activeDocumentId == null
      });
    }
    if (config.initialState) {
      await publicApi.restoreState(config.initialState);
    }
    return publicApi;
  });
  publicApi.setReadyPromise(readyPromise);

  // Narrow, stable API for same-origin iframe and direct host integrations.
  window.heuristMap = publicApi;

  return readyPromise;
}

function resolveHeuristBaseUrl(config = {}) {
  const hostBaseUrl = String(config.host?.baseUrl || '').trim();
  if (hostBaseUrl) return hostBaseUrl.endsWith('/') ? hostBaseUrl : `${hostBaseUrl}/`;
  const apiBaseUrl = String(config.apiBaseUrl || '').trim().replace(/\/+$/, '');
  if (!apiBaseUrl) return null;
  const baseUrl = apiBaseUrl.replace(/\/api$/i, '');
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
