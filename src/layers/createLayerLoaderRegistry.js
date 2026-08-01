/**
 * createLayerLoaderRegistry.js - Layer loader registry factory
 *
 * @fileOverview Creates the default loader registry for query, record, inline, remote GeoJSON, and tile sources.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { LayerLoaderRegistry } from './LayerLoaderRegistry.js';
import { GeoJsonLayerLoader } from './loaders/GeoJsonLayerLoader.js';
import { RemoteGeoJsonLayerLoader } from './loaders/RemoteGeoJsonLayerLoader.js';
import { TileLayerLoader } from './loaders/TileLayerLoader.js';

/**
 * Create layer loader registry.
 *
 * @returns {*} Function result.
 */
export function createLayerLoaderRegistry({ queryGeoData, fetchImpl } = {}) {
  const registry = new LayerLoaderRegistry();
  registry
    .register(
      ['heurist-query', 'record', 'inline-geojson'],
      new GeoJsonLayerLoader({ queryGeoData })
    )
    .register('remote-geojson', new RemoteGeoJsonLayerLoader({ fetchImpl }))
    .register(['tile', 'tiled-image', 'tiledImage'], new TileLayerLoader());
  return registry;
}
