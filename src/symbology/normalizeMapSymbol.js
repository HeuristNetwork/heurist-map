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
 * Normalize simple map symbology without depending on Leaflet or Heurist UI.
 */
export function normalizeMapSymbol(value = {}, defaults = DEFAULT_MAP_SYMBOL) {
  const symbol = value && typeof value === 'object' ? value : {};

  return {
    iconType: normalizeIconType(symbol.iconType ?? symbol.type ?? defaults.iconType),
    iconUrl: nonEmptyStringOrNull(symbol.iconUrl ?? symbol.iconURL ?? defaults.iconUrl),
    iconFont: nonEmptyStringOrNull(symbol.iconFont ?? symbol.iconFont ?? defaults.iconFont),
    iconSize: normalizePair(symbol.iconSize, defaults.iconSize),
    iconAnchor: normalizePair(symbol.iconAnchor, defaults.iconAnchor),
    popupAnchor: normalizePair(symbol.popupAnchor, defaults.popupAnchor),
    radius: nonNegativeNumber(symbol.radius, defaults.radius),
    color: nonEmptyString(symbol.color, defaults.color),
    fillColor: nonEmptyString(symbol.fillColor, symbol.color || defaults.fillColor),
    weight: nonNegativeNumber(symbol.weight, defaults.weight),
    opacity: unitInterval(symbol.opacity, defaults.opacity),
    fillOpacity: unitInterval(symbol.fillOpacity, defaults.fillOpacity),
    fill: booleanValue(symbol.fill, defaults.fill),
    stroke: booleanValue(symbol.stroke, defaults.stroke),
    dashArray: nonEmptyStringOrNull(symbol.dashArray ?? defaults.dashArray),
    blur: nonEmptyStringOrNull(symbol.blur),
    brightness: nonEmptyStringOrNull(symbol.brightness),
    contrast: nonEmptyStringOrNull(symbol.contrast),
    grayscale: nonEmptyStringOrNull(symbol.grayscale),
    'hue-rotate': nonEmptyStringOrNull(symbol['hue-rotate'] ?? symbol.hueRotate),
    invert: nonEmptyStringOrNull(symbol.invert),
    saturate: nonEmptyStringOrNull(symbol.saturate),
    sepia: nonEmptyStringOrNull(symbol.sepia),
  };
}

function normalizeIconType(value) {
  const type = String(value || '').trim().toLowerCase();
  return ['circle', 'marker', 'icon', 'iconfont'].includes(type) ? type : 'circle';
}

function normalizePair(value, fallback) {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      return [first, second];
    }
  }else {
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
  return typeof value === 'boolean' ? value : fallback;
}

function nonEmptyString(value, fallback) {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function nonEmptyStringOrNull(value) {
  const text = value == null ? '' : String(value).trim();
  return text || null;
}
