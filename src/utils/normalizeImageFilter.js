/**
 * normalizeImageFilter.js - Image-layer filter normalization
 *
 * @fileOverview Normalizes the image filter properties stored in a MapLayer
 * symbol and converts them into a safe CSS filter string for map adapters.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

export const IMAGE_FILTER_NAMES = Object.freeze([
  'blur',
  'brightness',
  'contrast',
  'grayscale',
  'hue-rotate',
  'invert',
  'saturate',
  'sepia'
]);

/**
 * Normalize image filter properties from a map symbol.
 *
 * @param {Object} symbol MapLayer symbol.
 * @returns {Object} Normalized filter object containing supported properties only.
 */
export function normalizeImageFilter(symbol = {}) {
  const result = {};

  for (const name of IMAGE_FILTER_NAMES) {
    const value = symbol?.[name];
    if (value === undefined || value === null || value === '') {
      continue;
    }

    result[name] = normalizeFilterValue(name, value);
  }

  return result;
}

/**
 * Convert normalized image filter properties to CSS.
 *
 * @param {Object} filter Normalized image filter object.
 * @returns {string} CSS filter declaration value.
 */
export function createImageFilterCss(filter = {}) {
  return IMAGE_FILTER_NAMES
    .filter((name) => filter[name] !== undefined)
    .map((name) => `${name}(${filter[name]})`)
    .join(' ');
}

/**
 * Normalize opacity supplied either as 0-1 or as a percentage from 0-100.
 *
 * @param {*} value Opacity value.
 * @param {number} [fallback=1] Value returned for invalid input.
 * @returns {number} Opacity clamped to 0-1.
 */
export function normalizeOpacity(value, fallback = 1) {
  let number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  if (number > 1) {
    number /= 100;
  }

  return Math.min(1, Math.max(0, number));
}

function normalizeFilterValue(name, value) {
  const text = String(value).trim();

  if (name === 'blur' && /^-?\d+(?:\.\d+)?$/.test(text)) {
    return `${text}px`;
  }

  if (name === 'hue-rotate' && /^-?\d+(?:\.\d+)?$/.test(text)) {
    return `${text}deg`;
  }

  return text;
}
