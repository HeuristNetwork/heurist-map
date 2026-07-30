export const DEFAULT_MAP_SYMBOL = Object.freeze({
  iconType: 'circle',
  iconUrl: null,
  iconSize: [24, 24],
  iconAnchor: null,
  popupAnchor: null,
  radius: 6,
  color: '#3388ff',
  fillColor: '#3388ff',
  weight: 2,
  opacity: 1,
  fillOpacity: 0.4,
  fill: true,
  stroke: true
});

/**
 * Normalize simple map symbology without depending on Leaflet or Heurist UI.
 */
export function normalizeMapSymbol(value = {}, defaults = DEFAULT_MAP_SYMBOL) {
  const symbol = value && typeof value === 'object' ? value : {};

  return {
    iconType: normalizeIconType(symbol.iconType ?? symbol.type ?? defaults.iconType),
    iconUrl: nonEmptyStringOrNull(symbol.iconUrl ?? symbol.iconURL ?? defaults.iconUrl),
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
    stroke: booleanValue(symbol.stroke, defaults.stroke)
  };
}

function normalizeIconType(value) {
  const type = String(value || '').trim().toLowerCase();
  return ['circle', 'marker', 'icon'].includes(type) ? type : 'circle';
}

function normalizePair(value, fallback) {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      return [first, second];
    }
  }
  return Array.isArray(fallback) ? [...fallback] : null;
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function unitInterval(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
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
