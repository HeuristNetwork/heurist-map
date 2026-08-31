/**
 * configurationUtils.js - Shared configuration serialization and value helpers
 *
 * Copy this module into another Heurist presentation module and change the
 * format value when that module needs a distinct persisted configuration.
 *
 * @project     Heurist presentation modules
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */

export const CONFIGURATION_FORMAT = 'heurist-map-settings';
export const CONFIGURATION_VERSION = 1;
export const CONFIGURATION_MODES = Object.freeze(['preferences', 'website', 'publish']);

/** Produce a versioned JSON-safe settings envelope. */
export function serializeConfigurationSettings(value = {}, normalizeSettings = (item) => item) {
  const normalized = normalizeSettings(value);
  return {
    format: CONFIGURATION_FORMAT,
    version: CONFIGURATION_VERSION,
    options: normalized.options,
    config: normalized.config
  };
}

export function unwrapSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  if (value.format === CONFIGURATION_FORMAT && Number(value.version) === CONFIGURATION_VERSION) return value;
  return value;
}

export function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function boolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

export function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function stringValue(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

export function nullableString(value) {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' ? value : String(value);
}

export function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function nullablePositiveNumber(value) {
  const number = nullableNumber(value);
  return number !== null && number > 0 ? number : null;
}

export function nullableZoom(value) {
  const number = nullableNumber(value);
  return number !== null && number >= 0 && number <= 22 ? number : null;
}

export function allowedFeatureLimit(value, fallback) {
  const number = Number(value);
  return [500, 1000, 2000, 5000].includes(number) ? number : fallback;
}

export function nullableIdentifier(value, { numeric = false, allowDynamic = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (allowDynamic && String(value) === 'dynamic') return 'dynamic';
  if (!numeric) return String(value);
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function nullableList(value, { numeric = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (!Array.isArray(value)) return null;
  const result = [];
  for (const item of value) {
    const normalized = nullableIdentifier(item, { numeric });
    if (normalized !== null && !result.includes(normalized)) result.push(normalized);
  }
  return result;
}

export function normalizeBounds(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const west = nullableNumber(value.west);
  const south = nullableNumber(value.south);
  const east = nullableNumber(value.east);
  const north = nullableNumber(value.north);
  if ([west, south, east, north].some((item) => item === null)) return null;
  return { west, south, east, north };
}

export function nullableJsonObject(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return clone(value);
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
