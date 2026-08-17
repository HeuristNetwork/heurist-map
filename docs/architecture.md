# Heurist Map architecture

This document describes the internal client architecture of `heurist-map`. The application is engine-neutral above the map-adapter boundary and currently uses Leaflet as its rendering engine.

For configuration contracts see [`configuration.md`](configuration.md). For the relationship between this repository and the main Heurist application, run modes, maintenance, and distribution see [`integration.md`](integration.md).

## 1. Architectural goals

`heurist-map` is deliberately separated into application, data, rendering, host, and UI layers.

The main rules are:

- no dependency on HAPI4, `HRecordSet`, jQuery, or `window.hWin` inside the standalone application;
- no Leaflet object is exposed above the map-engine adapter;
- public Heurist data is obtained through API providers rather than directly from database-specific client structures;
- main-Heurist-only functions such as preferences, record editing, and publishing are isolated behind the host boundary;
- MapDocument and MapLayer data are normalized before they reach rendering code;
- heavy map data can be cancelled, deferred, unloaded, and recreated independently of lightweight document/layer definitions.

## 2. Initialization workflow

1. `src/main.js` calls `getHeuristMapConfig()` in `mapConfig.js`.
2. `mapConfig.js` reads the canonical launch envelope `{ runtime, settings, state }` from either `window.heuristMapBootstrap` or the same-origin iframe bridge `window.frameElement.heuristMapHost.getConfiguration()`.
3. Persisted settings are normalized through `mapConfigurationSchema.js` and canonical defaults.
4. `main.js` branches on `viewerMode`:
   - `configuration` starts `HeuristMapConfigurationApi` without a map engine;
   - normal map mode starts `initHeuristMap()`.
5. `initHeuristMap()` creates the map engine, host adapter, API client, data providers, and layer-loader registry.
6. `MapApplication` is created with those dependencies.
7. `HeuristMapPublicApi` wraps `MapApplication` and is exposed as `window.heuristMap`.
8. `MapApplication.initialize()` creates the dynamic MapDocument environment, initializes the engine, resolves basemaps/defaults, and applies initial state.
9. `MapControlPanel` and configured native controls are mounted.
10. Persisted MapDocuments are listed through `MapDocumentListProvider`; activating one loads its MapDocument, resolves ordered MapLayer references, prepares visible/in-range layers, and renders them.

Initialization and document changes use cancellation guards. If another document is activated while a previous document is still loading, stale requests and stale rendering work are abandoned rather than being allowed to replace the newly selected document.

## 3. Class hierarchy and collaboration

```text
HeuristMapPublicApi
    delegates to
MapApplication
    ├── HostAdapter
    │     ├── StandaloneHostAdapter
    │     └── HeuristHostAdapter
    ├── MapEngineAdapter
    │     └── LeafletMapAdapter
    ├── MapDocumentProvider
    │     └── HeuristApiClient
    ├── MapLayerProvider
    │     └── HeuristApiClient
    ├── QueryGeoDataProvider
    │     └── HeuristApiClient
    ├── ThematicAttributeProvider
    │     └── HeuristApiClient
    ├── RecordTypeProvider / MapDocumentListProvider
    │     └── HeuristApiClient
    ├── PopupProvider / ReportTemplateProvider
    └── LayerLoaderRegistry
          ├── GeoJsonLayerLoader
          ├── RemoteGeoJsonLayerLoader
          ├── ImageLayerLoader
          └── TileLayerLoader

HeuristMapConfigurationApi              (configuration-only startup)
    delegates to
MapConfigurationDialog
    uses
mapConfigurationSchema.js / mapConfigurationDefaults.js

PublishedMapDialog                      (shown after successful publishing)
```

## 4. Public API layer

`HeuristMapPublicApi` is the only object intended for host pages and wrapper widgets. It exposes MapDocument activation/reload/unload, layer creation and inspection, query layers, visibility, opacity, thematic selection, selection state, viewport operations, configuration UI, cancellation, and destruction without exposing `MapApplication` or Leaflet objects.

Public DOM events are likewise engine-neutral. They carry serializable document/layer/selection information rather than Leaflet event objects.

## 5. Application layer

`MapApplication` owns:

- the dynamic and persisted MapDocument registry;
- the active document;
- normalized map environment and basemap state;
- lightweight runtime layer registry;
- deferred and failed layer state;
- current selection;
- active thematic symbology;
- request cancellation and document-generation guards;
- dynamic viewport loading and arbitration;
- state capture/restore used by publishing.

A failure in one MapLayer is isolated to that layer. The failed layer remains visible in application state with `loadState: "error"`; sibling layers continue to load and render.

## 6. Data layer

`HeuristApiClient` performs public Heurist API requests. Providers validate endpoint-specific responses and return domain objects or GeoJSON. No provider returns `HRecordSet` or relies on `window.hWin`.

Important providers include:

- `MapDocumentProvider` — MapDocument presentation response;
- `MapLayerProvider` — MapLayer presentation response;
- `MapDocumentListProvider` — lightweight persisted MapDocument list through the standard records API;
- `QueryGeoDataProvider` — Heurist map/GeoJSON API, including paged loading and viewport predicates;
- `ThematicAttributeProvider` — selected direct/linked record details used by thematic symbology;
- `RecordTypeProvider` — resolves concept-coded system record types.

A small number of main-Heurist presentation helpers remain outside the public API boundary: popup HTML/report-template discovery and host operations such as preferences/publishing. These are isolated from the normal API providers.

## 7. Layer-loading layer

`LayerLoaderRegistry` selects a loader from `MapLayer.source.type`. Loaders fetch or normalize data and return an engine-neutral runtime layer definition.

Supported client-side source forms include Heurist query/record data, inline GeoJSON, remote GeoJSON, static image overlays, and tiled layers. Server-side map-data conversion can expose SHP, KML/KMZ, CSV/TSV, and GeoJSON sources through the same layer contract.

Initially hidden MapLayers and MapDocument references do not request their heavy source data. They are registered as deferred and loaded only when they become effective/visible.

## 8. Rendering layer

`MapEngineAdapter` defines the engine-neutral rendering contract. `LeafletMapAdapter` owns all Leaflet maps, layers, markers, popups, tiles, native controls, and plugin-specific objects.

Leaflet-specific integrations currently include:

- marker clustering;
- provider basemaps;
- native zoom and scale controls;
- bookmarks;
- browser print;
- geocoder search;
- tile pixel filtering for `transparentColor`;
- map view-change notifications used by dynamic viewport loading.

No Leaflet object is returned through `HeuristMapPublicApi`.

## 9. Host layer

`HostAdapter` defines operations that belong to the embedding host rather than the public map-data API.

`StandaloneHostAdapter` is effectively a no-op host for standalone pages that do not expose Heurist-specific services.

`HeuristHostAdapter` is selected when the bootstrap has a Heurist `baseUrl`. It provides:

- user map-preference load/save;
- temporary legacy `map_default_style` / `map_select_style` compatibility defaults;
- published-map save/load/delete;
- record editing through the parent iframe bridge when available.

These host operations do not leak into the engine/data-provider layers.

## 10. Configuration-editor layer

When `viewerMode === "configuration"`, `initHeuristMapConfiguration()` creates `HeuristMapConfigurationApi` instead of `MapApplication`.

No Leaflet map, data providers, MapDocument, or map sources are created in this mode. `MapConfigurationDialog` normalizes and serializes the same `heurist-map-settings` structure used by preferences, websites, and publishing.

The same dialog is also reused from a running map for Options/Publish workflows.

## 11. MapDocument model

There is no special runtime class for Current results. The predefined document ID `dynamic` uses the same application document registry as persisted MapDocuments.

Persisted documents are lightweight until activated. Activating a different document releases native layers and heavy feature payloads from the previous one while retaining enough metadata to reactivate it later.

Runtime layer operations include:

```javascript
await map.addLayer(definitionOrRecordId);
await map.removeLayer(layerId);
await map.clearLayer(layerId);
await map.addQueryLayer(query, options);
await map.setQueryForLayer(layerId, query, options);
```

The dynamic document retains its definitions/query while inactive; native layers and loaded feature payloads are recreated on activation.

## 12. Layer visibility, ranges, and deferred loading

Visibility is the combination of MapLayer visibility, MapDocument-reference visibility, zoom/range eligibility, and dynamic-layer arbitration.

A layer that is initially hidden or currently outside its effective dynamic range must not request heavy source data. Deferred application state is deliberately separate from native engine state, so an unloaded layer is not addressed as though it already existed in Leaflet.

When a deferred static layer first becomes visible it is loaded through the normal loader registry. Once loaded, ordinary visibility toggles reuse the native layer.

## 13. Dynamic viewport layers

Query layers may set `dynamicRequests: true` to load data for the current map extent rather than loading the complete result immediately.

Current rules are:

- view changes are reported by the engine adapter on `moveend` and debounced;
- the current extent is appended as a temporary Heurist geo predicate without modifying the stored query;
- newer viewport requests cancel older requests with `AbortController`;
- identical extent/zoom requests are not repeated;
- if multiple dynamic layers are simultaneously visible and in range, one effective layer is selected by layer order and a warning is emitted for overlap;
- out-of-range, hidden, or deferred dynamic layers do not request the server;
- data is loaded in pages and the configured feature limit is enforced (currently up to 5000 features per layer in configuration).

## 14. Symbology, thematic mapping, and legend

Simple symbol normalization is shared across layer rendering, selection, and legend/preview behavior.

A MapLayer may provide ordinary/default symbology and thematic maps. The thematic subsystem retrieves only the requested attribute fields for the relevant record IDs, resolves ranges/categories to symbols, and applies the selected theme without exposing Heurist record objects to the rendering engine.

`LegendRenderer` presents ordinary/thematic symbols using the same normalized symbol model. Selection symbology is likewise an application default and is passed to the engine in normalized form.

While old and new mapping coexist, the host may fill missing default and selection symbols from legacy user preferences; this is a compatibility bridge rather than a second persisted configuration format.

## 15. Selection and feature events

`MapApplication` keeps a deliberately small selection registry containing one runtime layer ID and a map of `featureId` to `recordId`. Multiple features may be selected, but only within one layer at a time.

`LeafletMapAdapter` privately indexes native feature layers and reports serializable click details. The application applies selection rules and asks the adapter to render the selection style. Full GeoJSON features and Leaflet objects are not copied into public selection state.

`mapViewer` can synchronize this public selection with the main Heurist application's `ON_REC_SELECT` event without giving `heurist-map` any HAPI dependency.

## 16. Lazy popup behavior

Popup HTML and Leaflet popup instances are created only when a feature is clicked. Initial GeoJSON rendering does not build popup content for every feature.

For normal Heurist record popups, `PopupProvider` uses Heurist presentation endpoints/templates through `baseUrl`. Minimal popup mode can render directly from the GeoJSON properties.

## 17. Control UI

`MapControlPanel` is an application overlay or side panel, not a Leaflet control. Its components depend on `HeuristMapPublicApi`, preserving map-engine isolation.

It manages:

- Current results and persisted MapDocuments;
- ordered layers and their loading/error states;
- layer visibility, opacity, zoom-to-extent, and editing requests;
- basemap selection;
- legend;
- Options and Publish actions.

Native map controls are configured separately and remain adapter-specific.

## 18. Cancellation and synchronization

Long-running map operations are designed to be interruptible.

The application distinguishes lightweight definitions from heavy source/rendering state, uses `AbortController` where requests support it, and checks document/request generations before committing results. This prevents a slow document, layer, or viewport request from becoming active after the user has already moved to another document or extent.

This synchronization behavior is a central difference from the legacy mapping implementation.
