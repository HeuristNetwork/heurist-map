/**
 * normalizeLayerStyle.js - Layer style normalization
 *
 * @fileOverview Converts public simple MapLayer style definitions into a consistent engine-neutral style structure.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

import { normalizeMapSymbol } from './normalizeMapSymbol.js';

/**
 * Normalize layer style. A configured global symbol is used only when the
 * layer does not define its own simple/thematic base symbol.
 */
export function normalizeLayerStyle(value = {}, defaults = {}) {
  const style = value && typeof value === 'object' ? value : {};
  const type = style.type === 'thematic' ? 'thematic' : 'simple';
  const explicitSymbol = style.symbol !== undefined
    ? (hasMeaningfulSymbol(style.symbol) ? style.symbol : null)
    : (type === 'simple' && hasInlineSymbol(style) ? style : null);
  const symbol = explicitSymbol ?? defaults.symbol ?? {};
  const selectSymbol = style.selectSymbol
    ?? style.selectSymbology
    ?? defaults.selectSymbol
    ?? defaults.selectSymbology
    ?? null;

  return {
    type,
    symbol: normalizeMapSymbol(symbol),
    selectSymbol: selectSymbol && typeof selectSymbol === 'object'
      ? structuredCloneSafe(selectSymbol)
      : null,
    thematic: type === 'thematic' && style.thematic && typeof style.thematic === 'object'
      ? structuredCloneSafe(style.thematic)
      : null
  };
}

function hasInlineSymbol(style) {
  const ignored = new Set(['type', 'thematic', 'selectSymbol', 'selectSymbology']);
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
