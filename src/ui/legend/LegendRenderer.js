/**
 * LegendRenderer.js - Visual legend for layer and thematic symbology.
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */

/** Create the legend for the currently selected layer symbology. */
export function createLayerLegend(layer) {
  if (layer?.loadState !== 'loaded') return null;

  const style = layer?.style || {};
  const thematic = Array.isArray(style.thematic) ? style.thematic : [];
  const activeTheme = thematic.find((theme) => theme?.active === true) || null;
  const geometryTypes = normalizeGeometryTypes(layer?.geometryTypes);

  const legend = document.createElement('div');
  legend.className = 'heurist-map-layer-legend';

  if (!activeTheme) {
    legend.append(createLegendRow({
      label: 'Default',
      symbol: style.symbol || {},
      geometryTypes
    }));
    return legend;
  }

  const fields = Array.isArray(activeTheme.fields) ? activeTheme.fields : [];
  for (const field of fields) {
    const ranges = Array.isArray(field?.ranges) ? field.ranges : [];
    if (!ranges.length) continue;

    const section = document.createElement('div');
    section.className = 'heurist-map-legend-field';

    const heading = document.createElement('div');
    heading.className = 'heurist-map-legend-field-title';
    heading.textContent = field?.title || field?.code || 'Values';
    section.append(heading);

    for (const range of ranges) {
      section.append(createLegendRow({
        label: getRangeLabel(range),
        symbol: { ...(activeTheme.symbol || {}), ...(range?.symbol || {}) },
        geometryTypes
      }));
    }
    legend.append(section);
  }

  // A thematic definition without ranges is still represented by its base symbol.
  if (!legend.childElementCount) {
    legend.append(createLegendRow({
      label: activeTheme.title || 'Theme',
      symbol: activeTheme.symbol || style.symbol || {},
      geometryTypes
    }));
  }
  return legend;
}

function createLegendRow({ label, symbol, geometryTypes }) {
  const row = document.createElement('div');
  row.className = 'heurist-map-legend-row';

  const samples = document.createElement('span');
  samples.className = 'heurist-map-legend-samples';
  appendGeometrySamples(samples, symbol, geometryTypes);

  const text = document.createElement('span');
  text.className = 'heurist-map-legend-label';
  text.textContent = label;
  text.title = label;

  row.append(samples, text);
  return row;
}

function appendGeometrySamples(container, symbol, geometryTypes) {
  const known = geometryTypes.point || geometryTypes.line || geometryTypes.polygon;
  // Loaded-but-empty GeoJSON has no geometry family to infer. Use a marker as
  // a compact generic fallback rather than drawing all three representations.
  const types = known ? geometryTypes : { point: true, line: false, polygon: false };

  if (types.point) container.append(createPointSample(symbol));
  if (types.line) container.append(createLineSample(symbol));
  if (types.polygon) container.append(createPolygonSample(symbol));
}

function createPointSample(symbol) {
  const wrapper = document.createElement('span');
  wrapper.className = 'heurist-map-legend-sample heurist-map-legend-point';

  if (symbol?.iconType === 'iconfont' && symbol.iconFont) {
    const icon = document.createElement('span');
    icon.className = String(symbol.iconFont);
    icon.style.color = symbol.color || symbol.fillColor || '';
    icon.style.fontSize = `${pointSize(symbol)}px`;
    wrapper.append(icon);
    return wrapper;
  }

  if ((symbol?.iconType === 'image' || symbol?.iconType === 'icon') && symbol.iconUrl) {
    const image = document.createElement('img');
    image.src = String(symbol.iconUrl);
    image.alt = '';
    image.style.width = `${pointSize(symbol)}px`;
    image.style.height = `${pointSize(symbol)}px`;
    wrapper.append(image);
    return wrapper;
  }

  const marker = document.createElement('span');
  marker.className = 'heurist-map-legend-circle';
  const size = pointSize(symbol);
  marker.style.width = `${size}px`;
  marker.style.height = `${size}px`;
  marker.style.borderStyle = symbol?.stroke === false ? 'none' : 'solid';
  marker.style.borderWidth = `${Math.max(1, Number(symbol?.weight) || 1)}px`;
  marker.style.borderColor = symbol?.color || 'transparent';
  marker.style.background = symbol?.fill === false ? 'transparent' : (symbol?.fillColor || 'transparent');
  marker.style.opacity = String(numberOr(symbol?.opacity, 1));
  wrapper.append(marker);
  return wrapper;
}

function createLineSample(symbol) {
  const wrapper = document.createElement('span');
  wrapper.className = 'heurist-map-legend-sample heurist-map-legend-line';
  const line = document.createElement('span');
  line.style.borderTopWidth = `${Math.max(1, Number(symbol?.weight) || 2)}px`;
  line.style.borderTopColor = symbol?.stroke === false ? 'transparent' : (symbol?.color || '#777');
  line.style.borderTopStyle = dashStyle(symbol?.dashArray);
  line.style.opacity = String(numberOr(symbol?.opacity, 1));
  wrapper.append(line);
  return wrapper;
}

function createPolygonSample(symbol) {
  const wrapper = document.createElement('span');
  wrapper.className = 'heurist-map-legend-sample heurist-map-legend-polygon';
  const polygon = document.createElement('span');
  polygon.style.borderStyle = symbol?.stroke === false ? 'none' : 'solid';
  polygon.style.borderWidth = `${Math.max(1, Number(symbol?.weight) || 1)}px`;
  polygon.style.borderColor = symbol?.color || 'transparent';
  polygon.style.background = symbol?.fill === false ? 'transparent' : (symbol?.fillColor || 'transparent');
  polygon.style.opacity = String(numberOr(symbol?.fillOpacity, numberOr(symbol?.opacity, 1)));
  wrapper.append(polygon);
  return wrapper;
}

function pointSize(symbol) {
  const iconSize = Array.isArray(symbol?.iconSize) ? Number(symbol.iconSize[0]) : Number(symbol?.iconSize);
  const radiusSize = Number(symbol?.radius) * 2;
  const size = Number.isFinite(iconSize) && iconSize > 0
    ? iconSize
    : (Number.isFinite(radiusSize) && radiusSize > 0 ? radiusSize : 12);
  return Math.max(5, Math.min(28, Math.round(size)));
}

function dashStyle(value) {
  if (value == null || value === '' || value === false) return 'solid';
  return 'dashed';
}

function getRangeLabel(range) {
  const label = range?.title ?? range?.label;
  if (label != null && String(label).trim()) return String(label);
  if (range?.min != null || range?.max != null) {
    return `${range.min ?? ''} – ${range.max ?? ''}`.trim();
  }
  if (Array.isArray(range?.value)) return range.value.join(', ');
  const value = String(range?.value ?? '');
  return value.includes('<>') ? value.replace('<>', ' – ') : value;
}

function normalizeGeometryTypes(value) {
  return {
    point: value?.point === true,
    line: value?.line === true,
    polygon: value?.polygon === true
  };
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
