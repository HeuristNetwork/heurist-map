/**
 * normalizeMapSymbol.js - Map symbol normalization
 *
 * @fileOverview Applies defaults and validates point, line, and polygon symbol properties used by map engine adapters.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

export const DEFAULT_MAP_SYMBOL = Object.freeze({
  iconType: 'circle',
  iconUrl: null,
  iconFont: null,
  iconSize: [24, 24],
  iconAnchor: null,
  popupAnchor: null,
  radius: 6,
  color: '#3388ff',
  weight: 2,
  dashArray: null, //"4 1 2 3"
  stroke: true,
  fillColor: '#3388ff',
  opacity: 1,  //stroke opacity
  fillOpacity: 0.5, //0~1 or 0~100
  fill: true
});

/**
 * Normalize a complete map symbol. Missing properties are filled from the
 * supplied defaults (DEFAULT_MAP_SYMBOL unless explicitly overridden).
 */
export function normalizeMapSymbol(value = {}, defaults = DEFAULT_MAP_SYMBOL) {
  const symbol = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fallback = defaults && typeof defaults === 'object' && !Array.isArray(defaults)
    ? defaults
    : DEFAULT_MAP_SYMBOL;

  return {
    iconType: normalizeIconType(symbol.iconType ?? symbol.type ?? fallback.iconType),
    iconUrl: nonEmptyStringOrNull(symbol.iconUrl ?? symbol.iconURL ?? fallback.iconUrl),
    iconFont: nonEmptyStringOrNull(symbol.iconFont ?? fallback.iconFont),
    iconSize: normalizePair(symbol.iconSize, fallback.iconSize),
    iconAnchor: normalizePair(symbol.iconAnchor, fallback.iconAnchor),
    popupAnchor: normalizePair(symbol.popupAnchor, fallback.popupAnchor),
    radius: nonNegativeNumber(symbol.radius, fallback.radius),
    color: nonEmptyString(symbol.color, fallback.color),
    fillColor: nonEmptyString(symbol.fillColor, fallback.fillColor),
    weight: nonNegativeNumber(symbol.weight, fallback.weight),
    opacity: unitInterval(symbol.opacity, fallback.opacity),
    fillOpacity: unitInterval(symbol.fillOpacity, fallback.fillOpacity),
    fill: booleanValue(symbol.fill, fallback.fill),
    stroke: booleanValue(symbol.stroke, fallback.stroke),
    dashArray: nonEmptyStringOrNull(symbol.dashArray ?? fallback.dashArray),
    blur: nonEmptyStringOrNull(symbol.blur ?? fallback.blur),
    brightness: nonEmptyStringOrNull(symbol.brightness ?? fallback.brightness),
    contrast: nonEmptyStringOrNull(symbol.contrast ?? fallback.contrast),
    grayscale: nonEmptyStringOrNull(symbol.grayscale ?? fallback.grayscale),
    'hue-rotate': nonEmptyStringOrNull(symbol['hue-rotate'] ?? symbol.hueRotate ?? fallback['hue-rotate'] ?? fallback.hueRotate),
    invert: nonEmptyStringOrNull(symbol.invert ?? fallback.invert),
    saturate: nonEmptyStringOrNull(symbol.saturate ?? fallback.saturate),
    sepia: nonEmptyStringOrNull(symbol.sepia ?? fallback.sepia),
  };
}

/**
 * Normalize only properties explicitly present in a symbol override.
 * This is used for thematic range symbols, which must remain partial and must
 * not inherit ordinary, global, or thematic-base symbol properties.
 */
export function normalizeMapSymbolOverride(value = {}) {
  const symbol = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};

  if (hasOwn(symbol, 'iconType') || hasOwn(symbol, 'type')) {
    result.iconType = normalizeIconType(symbol.iconType ?? symbol.type);
  }
  if (hasOwn(symbol, 'iconUrl') || hasOwn(symbol, 'iconURL')) {
    result.iconUrl = nonEmptyStringOrNull(symbol.iconUrl ?? symbol.iconURL);
  }
  if (hasOwn(symbol, 'iconFont')) result.iconFont = nonEmptyStringOrNull(symbol.iconFont);
  if (hasOwn(symbol, 'iconSize')) result.iconSize = normalizePair(symbol.iconSize, null);
  if (hasOwn(symbol, 'iconAnchor')) result.iconAnchor = normalizePair(symbol.iconAnchor, null);
  if (hasOwn(symbol, 'popupAnchor')) result.popupAnchor = normalizePair(symbol.popupAnchor, null);
  if (hasOwn(symbol, 'radius')) result.radius = nonNegativeNumber(symbol.radius, null);
  if (hasOwn(symbol, 'color')) result.color = nonEmptyStringOrNull(symbol.color);
  if (hasOwn(symbol, 'fillColor')) result.fillColor = nonEmptyStringOrNull(symbol.fillColor);
  if (hasOwn(symbol, 'weight')) result.weight = nonNegativeNumber(symbol.weight, null);
  if (hasOwn(symbol, 'opacity')) result.opacity = unitInterval(symbol.opacity, null);
  if (hasOwn(symbol, 'fillOpacity')) result.fillOpacity = unitInterval(symbol.fillOpacity, null);
  if (hasOwn(symbol, 'fill')) result.fill = booleanValue(symbol.fill, null);
  if (hasOwn(symbol, 'stroke')) result.stroke = booleanValue(symbol.stroke, null);
  if (hasOwn(symbol, 'dashArray')) result.dashArray = nonEmptyStringOrNull(symbol.dashArray);
  if (hasOwn(symbol, 'blur')) result.blur = nonEmptyStringOrNull(symbol.blur);
  if (hasOwn(symbol, 'brightness')) result.brightness = nonEmptyStringOrNull(symbol.brightness);
  if (hasOwn(symbol, 'contrast')) result.contrast = nonEmptyStringOrNull(symbol.contrast);
  if (hasOwn(symbol, 'grayscale')) result.grayscale = nonEmptyStringOrNull(symbol.grayscale);
  if (hasOwn(symbol, 'hue-rotate') || hasOwn(symbol, 'hueRotate')) {
    result['hue-rotate'] = nonEmptyStringOrNull(symbol['hue-rotate'] ?? symbol.hueRotate);
  }
  if (hasOwn(symbol, 'invert')) result.invert = nonEmptyStringOrNull(symbol.invert);
  if (hasOwn(symbol, 'saturate')) result.saturate = nonEmptyStringOrNull(symbol.saturate);
  if (hasOwn(symbol, 'sepia')) result.sepia = nonEmptyStringOrNull(symbol.sepia);

  return result;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeIconType(value) {
  const type = String(value || '').trim().toLowerCase();
  return ['circle', 'marker', 'icon', 'iconfont', 'url', 'rectype'].includes(type) ? type : 'circle';
}

function normalizePair(value, fallback) {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      return [first, second];
    }
  } else if (value !== null && value !== undefined && value !== '') {
    const val = Number(value);
    if (Number.isFinite(val)) {
      return [val, val];
    }
  }
  return Array.isArray(fallback) ? [...fallback] : null;
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function unitInterval(value, fallback) {
  let number = Number(value);
  if(Number.isFinite(number)){
    if(number>1){
      number = number / 100;
    }
    return Math.min(1, Math.max(0, number));
  }
  return fallback;
}

function booleanValue(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;

  const text = value == null ? '' : String(value).trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return fallback;
}

function nonEmptyString(value, fallback) {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function nonEmptyStringOrNull(value) {
  const text = value == null ? '' : String(value).trim();
  return text || null;
}
