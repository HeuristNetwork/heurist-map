export class TileLayerLoader {
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
