/**
 * initHeuristMapConfiguration.js - Configuration-only bootstrap
 *
 * Starts the reusable map configuration UI without creating a MapApplication,
 * map engine, Leaflet map, basemap, providers, or MapDocuments.
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */
import { HeuristMapConfigurationApi } from './host/HeuristMapConfigurationApi.js';

export async function initHeuristMapConfiguration() {
  const publicApi = new HeuristMapConfigurationApi();
  window.heuristMap = publicApi;
  return publicApi;
}
