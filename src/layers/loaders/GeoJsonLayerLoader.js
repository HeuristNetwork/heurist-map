import { normalizeGeoJson } from '../../metadata/normalizeGeoJson.js';

export class GeoJsonLayerLoader {
  constructor({ queryGeoData }) {
    this.queryGeoData = queryGeoData;
  }

  async load(mapLayer, context) {
    const source = mapLayer.source;
    let geoJson;

    switch (source.type) {
      case 'heurist-query':
        geoJson = await this.queryGeoData.searchAll({
          query: source.query,
          limit: source.limit || 1000,
          simplify: source.simplify === true,
          signal: context.signal
        });
        break;
      case 'record':
        geoJson = await this.queryGeoData.getRecord(source.recordId, {
          simplify: source.simplify === true,
          signal: context.signal
        });
        break;
      case 'inline-geojson':
        geoJson = source.data;
        break;
      default:
        throw new Error(`Unsupported GeoJSON source type "${source.type}"`);
    }

    return createGeoJsonRuntimeLayer(mapLayer, context, geoJson);
  }
}

export function createGeoJsonRuntimeLayer(mapLayer, context, geoJson) {
  const id = context.reference.id ?? `map-layer-${context.reference.recordId}`;
  return {
    id,
    recordId: mapLayer.id,
    title: mapLayer.title,
    description: mapLayer.description,
    type: 'geojson',
    visible: mapLayer.visible !== false,
    selectable: mapLayer.selectable !== false,
    data: normalizeGeoJson(geoJson, { layerId: id, sourceType: mapLayer.source.type }),
    style: mapLayer.style,
    popup: normalizePopup(mapLayer.options?.popup),
    options: mapLayer.options,
    source: mapLayer.source,
    order: context.reference.order ?? 0
  };
}

function normalizePopup(value) {
  if (value === false) {
    return { enabled: false };
  }
  const popup = value && typeof value === 'object' ? value : {};
  return {
    enabled: popup.enabled !== false,
    titleField: popup.titleField || null,
    fields: Array.isArray(popup.fields) ? [...popup.fields] : [],
    showRecordId: popup.showRecordId !== false
  };
}
