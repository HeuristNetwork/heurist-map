/**
 * normalizeBounds.js - Geographic bounds normalization
 *
 * @fileOverview Converts supported API and runtime bounds representations into
 * the engine-neutral west/south/east/north structure used by map adapters.
 * @project     Heurist mapping application
 *
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2026 Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

/**
 * Normalize geographic bounds.
 *
 * @param {Object|Array|null} value Bounds using minx/miny/maxx/maxy,
 * west/south/east/north, or Leaflet-style corner arrays.
 * @returns {{west:number,south:number,east:number,north:number}|null}
 * Normalized bounds, or null when the value is invalid.
 */
export function normalizeBounds(value) {
  if (!value) {
    return null;
  }

  let west;
  let south;
  let east;
  let north;

  if (Array.isArray(value) && value.length >= 2) {
    south = Number(value[0]?.[0]);
    west = Number(value[0]?.[1]);
    north = Number(value[1]?.[0]);
    east = Number(value[1]?.[1]);
  } else {
    west = Number(value.west ?? value.minx ?? value.xmin);
    south = Number(value.south ?? value.miny ?? value.ymin);
    east = Number(value.east ?? value.maxx ?? value.xmax);
    north = Number(value.north ?? value.maxy ?? value.ymax);
  }

  if (![west, south, east, north].every(Number.isFinite)) {
    return null;
  }

  return {
    west: Math.min(west, east),
    south: Math.min(south, north),
    east: Math.max(west, east),
    north: Math.max(south, north)
  };
}
