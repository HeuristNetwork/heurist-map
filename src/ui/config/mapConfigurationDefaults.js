/**
 * mapConfigurationDefaults.js - Canonical persisted map configuration defaults
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */

/** Public, user-configurable viewer defaults. */
export const HEURIST_MAP_OPTIONS_DEFAULTS = Object.freeze({
  ui: Object.freeze({
    enabled: true,
    placement: 'overlay',
    position: 'top-right',
    initiallyExpanded: true,
    showCurrentDocument: true,
    showMapDocuments: true,
    showLayers: true,
    showBaseMaps: true,
    showLegend: true,
    showZoomControl: true,
    showSearch: false,
    showPublish: true,
    controlCss: null
  }),
  mapDocuments: Object.freeze({
    allowed: null,
    initiallyActive: null
  }),
  baseMaps: Object.freeze({
    allowed: null,
    initial: null
  }),
  interaction: Object.freeze({
    selectionEnabled: true,
    popupEnabled: true,
    zoomOnSelection: false
  })
});

/** Public defaults shared by MapDocuments/MapLayers when they omit a value. */
export const HEURIST_MAP_CONFIG_DEFAULTS = Object.freeze({
  defaults: Object.freeze({
    zoomToPointInKM: null,
    symbology: null,
    selectSymbology: null,
    preventContinuousWorldBasemap: false,
    markerClustering: false,
    maxAllowedFeatures: 1000,
    dynamicRequests: false,
    popupTemplate: null
  }),
  dynamicDocument: Object.freeze({
    enabled: true,
    title: 'Current results',
    minZoom: null,
    maxZoom: null,
    minimumZoomKm: null,
    maximumZoomKm: null,
    bounds: null
  })
});

/** Return independent mutable defaults for editing. */
export function createMapConfigurationDefaults() {
  return {
    options: clone(HEURIST_MAP_OPTIONS_DEFAULTS),
    config: clone(HEURIST_MAP_CONFIG_DEFAULTS)
  };
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
