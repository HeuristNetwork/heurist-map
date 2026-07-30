export class LayerLoaderRegistry {
  constructor() {
    this.loaders = new Map();
  }

  register(sourceTypes, loader) {
    const types = Array.isArray(sourceTypes) ? sourceTypes : [sourceTypes];
    for (const sourceType of types) {
      this.loaders.set(sourceType, loader);
    }
    return this;
  }

  get(sourceType) {
    const loader = this.loaders.get(sourceType);
    if (!loader) {
      throw new Error(`MapLayer source type "${sourceType}" is not supported`);
    }
    return loader;
  }

  async load(mapLayer, context) {
    return this.get(mapLayer.source.type).load(mapLayer, context);
  }
}
