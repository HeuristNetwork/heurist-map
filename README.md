# Heurist Map

Standalone and embeddable mapping application for Heurist.

## 1. Purpose

`heurist-map` is a separate Vite project for the next-generation Heurist mapping application. It is developed in parallel with the legacy `mapping.js`, `app_timemap`, and `app_storymap` implementation.

Phase 2 adds read-only Heurist public API integration while retaining the Phase 1 engine-neutral application and Leaflet adapter.

Implemented in this phase:

- `HeuristApiClient` based on `fetch`;
- MapDocument and MapLayer response validation;
- `MapDocumentProvider`;
- `MapLayerProvider`;
- `QueryGeoDataProvider`;
- `map.loadMapDocument(recordId)`;
- ordered loading of Map Layer references;
- public query and single-record GeoJSON sources;
- automatic GeoJSON pagination;
- request cancellation;
- clear API/network/JSON errors;
- MapDocument and MapLayer response fixtures;
- reserved timeline response constants without timeline loading or rendering.

Editing is not included.

## 2. Requirements

- Node.js 22 or later;
- npm 10 or later;
- a modern browser with ES module support;
- Leaflet 1.9.4;
- Heurist mapping endpoints described by `docs/heurist-openapi.yaml`.

## 3. Project structure

```text
src/
  main.js
  mapConfig.js
  initHeuristMap.js

  core/
    MapApplication.js

  data/
    HeuristApiClient.js
    HeuristApiError.js
    MapDocumentProvider.js
    MapLayerProvider.js
    QueryGeoDataProvider.js

  map-document/
    MapDocument.js
    createMapEnvironment.js

  map-layer/
    MapLayer.js

  timeline/
    TimelineResponse.js

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

public/fixtures/
  map-document.json
  map-layer.json
```

## 4. Runtime configuration

`window.heuristMapConfig` is the initial engine-neutral MapDocument. It may be a local/default document; a persisted API MapDocument can later replace it through `loadMapDocument()`.

```js
window.heuristMapConfig = {
  format: 'heurist-map-document',
  version: 1,
  id: null,
  title: 'Default map document',
  mapBookmark: {
    raw: '',
    type: 'view',
    center: { latitude: -33.8688, longitude: 151.2093 },
    zoom: 3
  },
  bounds: null,
  symbology: null,
  minimumZoom: null,
  maximumZoom: null,
  zoomToPointInKM: 5,
  worldBaseMap: { id: null, code: 'OpenStreetMap', label: 'OpenStreetMap' },
  crs: { id: null, code: 'EPSG:3857', label: 'Web Mercator' },
  layers: []
};
```

Runtime and API settings are separate:

```js
window.heuristMapOptions = {
  containerId: 'heurist-map',
  engine: 'leaflet',
  readonly: true,
  apiBaseUrl: '/heurist/api',
  database: 'my_database'
};
```

`serverUrl` may be supplied instead of `apiBaseUrl`. If it does not end with `/api`, the client appends `/api`.

Optional authenticated access:

```js
window.heuristMapOptions.accessToken = 'bearer-token';
window.heuristMapOptions.requestHeaders = {
  'X-Custom-Header': 'value'
};
```

## 5. Loading a MapDocument

```js
const map = window.heuristMap;
await map.ready();
await map.loadMapDocument(123);
```

The load operation performs the following steps:

1. `GET /api/{database}/map/document/{recordId}`;
2. sort layer references by `order`;
3. `GET /api/{database}/map/layer/{recordId}` for each reference;
4. obtain GeoJSON from `/map` for `heurist-query` or `record` sources;
5. initialize the map environment and add layers in document order;
6. apply the document bookmark.

API data is prepared before the existing map is replaced. A failed document or layer request therefore does not clear the displayed map.

Supported Phase 2 MapLayer source types:

```text
heurist-query
record
inline-geojson
```

Other source types return a clear unsupported-source error until their later implementation phases.

## 6. Query GeoJSON

`QueryGeoDataProvider` selects GET for short string queries and POST for structured or long queries. It supports:

- `limit` and `offset`;
- geometry simplification;
- `AbortSignal`;
- automatic pagination through `searchAll()`;
- GeoJSON response validation.

Query-backed MapLayers are loaded through:

```text
GET  /api/{database}/map?q=...
POST /api/{database}/map
```

Single-record layers use:

```text
GET /api/{database}/map/{recordId}
```

## 7. Cancellation

Starting a new MapDocument load automatically aborts the previous load.

Explicit cancellation:

```js
map.cancelPendingRequests('The user selected another document');
```

External cancellation:

```js
const controller = new AbortController();
const promise = map.loadMapDocument(123, {
  signal: controller.signal
});

controller.abort();
await promise;
```

## 8. API errors

`HeuristApiError` retains:

- HTTP status and status text;
- request URL and method;
- Heurist error code and response details;
- the original network or JSON parsing error as `cause`.

Errors are augmented with document/layer context, for example:

```text
Cannot load MapDocument record 123: Cannot load MapLayer record 1001: Heurist API request failed: Record not found
```

## 9. Timeline reservation

`src/timeline/TimelineResponse.js` reserves:

```js
export const TIMELINE_FORMAT = 'heurist-timeline';
export const TIMELINE_VERSION = 1;
```

No `/time` request, timeline provider, or timeline UI is connected in Phase 2.

## 10. Development and tests

```bash
npm install
npm test
npm run dev
```

The Vite development server uses:

```text
http://127.0.0.1:5174/
```

Requests beginning with `/heurist` are proxied to local Apache at `http://127.0.0.1`.

## 11. Build

```bash
npm run build
```

Expected distribution names:

```text
dist/
  heurist-map.js
  heurist-map-style.css
  heurist-map.js.map
```

No native Leaflet map or layer object is exposed through `window.heuristMap`.

## 12. Phase 2.1 and Phase 3A

This revision adds the first stable layer-domain boundary:

- application-level layer registry separate from native Leaflet layers;
- public `getLayers()`, `getLayer()`, `reloadLayer()`, and `clearLayers()` methods;
- runtime layer IDs use `reference.id ?? map-layer-{recordId}`;
- loader registry replaces the MapApplication source-type switch;
- pure simple-symbol normalization;
- normalized feature metadata under `feature.properties.heurist`;
- deterministic client-side feature IDs when external GeoJSON has no ID;
- basic escaped popups;
- `remote-geojson` and `tile` source loaders;
- clear rendering errors after an unrecoverable map replacement failure.

Supported source types are now:

```text
heurist-query
record
inline-geojson
remote-geojson
tile
```

Example layer inspection:

```js
const layers = window.heuristMap.getLayers();
const layer = window.heuristMap.getLayer('map-layer-101');
await window.heuristMap.setLayerVisibility(layer.id, false);
await window.heuristMap.reloadLayer(layer.id);
```

For external GeoJSON, IDs are normalized in this order:

1. existing `feature.id`;
2. `properties.featureId` or `properties.id`;
3. Heurist record ID plus feature position, as `record-{recordId}-feature-{position}`;
4. deterministic local ID, as `{layerId}-feature-{position}`.

A future server-side conversion service for SHP and KML should preferably emit a
stable `feature.id`. The client-side fallback remains useful for arbitrary
third-party GeoJSON.


## Architecture documentation

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the initialization workflow, class hierarchy, and current architectural boundaries.

### Bounds format

The public API may return bounds as `{minx, miny, maxx, maxy}`. The client normalizes this once to the engine-neutral form `{west, south, east, north}`. MapDocument bounds are used as the initial viewport when no explicit bookmark is supplied. Tile/tiled-image bounds are forwarded to the map adapter to restrict tile loading to the image extent.


### Static image layers

A MapLayer with `source.type: "image"` is rendered as a georeferenced image overlay. The API should preferably return an absolute image URL and geographic bounds.

```json
{
  "source": {
    "type": "image",
    "url": "https://example.org/heurist/?fullres=1&db=my_database&file=12",
    "bounds": {
      "minx": 151.11488376,
      "miny": -33.93908829,
      "maxx": 151.3212204,
      "maxy": -33.74375321
    }
  },
  "style": {
    "type": "simple",
    "symbol": {
      "opacity": 75,
      "blur": "10px",
      "brightness": "3",
      "contrast": "3"
    }
  }
}
```

`opacity` accepts either `0-1` values or percentages from `0-100`. Image filter properties remain in `style.symbol`. Supported filters are `blur`, `brightness`, `contrast`, `grayscale`, `hue-rotate`, `invert`, `saturate`, and `sepia`.

### GeoJSON rendering performance

The application-level layer registry stores only lightweight layer metadata. It does not clone or expose the GeoJSON `data` payload through `getLayer()`, `getLayers()`, or layer events. The Leaflet adapter also reuses one marker icon per layer and creates popup HTML and popup instances only after the first feature click.

### Deferred loading of initially hidden layers

MapDocument loading fetches each lightweight MapLayer definition to determine its source and initial visibility. When a MapLayer response has `visible: false`, its source data is not requested and no native map layer is created. The application registers it with `loadState: "deferred"`.

The first call to:

```javascript
await window.heuristMap.setLayerVisibility(layerId, true);
```

loads and renders the source. Subsequent visibility changes reuse the loaded native layer and do not repeat the source request. `getLayers()` and `getLayer()` expose the `deferred`, `loading`, `loaded`, or `error` state.

## Phase 5A: map control panel

The standalone application can load a lightweight list of persisted MapDocument records through the standard Heurist API. It resolves the database-specific MapDocument record type ID from concept code `3-1019`, then searches `/records/` with either all documents, an ID list, or a standard Heurist query.

```js
await window.heuristMap.loadMapDocuments();
await window.heuristMap.loadMapDocuments([1, 2, 3]);
await window.heuristMap.loadMapDocuments('t:24 sortby:rec_Title');
```

The first returned document is activated by default. Persisted MapDocuments are mutually exclusive: activating another document removes the previous document's native layers and heavy data while retaining the lightweight document list.

A compact URL form is supported:

```text
?doc=1,2,3
```

Runtime options remain explicit:

```js
window.heuristMapOptions = {
  database: 'osmak_mapping',
  apiBaseUrl: 'http://127.0.0.1/heurist/api',
  documents: {
    query: null,
    autoLoad: true,
    activateFirst: true
  },
  ui: {
    enabled: true,
    placement: 'overlay', // overlay | external | none
    containerId: null,
    position: 'top-right',
    initiallyExpanded: true,
    showCurrentDocument: false, // reserved for the later dynamic document
    showMapDocuments: true,
    showLayers: true,
    showBaseMaps: true
  }
};
```

The `MapControlPanel` is engine-neutral and interacts only through `HeuristMapPublicApi`. It provides MapDocument selection, ordered layer rows, deferred/loading/loaded/error states, layer visibility, zoom-to-extent, runtime global opacity, edit-request events, and configured basemap selection. The current/dynamic document is intentionally deferred to a later phase.
