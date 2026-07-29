import { LeafletMapAdapter } from './LeafletMapAdapter.js';

/**
 * Create the configured map engine without exposing its implementation to the app.
 */
export function createMapEngine(engine) {
  switch (engine) {
    case 'leaflet':
      return new LeafletMapAdapter();
    default:
      throw new Error(`Unsupported map engine: ${engine}`);
  }
}
