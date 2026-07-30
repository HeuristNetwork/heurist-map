import { LayerLoaderRegistry } from './LayerLoaderRegistry.js';
import { GeoJsonLayerLoader } from './loaders/GeoJsonLayerLoader.js';
import { RemoteGeoJsonLayerLoader } from './loaders/RemoteGeoJsonLayerLoader.js';
import { TileLayerLoader } from './loaders/TileLayerLoader.js';

export function createLayerLoaderRegistry({ queryGeoData, fetchImpl } = {}) {
  const registry = new LayerLoaderRegistry();
  registry
    .register(
      ['heurist-query', 'record', 'inline-geojson'],
      new GeoJsonLayerLoader({ queryGeoData })
    )
    .register('remote-geojson', new RemoteGeoJsonLayerLoader({ fetchImpl }))
    .register('tile', new TileLayerLoader());
  return registry;
}
