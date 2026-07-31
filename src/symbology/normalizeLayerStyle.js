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
 * Normalize layer style.
 *
 * @returns {*} Function result.
 */
export function normalizeLayerStyle(value = {}) {
  const style = value && typeof value === 'object' ? value : {};
  const type = style.type === 'thematic' ? 'thematic' : 'simple';

  return {
    type,
    symbol: normalizeMapSymbol(style.symbol ?? (type === 'simple' ? style : {})),
    thematic: type === 'thematic' && style.thematic && typeof style.thematic === 'object'
      ? structuredCloneSafe(style.thematic)
      : null
  };
}

function structuredCloneSafe(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
