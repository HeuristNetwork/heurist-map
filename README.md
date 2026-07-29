# Heurist Map

Standalone and embeddable mapping application for Heurist.

## 1. Purpose

`heurist-map` is a separate Vite project for the next-generation Heurist mapping application. It is developed in parallel with the existing `mapping.js`, `app_timemap`, and `app_storymap` implementation.

Phase 1 establishes:

- a standalone full-window map application;
- a stable runtime configuration object;
- an engine-neutral `MapApplication` controller;
- a `MapEngineAdapter` contract;
- an initial Leaflet adapter;
- a host-adapter boundary for future Heurist editing integration;
- a narrow same-origin iframe/direct integration API exposed as `window.heuristMap`;
- fixed Vite distribution file names suitable for copying into Heurist.

This phase defines and normalizes the MapDocument model but does not yet load MapDocument or Map Layer records from the Heurist public API. Query layers, timeline integration, drawing, symbology editors, and record editing remain later phases.

## 2. Requirements

Recommended environment:

- Node.js 22 or later;
- npm 10 or later;
- a modern browser with ES module support.

Runtime dependency:

- Leaflet 1.9.4.

## 3. Project structure

```text
src/
  main.js
  mapConfig.js
  initHeuristMap.js
  style.css

  core/
    MapApplication.js

  adapters/map/
    MapEngineAdapter.js
    LeafletMapAdapter.js
    createMapEngine.js

  host/
    HostAdapter.js
    StandaloneHostAdapter.js
    createHostAdapter.js

  public-api/
    HeuristMapPublicApi.js
```

The application core does not expose Leaflet objects. A future map engine, such as Google Maps, MapLibre, or OpenLayers, can implement the same `MapEngineAdapter` contract.

## 4. Runtime configuration

`window.heuristMapConfig` is the public MapDocument domain model generated from an `RT_MAP_DOCUMENT` record. It contains no Leaflet-specific objects or runtime DOM settings.

```js
window.heuristMapConfig = {
  format: 'heurist-map-document',
  version: 1,
  id: null,
  title: 'Default map document',
  mapBookmark: {
    raw: null,
    type: 'view',
    center: { latitude: -33.8688, longitude: 151.2093 },
    zoom: 3
  },
  geoObject: null,
  symbology: null,
  minimumZoom: null,
  maximumZoom: null,
  zoomToPointInKM: 5,
  worldBaseMap: { id: null, code: 'OpenStreetMap', label: 'OpenStreetMap' },
  crs: { id: null, code: 'EPSG:3857', label: 'Web Mercator' },
  layers: []
};
```

Runtime-only application settings are separate:

```js
window.heuristMapOptions = {
  containerId: 'heurist-map',
  engine: 'leaflet',
  readonly: true
};
```

Internally, the MapDocument is converted into a private engine-neutral `MapEnvironment`; only the Leaflet adapter creates Leaflet options and objects.

## 5. Development

Install dependencies and start Vite:

```bash
npm install
npm run dev
```

The development server uses:

```text
http://127.0.0.1:5174/
```

Requests beginning with `/heurist` are proxied to local Apache at `http://127.0.0.1`.

## 6. Build

```bash
npm run build
```

The project creates fixed distribution names under `dist/`:

```text
dist/
  heurist-map.js
  heurist-map-style.css
  heurist-map.js.map
```

Additional chunks use the prefix `heurist-map-`.

## 7. Public integration API

After initialization, the application exposes a narrow API:

```js
const map = iframe.contentWindow.heuristMap;
await map.ready();
```

Available Phase 1 methods:

```js
await map.getCapabilities();
await map.addLayer(layerDefinition);
await map.removeLayer(layerId);
await map.setLayerVisibility(layerId, true);
await map.setView({ latitude: -33.86, longitude: 151.20 }, 10);
await map.fitBounds({ west: 150, south: -34, east: 152, north: -33 });
await map.invalidateSize();
const view = await map.getViewState();
await map.destroy();
```

Example GeoJSON layer:

```js
await map.addLayer({
  id: 'sample-places',
  type: 'geojson',
  visible: true,
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { title: 'Sydney' },
        geometry: {
          type: 'Point',
          coordinates: [151.2093, -33.8688]
        }
      }
    ]
  }
});
```

No native Leaflet map or layer objects are exposed through this API.

## 8. Phase 1 limitations

The following are reserved for later phases:

- Heurist public API data provider;
- query layers;
- map-document loading;
- timeline;
- selection synchronization;
- layer panel;
- marker clustering;
- custom CRS;
- image and GeoTIFF layers;
- drawing;
- map-document and layer editing;
- symbology and thematic-map editors;
- Heurist host adapter;
- wrapper widgets for the main Heurist interface.
