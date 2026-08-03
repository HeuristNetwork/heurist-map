# Heurist Map architecture

This document describes the current read-only initialization flow and the main class relationships. The application is engine-neutral above the map adapter boundary and currently uses Leaflet as its first rendering engine.

## Initialization workflow

1. `src/main.js` reads `window.heuristMapConfig` and `window.heuristMapOptions` through `mapConfig.js`.
2. `initHeuristMap()` locates the map container and creates the configured map engine and host adapter.
3. `HeuristApiClient` is created with the API base URL, database, token, and request headers.
4. `MapDocumentProvider`, `MapLayerProvider`, and `QueryGeoDataProvider` are created around the API client.
5. `createLayerLoaderRegistry()` registers loaders for Heurist query, record, inline GeoJSON, remote GeoJSON, and tile sources.
6. `MapApplication` is created with the map engine, host, providers, and loader registry.
7. `HeuristMapPublicApi` wraps the application and is exposed as `window.heuristMap` for direct and same-origin iframe integrations.
8. `MapApplication.initialize()` converts the default MapDocument into a private map environment, initializes the engine, resolves the base map, and applies the initial bookmark.
9. `window.heuristMap.loadMapDocument(recordId)` loads the MapDocument, resolves ordered MapLayer references, loads each source, rebuilds the map environment, renders the layers, and applies the bookmark.

## Class hierarchy and collaboration

```text
HeuristMapPublicApi
    delegates to
MapApplication
    ├── HostAdapter
    │     └── StandaloneHostAdapter
    ├── MapEngineAdapter
    │     └── LeafletMapAdapter
    ├── MapDocumentProvider
    │     └── HeuristApiClient
    ├── MapLayerProvider
    │     └── HeuristApiClient
    ├── QueryGeoDataProvider
    │     └── HeuristApiClient
    └── LayerLoaderRegistry
          ├── GeoJsonLayerLoader
          ├── RemoteGeoJsonLayerLoader
          └── TileLayerLoader
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
