import { normalizeMapSymbol } from './normalizeMapSymbol.js';

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
