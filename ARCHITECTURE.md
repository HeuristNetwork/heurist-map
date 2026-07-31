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

## Important deferred popup requirement

Phase 3A currently creates popup HTML and calls Leaflet `bindPopup()` while a GeoJSON layer is added. This is temporary and must not remain in the final implementation.

**Required later change:** popup content and binding must be created lazily only when a feature selection or explicit popup-open request occurs. This is required before large SHP/KML performance testing and before Phase 4 selection is finalized.

## Current phase boundaries

The implementation is read-only. It includes public API integration, MapDocument and MapLayer loading, GeoJSON and tile rendering, simple symbology, normalized feature metadata, basic eager popups, cancellation, and layer inspection.

Editing, timeline integration, selection synchronization, legend UI, SHP/KML/image/tiled-image loaders, thematic mapping, and wrapper widgets belong to later phases.
