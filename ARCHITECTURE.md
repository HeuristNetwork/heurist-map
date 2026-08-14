# Heurist Map architecture

This document describes the current read-only initialization flow and the main class relationships. The application is engine-neutral above the map adapter boundary and currently uses Leaflet as its first rendering engine.

## Initialization workflow

1. `src/main.js` calls `getHeuristMapConfig()` in `mapConfig.js`, which reads the single launch envelope `window.heuristMapBootstrap = { runtime, settings, state }` (or the same-origin iframe bridge at `window.frameElement.heuristMapHost.getConfiguration()`) and normalizes it against the configuration schema. See `docs/configuration.md` for the full bootstrap and `heurist-map-settings` contract; `window.heuristMapConfig`/`window.heuristMapOptions` are not read anywhere in the code.
2. `main.js` branches on `config.viewerMode`: `initHeuristMapConfiguration()` starts the lightweight `HeuristMapConfigurationApi` (configuration-editor-only, no map engine); any other mode starts the full map through `initHeuristMap()`.
3. `initHeuristMap()` locates the map container and creates the configured map engine and host adapter (`createHostAdapter()` returns `HeuristHostAdapter` when `config.host.type === 'heurist'`, otherwise `StandaloneHostAdapter`).
4. `HeuristApiClient` is created with the API base URL, database, token, and request headers.
5. `MapDocumentProvider`, `MapLayerProvider`, `QueryGeoDataProvider`, `RecordTypeProvider`, and `MapDocumentListProvider` are created around the API client.
6. `createLayerLoaderRegistry()` registers loaders for Heurist query, record, inline GeoJSON, remote GeoJSON, image, and tile sources.
7. `MapApplication` is created with the map engine, host, providers, and loader registry.
8. `HeuristMapPublicApi` wraps the application, is given a `MapConfigurationDialog` factory, and is exposed as `window.heuristMap` for direct and same-origin iframe integrations.
9. `MapApplication.initialize()` converts the default MapDocument into a private map environment, initializes the engine, resolves the base map, and applies the initial bookmark; `initHeuristMap()` then mounts `MapControlPanel` and, once the API client is configured, loads the persisted MapDocument list.
10. `window.heuristMap.loadMapDocument(recordId)` loads the MapDocument, resolves ordered MapLayer references, loads each source, rebuilds the map environment, renders the layers, and applies the bookmark.

## Class hierarchy and collaboration

```text
HeuristMapPublicApi
    delegates to
MapApplication
    ├── HostAdapter
    │     ├── StandaloneHostAdapter
    │     └── HeuristHostAdapter          (FrontController: preferences + publishing)
    ├── MapEngineAdapter
    │     └── LeafletMapAdapter
    ├── MapDocumentProvider
    │     └── HeuristApiClient
    ├── MapLayerProvider
    │     └── HeuristApiClient
    ├── QueryGeoDataProvider
    │     └── HeuristApiClient
    ├── RecordTypeProvider / MapDocumentListProvider
    │     └── HeuristApiClient
    └── LayerLoaderRegistry
          ├── GeoJsonLayerLoader
          ├── RemoteGeoJsonLayerLoader
          ├── ImageLayerLoader
          └── TileLayerLoader

HeuristMapConfigurationApi              (started instead of MapApplication when
    delegates to                          config.viewerMode === "configuration";
MapConfigurationDialog                    no map engine, host, or providers)
    uses
mapConfigurationSchema.js / mapConfigurationDefaults.js

PublishedMapDialog                      (shown after HostAdapter.publishMap();
                                          not part of the MapApplication tree)
```

### Public API layer

`HeuristMapPublicApi` is the only object intended for host pages and wrapper widgets. It exposes MapDocument loading, layer inspection, visibility, viewport, cancellation, and destruction without exposing `MapApplication` or Leaflet objects.

### Application layer

`MapApplication` owns the current MapDocument, normalized map environment, request cancellation, and engine-neutral runtime layer registry.

### Data layer

`HeuristApiClient` performs public API requests. Providers validate endpoint-specific responses and return public domain objects or GeoJSON. No provider returns `HRecordSet` or relies on `window.hWin`.

### Layer-loading layer

`LayerLoaderRegistry` selects a loader from `MapLayer.source.type`. Loaders fetch or normalize data and return an engine-neutral runtime layer definition.

### Rendering layer

`MapEngineAdapter` defines the engine-neutral rendering contract. `LeafletMapAdapter` owns all Leaflet maps, native layers, markers, popups, and tiles. No Leaflet object is exposed through the application or public API.

### Host layer

`HostAdapter` defines the contract for preferences and publishing outside the public map API. `StandaloneHostAdapter` is a no-op implementation used when no Heurist root URL is configured. `HeuristHostAdapter` calls the main Heurist `FrontController` (`UserController.get_prefs`/`save_prefs`, `MapPublishedController.save`/`get`/`delete`) for persisted map preferences and published-map links; it is selected by `createHostAdapter()` whenever `heuristMapBootstrap.runtime.baseUrl` is present. `PublishedMapDialog` is a standalone UI shown by the caller after a successful `HostAdapter.publishMap()`; it is not owned by `MapApplication`.

### Configuration-editor layer

`heurist-map` can start in a lightweight configuration-only mode instead of a full map (`config.viewerMode === "configuration"`, set via `heuristMapBootstrap.runtime.viewerMode`). `initHeuristMapConfiguration()` creates `HeuristMapConfigurationApi` and exposes it as `window.heuristMap` in place of `HeuristMapPublicApi` — no map engine, host adapter, providers, or MapDocument is created in this mode. `HeuristMapConfigurationApi` opens `MapConfigurationDialog`, and normalizes/serializes/defaults settings through `mapConfigurationSchema.js` and `mapConfigurationDefaults.js`. `MapConfigurationDialog` is also reused inside the full map mode (via `HeuristMapPublicApi`'s configuration-dialog factory) so the same editor UI serves the `preferences`, `website`, and `publish` workflows described in `docs/configuration.md` §6.

## Lazy popup behavior

Popup HTML and Leaflet popup instances are created only on the first feature click. Initial GeoJSON rendering does not build popup content for every feature.

## Current phase boundaries

The implementation is read-only. It includes public API integration, MapDocument and MapLayer loading, GeoJSON and tile rendering, simple symbology, normalized feature metadata, basic eager popups, cancellation, and layer inspection.

Editing, timeline integration, thematic mapping, richer legends, and wrapper widgets belong to later phases. Phase 4 now provides engine-neutral feature events and single-layer multi-selection.

## Deferred hidden layers

MapApplication resolves MapLayer records in document order, but it does not load source data for definitions whose initial `visible` value is `false`. These layers are retained in an internal deferred registry and exposed publicly with `loadState: "deferred"`. The first visibility request loads the source through the normal LayerLoaderRegistry and renders it through the active map adapter. Once loaded, normal show/hide operations do not reload it.

## Phase 5A control UI

`src/ui/MapControlPanel.js` is an application overlay or external panel, not a Leaflet control. Its child components are `MapDocumentSelector`, `LayerPanel`, `LayerPanelItem`, and `BaseMapSelector`. They depend only on `HeuristMapPublicApi`, preserving map-engine isolation.

`RecordTypeProvider` resolves the MapDocument concept code `3-1019`; `MapDocumentListProvider` uses the standard records endpoint. `MapApplication` retains lightweight MapDocument list state and renders only one persisted MapDocument at a time. Layer order is taken directly from the MapDocument API response and is not editable in the panel.


## Phase 4 events and selection

`MapApplication` owns a deliberately small selection registry containing one runtime layer ID and a map of `featureId` to `recordId`. Multiple features may be selected, but only within one layer at a time. Full GeoJSON features and Leaflet objects are not copied into public selection state.

`LeafletMapAdapter` privately indexes native feature layers and reports serializable click details through interaction callbacks. It applies and restores native selection styles and resolves bounds for `zoomToSelection()`. `layer.selectable === false` is enforced by both the application and the adapter interaction path.

All host interaction goes through `HeuristMapPublicApi` methods and DOM events; no Leaflet event object is exposed.

## Dynamic MapDocument

Phase 6A does not introduce a separate dynamic-document class. The predefined
`dynamic` entry uses the same MapApplication document registry as persisted
MapDocuments. Document entries may contain lightweight `layerDefinitions`;
these are intentionally omitted from public document-list results.

Runtime layer operations are split internally:

- `renderRuntimeLayer()` renders an already prepared engine-neutral layer.
- `addLayer()` stores a public MapLayer definition on a document and prepares it
  through the existing LayerLoaderRegistry.
- `removeLayer()` removes both definition and native layer.
- `clearLayer()` removes current data/native state but retains the definition.

The dynamic document retains definitions and queries while inactive, but its
native layers and loaded feature payloads are recreated on activation.
