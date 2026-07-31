/**
 * TileLayerLoader.js - Tile layer loader
 *
 * @fileOverview Converts public tile MapLayer definitions into engine-neutral runtime tile layers.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

export class TileLayerLoader {
  /**
   * Load a MapLayer using the loader registered for its source type.
   * @returns {Promise<*>} Resolves when the operation completes.
   */
  async load(mapLayer, context) {
    const source = mapLayer.source;
    if (!source.url) {
      throw new TypeError('tile source requires url');
    }

    return {
      id: context.reference.id ?? `map-layer-${context.reference.recordId}`,
      recordId: mapLayer.id,
      title: mapLayer.title,
      description: mapLayer.description,
      type: 'tile',
      visible: mapLayer.visible !== false,
      selectable: false,
      url: source.url,
      attribution: source.attribution || '',
      minZoom: source.minZoom,
      maxZoom: source.maxZoom,
      subdomains: source.subdomains,
      options: {
        ...(mapLayer.options || {}),
        ...(source.options || {})
      },
      source,
      order: context.reference.order ?? 0
    };
  }
}
