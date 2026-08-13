/**
 * thematicAttributes.js - Thematic attribute helpers
 *
 * @fileOverview Identifies the active thematic map, extracts requested field-path codes, and merges API values into GeoJSON features.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

const GEO_FIELD_CODE = 'rec_GeoField';

/** Return the single active thematic map from a normalized layer style. */
export function getActiveThematicMap(style) {
  if (!style) return null;
  const thematic = style.thematic;
  if (!thematic) return null;

  if (Array.isArray(thematic)) {
    return thematic.find((item) => item && typeof item === 'object' && item.active === true) || null;
  }

  if (Array.isArray(thematic.maps)) {
    return thematic.maps.find((item) => item && typeof item === 'object' && item.active === true) || null;
  }

  if (Array.isArray(thematic.fields) && thematic.active !== false) {
    return thematic;
  }

  return null;
}

/** Return unique field-path codes required by one active thematic map. */
export function getThematicFieldCodes(theme) {
  if (!theme || !Array.isArray(theme.fields)) return [];
  return [...new Set(theme.fields
    .map((field) => String(field?.code ?? '').trim())
    .filter((code) => code && code !== GEO_FIELD_CODE))];
}

/** Return unique Heurist record IDs represented by a normalized GeoJSON collection. */
export function collectThematicRecordIds(geoJson) {
  if (!geoJson || !Array.isArray(geoJson.features)) return [];
  const ids = [];
  const seen = new Set();
  for (const feature of geoJson.features) {
    const id = Number(
      feature?.properties?.heurist?.recordId
      ?? feature?.properties?.rec_ID
      ?? feature?.properties?.recordId
      ?? feature?.recordId
    );
    if (!Number.isInteger(id) || id < 1 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Attach the records/details response to normalized GeoJSON features under
 * properties.thematic, keyed by the exact requested field-path code.
 */
export function applyThematicAttributes(geoJson, response) {
  if (!geoJson || !Array.isArray(geoJson.features)) return geoJson;
  const records = Array.isArray(response?.records) ? response.records : [];
  const detailsByRecordId = new Map();

  for (const record of records) {
    const id = Number(record?.rec_ID);
    if (!Number.isInteger(id) || id < 1) continue;
    detailsByRecordId.set(id, isObject(record.details) ? record.details : {});
  }

  for (const feature of geoJson.features) {
    if (!feature || typeof feature !== 'object') continue;
    const properties = isObject(feature.properties) ? feature.properties : {};
    const recordId = Number(
      properties.heurist?.recordId
      ?? properties.rec_ID
      ?? properties.recordId
      ?? feature.recordId
    );
    properties.thematic = Number.isInteger(recordId) && recordId > 0
      ? cloneDetails(detailsByRecordId.get(recordId) || {})
      : {};
    feature.properties = properties;
  }

  return geoJson;
}

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneDetails(value) {
  if (!isObject(value)) return {};
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
