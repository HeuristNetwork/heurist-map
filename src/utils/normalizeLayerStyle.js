/**
 * normalizeLayerStyle.js - Layer style normalization
 *
 * @fileOverview Converts public MapLayer style definitions into a consistent engine-neutral style structure.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import {
  DEFAULT_MAP_SYMBOL,
  normalizeMapSymbol,
  normalizeMapSymbolOverride
} from './normalizeMapSymbol.js';

/**
 * Normalize layer style.
 *
 * Ordinary symbol inheritance is deliberately local:
 * - no explicit layer symbol -> configured global symbol, completed from DEFAULT_MAP_SYMBOL;
 * - explicit layer symbol -> that symbol, completed from DEFAULT_MAP_SYMBOL (never global defaults).
 *
 * Each thematic base symbol is also completed directly from DEFAULT_MAP_SYMBOL.
 * Thematic range symbols remain partial overrides.
 */
export function normalizeLayerStyle(value = {}, defaults = {}) {
  const style = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const explicitSymbol = style.symbol !== undefined
    ? (hasMeaningfulSymbol(style.symbol) ? style.symbol : null)
    : (hasInlineSymbol(style) ? style : null);

  const symbol = explicitSymbol
    ? normalizeMapSymbol(explicitSymbol, DEFAULT_MAP_SYMBOL)
    : normalizeMapSymbol(defaults.symbol ?? {}, DEFAULT_MAP_SYMBOL);

  const selectSymbol = style.selectSymbol
    ?? style.selectSymbology
    ?? defaults.selectSymbol
    ?? defaults.selectSymbology
    ?? null;

  return {
    symbol,
    selectSymbol: selectSymbol && typeof selectSymbol === 'object' && !Array.isArray(selectSymbol)
      ? structuredCloneSafe(selectSymbol)
      : null,
    thematic: normalizeThematicMaps(style.thematic)
  };
}

function normalizeThematicMaps(value) {
  const source = Array.isArray(value)
    ? value
    : (value && typeof value === 'object' ? [value] : []);

  let activeSeen = false;
  return source
    .filter((theme) => theme && typeof theme === 'object' && !Array.isArray(theme))
    .map((theme) => {
      const requestedActive = theme.active === true || theme.active === 1 || theme.active === '1';
      const active = requestedActive && !activeSeen;
      if (active) activeSeen = true;

      return {
        ...structuredCloneSafe(theme),
        active,
        fields: normalizeThematicFields(theme.fields),
        symbol: normalizeMapSymbol(theme.symbol ?? {}, DEFAULT_MAP_SYMBOL)
      };
    });
}

function normalizeThematicFields(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((field) => field && typeof field === 'object' && !Array.isArray(field))
    .map((field) => ({
      ...structuredCloneSafe(field),
      code: field.code == null ? '' : String(field.code),
      title: field.title == null ? '' : String(field.title),
      ranges: normalizeThematicRanges(field.ranges)
    }));
}

function normalizeThematicRanges(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((range) => range && typeof range === 'object' && !Array.isArray(range))
    .map((range) => ({
      ...structuredCloneSafe(range),
      symbol: normalizeMapSymbolOverride(range.symbol)
    }));
}

function hasInlineSymbol(style) {
  const ignored = new Set(['type', 'thematic', 'selectSymbol', 'selectSymbology', 'symbol']);
  return Object.keys(style).some((key) => !ignored.has(key));
}

function hasMeaningfulSymbol(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length);
}

function structuredCloneSafe(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
