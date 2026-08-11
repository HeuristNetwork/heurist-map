# Heurist Map configuration

This document describes how `heurist-map` is initialised and configured in the main Heurist interface, the Website Editor, standalone use, and published maps.

The design separates three concepts:

1. **`heuristMapBootstrap`** — environment-specific information required to start one map instance.
2. **Heurist configuration** (`heurist-map-settings`) — portable user-editable map settings.
3. **Map state** — the current reproducible state of a particular map view.

The separation is intentional. Database/API connection details must not leak into portable preferences or website configuration, while current extent/query/selection should not become permanent user preferences.

## 1. `heuristMapBootstrap`

`heuristMapBootstrap` is the launch envelope for one `heurist-map` instance:

```javascript
{
  runtime: {
    viewerMode: "map",                 // "map" | "configuration"
    configurationMode: "preferences", // preferences | website | publish

    database: "my_database",
    apiBaseUrl: "/heurist/api",
    baseUrl: "/heurist/",

    accessToken: null,
    requestHeaders: {}
  },

  settings: {
    format: "heurist-map-settings",
    version: 1,
    options: { /* see section 2 */ },
    config: { /* see section 2 */ }
  },

  state: null
}
```

Only `runtime`, `settings`, and `state` belong to the bootstrap contract.

### 1.1 `runtime`

`runtime` contains environment-specific launch information. It is not persisted as map configuration.

For normal map mode the important properties are:

| Property | Purpose |
|---|---|
| `database` | Heurist database name. |
| `apiBaseUrl` | Base URL of the public Heurist API, for example `/heurist/api`. |
| `baseUrl` | Heurist application root used by internal `FrontController` operations such as preferences and publishing. If omitted, the standalone host adapter is used. |
| `accessToken` | Optional API access token. |
| `requestHeaders` | Optional additional public-API request headers. |

`viewerMode` and `configurationMode` are needed when the same bundle is used as the lightweight configuration editor.

The following are deliberately **not** runtime properties:

- MapDocument availability/defaults;
- basemap availability/default;
- Map Control/UI settings;
- dynamic/current-results document settings;
- global map/layer defaults;
- a direct `mapDocument` object;
- custom basemap definitions.

Those concerns are either persisted configuration or internal application behaviour.

### 1.2 Built-in application behaviour

The current application uses:

- container ID `heurist-map`;
- Leaflet as the map engine;
- the built-in basemap catalog;
- automatic loading of the configured MapDocument list.

These are implementation details rather than bootstrap options.

The built-in basemap catalog currently contains `OpenStreetMap` and `None`. `settings.options.baseMaps` can restrict this catalog and choose the initial basemap, but the bootstrap does not provide an alternative catalog.

### 1.3 `settings` is optional

`heuristMapBootstrap.settings` may be omitted. `heurist-map` then uses the canonical defaults defined by the configuration schema.

Therefore this is a valid minimal standalone bootstrap:

```javascript
window.heuristMapBootstrap = {
  runtime: {
    database: "my_database",
    apiBaseUrl: "/heurist/api",
    baseUrl: "/heurist/"
  }
};
```

`baseUrl` may also be omitted when preference/publish operations through the Heurist host are not required.

### 1.4 `state`

`state` is optional and represents a reproducible current map view rather than permanent behaviour. The current implementation can restore values such as:

```javascript
{
  extent: { west, south, east, north },
  zoom: 10,
  activeDocumentId: 123,
  baseMap: "OpenStreetMap",
  visibleLayerIds: ["layer-1", "layer-2"],
  activeLayerId: "current-results",
  query: "t:10",
  selection: [101, 102]
}
```

Normal user preferences usually do not include state. Published maps include it so a publication can reproduce the map that was published.

## 2. Heurist configuration (`heurist-map-settings`)

Portable configuration is stored in the following versioned envelope:

```javascript
{
  format: "heurist-map-settings",
  version: 1,

  options: {
    ui: {
      enabled: true,
      placement: "overlay",
      position: "top-right",
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
    },

    mapDocuments: {
      allowed: null,
      initiallyActive: null
    },

    baseMaps: {
      allowed: null,
      initial: null
    },

    interaction: {
      selectionEnabled: true,
      popupEnabled: true,
      zoomOnSelection: false
    }
  },

  config: {
    defaults: {
      zoomToPointInKM: null,
      symbology: null,
      selectSymbology: null,
      preventContinuousWorldBasemap: false,
      markerClustering: false,
      maxAllowedFeatures: 1000,
      popupTemplate: null
    },

    dynamicDocument: {
      enabled: true,
      title: "Current results",
      minZoom: null,
      maxZoom: null,
      minimumZoomKm: null,
      maximumZoomKm: null,
      bounds: null,
      dynamicRequests: false
    }
  }
}
```

The schema is an allowlist. Unknown properties, obsolete configuration properties, and runtime fields are discarded during normalization and serialization.

### 2.1 `options`

`options` controls viewer behaviour and UI capabilities:

- Map Control visibility;
- allowed/default MapDocuments;
- allowed/default basemaps from the built-in catalog;
- global interaction policy.

`mapDocuments.allowed === null` means all MapDocuments are available.

`mapDocuments.initiallyActive === null` means the dynamic **Current Results Map** is the default document when it is enabled. If it is disabled, the first available persisted MapDocument is used.

`baseMaps.allowed === null` means the complete built-in basemap catalog is available.

`options.interaction` is global policy, not a set of fallback values. For example, `selectionEnabled: false` disables selection even when a particular layer is selectable, and `popupEnabled: false` disables popups globally.

### 2.2 `config.defaults`

`config.defaults` contains global fallback values used when a MapDocument or MapLayer does not define the corresponding value itself.

The precedence is:

```text
built-in application default
    ↓
config.defaults
    ↓
specific MapDocument / MapLayer value
```

The current global defaults are:

| Property | Applies to | Rule |
|---|---|---|
| `zoomToPointInKM` | MapDocument/view | Used when the active MapDocument does not define `zoomToPointInKM`. |
| `symbology` | MapLayer | Used when the layer does not define `style.symbol` (including the base symbol for thematic layers). |
| `selectSymbology` | MapLayer selection | Used when the layer does not define `style.selectSymbol` / `style.selectSymbology`. |
| `preventContinuousWorldBasemap` | Map viewer | Applied to built-in tile basemaps globally (`noWrap`). |
| `markerClustering` | MapLayer options | Inherited when the layer omits the option. When enabled, point features are grouped with Leaflet.markercluster; line and polygon features remain unclustered. |
| `maxAllowedFeatures` | Query MapLayer | Inherited when omitted and used as the query source limit. Allowed values are 500, 1000, 2000, and 5000. |
| `popupTemplate` | GeoJSON MapLayer | Inherited when omitted. Templates support escaped `{{property}}` placeholders; `{{heurist.recordId}}` addresses Heurist metadata. |

Fallback values are applied with nullish semantics: explicit `false` and `0` values are not replaced by defaults.

### 2.3 `config.dynamicDocument`

`config.dynamicDocument` contains only properties specific to the internal dynamic **Current Results Map**:

- `enabled`;
- `title`;
- native `minZoom` / `maxZoom`;
- kilometre `minimumZoomKm` / `maximumZoomKm`;
- `bounds`;
- `dynamicRequests` (**Load by map extent**).

The document has no separate `initiallyActive` flag. Startup activation is controlled only by `options.mapDocuments.initiallyActive`.

The `current-results` layer also has no separate persisted configuration object. It is an internal layer with fixed ID `current-results`, initially visible and selectable. When `config.dynamicDocument.dynamicRequests` is enabled, this layer is loaded by the current map extent. Other MapLayers do not inherit this setting; they must explicitly define `options.dynamicRequests: true` if they are to use extent-based loading.

## 3. Why bootstrap and configuration differ

They have different lifetimes and portability requirements.

`heuristMapBootstrap` describes **one concrete launch**. It may therefore contain the database name, API URL, Heurist root URL, authentication transport, portable settings, and optional state.

The stored Heurist configuration describes **portable map behaviour**. It must be safe to store in user preferences, a website definition, or a publish JSON file without carrying database URLs, credentials, host objects, or callbacks.

In short:

```text
heuristMapBootstrap
    = runtime environment
    + optional portable configuration
    + optional state

heurist-map-settings
    = portable options
    + portable config
```

The configuration is therefore one optional part of the bootstrap, not an alternative bootstrap format.

## 4. Standalone `heurist-map` initialisation

A standalone page defines `window.heuristMapBootstrap` before loading the bundle.

Minimal example using default map configuration:

```html
<div id="heurist-map"></div>

<script>
window.heuristMapBootstrap = {
  runtime: {
    database: "my_database",
    apiBaseUrl: "https://example.org/heurist/api",
    baseUrl: "https://example.org/heurist/"
  }
};
</script>

<script type="module" src="/heurist/external/heurist-map/heurist-map.js"></script>
```

Example with explicit configuration and initial state:

```javascript
window.heuristMapBootstrap = {
  runtime: {
    database: "my_database",
    apiBaseUrl: "https://example.org/heurist/api",
    baseUrl: "https://example.org/heurist/"
  },
  settings: {
    format: "heurist-map-settings",
    version: 1,
    options: {
      ui: { initiallyExpanded: false },
      mapDocuments: { allowed: [12, 14], initiallyActive: 14 },
      baseMaps: { allowed: ["OpenStreetMap", "None"], initial: "OpenStreetMap" }
    },
    config: {
      defaults: { maxAllowedFeatures: 2000 }
    }
  },
  state: {
    activeDocumentId: 14
  }
};
```

The optional URL parameter `?doc=12,14` can be used as a standalone MapDocument filter when `settings.options.mapDocuments.allowed` is not specified. Persisted `mapDocuments.allowed` takes precedence.

## 5. Main Heurist iframe integration

When `heurist-map` runs inside `mapViewer`, the wrapper owns the bootstrap for the lifetime of the widget.

The same-origin iframe reads it directly from the iframe DOM element:

```javascript
window.frameElement.heuristMapHost.getConfiguration()
```

The bridge is owned by the parent iframe element, so iframe navigation/reload does not lose database/API information or current settings.

`mapViewer` constructs the effective settings once:

```text
user preference "heurist-map"
        ↓
explicit mapViewer heuristMapSettings
```

Explicit widget settings override user preferences. `getHeuristMapConfig()` does not perform a second competing settings merge.

## 6. Configuration dialog

`MapConfigurationDialog` is a reusable editor with three modes:

| Mode | Primary action | Purpose |
|---|---|---|
| `preferences` | **Apply** | Save the user's normal map preferences and apply compatible changes to the current map. |
| `website` | **Save** | Return configuration to the Website Editor for storage with the page/widget. |
| `publish` | **Publish** | Store portable configuration together with the current map state. |

All three modes edit the same `heurist-map-settings` schema. The mode changes the surrounding workflow, not the configuration format.

### 6.1 Advanced settings

The dialog opens with **Advanced settings** disabled.

With Advanced settings disabled:

- the **Map documents**, **Base maps**, and **Interaction** sections are hidden;
- Current Results Map extent and all of its zoom controls are hidden;
- popup template, **Load by map extent**, selection symbology, continuous-world control, Map Control CSS, and other specialist settings are hidden.

Advanced mode only changes form visibility. It does not define another JSON format.

## 7. Preferences

Preferences are user-specific configuration stored under the user preference key:

```text
heurist-map
```

They are defined through the Map configuration dialog in the main Heurist map UI / Map tab.

`mapViewer` reads the already-loaded preference with:

```javascript
window.hWin.HAPI4.get_prefs('heurist-map')
```

and places the effective value in `heuristMapBootstrap.settings`.

When **Apply** is pressed:

1. the `heurist-map` preference is saved;
2. `applyConfiguration()` applies safe live changes without rebuilding the whole Leaflet application;
3. current document/view/query/selection are retained where possible;
4. the parent-owned bootstrap is updated so an iframe reload receives the newly saved settings.

Startup choices such as Default document are stored for the next initialisation and do not unexpectedly switch the current map during Apply.

These preferences affect `heurist-map` in the **main Heurist UI**.

## 8. Website configuration

Website mode is used by the Heurist Website Editor:

```javascript
viewerMode: "configuration"
configurationMode: "website"
```

This is a lightweight configuration-only mode. It creates the configuration API/dialog but does **not** initialise `MapApplication`, Leaflet, basemaps, MapDocuments, or map data.

When **Save** is pressed, the serialized `heurist-map-settings` value is returned to the Website Editor. The Website Editor stores it with the page/widget.

Website configuration affects the `heurist-map` shown in the **user's website**. It is independent of the user's normal `heurist-map` preference.

## 9. Publish configuration

Publish mode is opened from the **Publish** control in a running map.

When **Publish** is pressed, the stored publish JSON contains portable settings plus current state:

```javascript
{
  format: "heurist-map-publish",
  version: 1,
  options: { /* settings.options */ },
  config: { /* settings.config */ },
  state: { /* captured current map state */ }
}
```

The publish JSON deliberately does **not** persist runtime information such as database/API/base URLs. The generated published page supplies the runtime launch environment separately and combines it with the published settings/state.

The generated standalone page converts the stored publish JSON into the normal bootstrap contract before loading the bundle:

```javascript
window.heuristMapBootstrap = {
  runtime: {
    database: "my_database",
    apiBaseUrl: "/heurist/api",
    baseUrl: "/heurist/"
  },
  settings: {
    format: "heurist-map-settings",
    version: 1,
    options: { /* stored publish options */ },
    config: { /* stored publish config */ }
  },
  state: { /* stored publish state */ }
};
```

There is no separate `window.heuristMapPublished` startup path.

After successful publishing, the configuration dialog closes and a small **Published map** dialog shows the public link with **Copy link**, **Open**, and **Close** actions.

## 10. Configuration ownership and precedence

| Context | Stored value | Owner | Affects |
|---|---|---|---|
| Main Heurist preferences | `heurist-map-settings` | User preference `heurist-map` | Main Heurist map viewer |
| Website | `heurist-map-settings` | Website/page/widget definition | Map embedded in a user's website |
| Publish | `heurist-map-publish` = settings + state | Published-map JSON | Standalone published map |
| Bootstrap | `{runtime, settings, state}` | Current host/application instance | One concrete map startup |

For the main Heurist viewer the settings precedence is:

```text
canonical defaults
    ↓
user preferences
    ↓
explicit mapViewer/website settings
```

Canonical defaults are applied by the configuration normalizer. They do not need to be copied into `heuristMapBootstrap` when no custom settings are required.

Published state is restored after map initialisation; it is not another layer of general preferences.

## 11. Loading by extent

**Loading by extent** is intended for large Heurist query layers where loading the complete result set at once would be slow or unnecessarily expensive. Instead of requesting every matching record, `heurist-map` requests only records whose geographic values intersect the current map view.

For the internal **Current Results Map**, this behaviour is enabled with:

```javascript
config: {
  dynamicDocument: {
    dynamicRequests: true
  }
}
```

The configuration dialog exposes this option as **Load by map extent** under **Current Results Map**. It is not a global MapLayer default. Persisted or runtime-added MapLayers use the same mechanism only when the individual layer explicitly defines:

```javascript
options: {
  dynamicRequests: true
}
```

### 11.1 Viewport query

The original layer query is retained unchanged. For each extent request, `heurist-map` creates a temporary effective query by adding the current map bounds.

For the preferred JSON Heurist query format, the added predicate is:

```javascript
{
  geo: {
    west: -16,
    south: 32,
    east: 40,
    north: 72
  }
}
```

For the legacy plain-text query format, the equivalent predicate is appended as:

```text
geo:"-16,32,40,72"
```

Viewport coordinates are normalized before the request. Longitude (`west` / `east`) is limited to `-180 .. 180`, and latitude (`south` / `north`) is limited to `-90 .. 90`.

The server interprets the extent as an intersection query. This is important for lines and polygons: a feature is eligible when it intersects the visible map extent; it does not have to be completely contained by it. Existing WKT `geo` queries retain their historical behaviour.

### 11.2 One active extent-loaded layer per MapDocument

A MapDocument may define more than one layer with `dynamicRequests: true`, for example to provide different datasets at different zoom levels. However, **only one dynamic layer is allowed to issue extent requests for a MapDocument at any one zoom level**. This prevents one pan or zoom operation from starting several expensive server queries.

Dynamic layers should therefore normally have non-overlapping effective zoom ranges, for example:

```text
Overview layer     zoom 0-8
Places layer       zoom 9-12
Detailed layer     zoom 13-18
```

A layer participates in extent loading only when all of the following are true:

- its source is a Heurist query;
- `dynamicRequests` is `true`;
- the layer is visible;
- the current map zoom is within the layer's effective zoom range.

If more than one dynamic layer is eligible because their zoom ranges overlap, `heurist-map` selects only the highest-priority/topmost eligible layer. The other layers do not issue requests. A warning is emitted for the configuration overlap so it can be corrected.

A dynamic layer outside its zoom range remains configured but does not load data until its range becomes active. Moving into another dynamic layer's zoom range switches the active dynamic layer and removes the superseded runtime layer from the map.

### 11.3 Refresh, debounce, and superseding requests

Extent-loaded layers refresh after the map view changes. `heurist-map` listens to the map `moveend` event, which also covers the end of a zoom operation.

Refreshes are debounced so intermediate pan/zoom movements do not immediately create server requests. The current implementation waits briefly after movement before issuing the request.

If a newer viewport request becomes necessary while an earlier request is still in progress:

1. the previous browser request is aborted with `AbortController`;
2. the newer viewport request supersedes it;
3. an aborted/superseded request is treated as normal internal control flow, not as a user-visible map error;
4. the cancellation may be logged to the developer console for diagnostics.

Aborting the browser request prevents a stale response from being applied to the map. It does not guarantee that a MySQL query already executing on the server is immediately cancelled, which is why debounce and the one-active-dynamic-layer rule are also important.

`heurist-map` also avoids issuing another request when the effective zoom and viewport bounds have not changed.

### 11.4 Result limits and partial loading

Extent requests continue to respect the effective query feature/record limit, including `maxAllowedFeatures`. A viewport may therefore still contain more matching records than the configured request limit.

The map API response includes result metadata such as:

```javascript
meta: {
  totalRecords,
  returnedRecords,
  returnedFeatures,
  offset,
  limit,
  isPartial
}
```

When `isPartial` is `true`, the Map Control reports that only part of the result has been loaded. For the `current-results` layer, the row label itself reports the number of loaded features and explains the partial result; the full text is also available as the row title when the visible label is truncated.

`returnedRecords` and `returnedFeatures` are deliberately separate. Some matching records have no geometry, while one record may produce more than one feature. Pagination and result-limit logic therefore must not assume that the number of returned features is the same as the number of processed records.

### 11.5 Selection during extent refresh

When the same dynamic layer is refreshed for a new viewport, selected record IDs are reapplied where those records are still present in the returned data. If a zoom-range change activates a different dynamic layer, selection belonging to the previous dynamic layer is cleared.

This keeps selection stable where possible without retaining selections for features that are no longer part of the active viewport layer.

## 12. Design rules

When extending configuration, keep these rules:

1. **Keep runtime small.** Only environment-specific launch values belong in `bootstrap.runtime`.
2. **Do not duplicate persisted settings in runtime.** MapDocuments, basemap selection, UI, interaction, global defaults, and dynamic-document configuration belong in `heurist-map-settings` only.
3. **Use the built-in basemap catalog.** Persist only which built-in basemaps are allowed and which one is initial.
4. **Do not put a MapDocument in the bootstrap.** Persisted documents are loaded through the API; the Current Results Map is defined by `settings.config.dynamicDocument`.
5. **Missing settings mean defaults.** `bootstrap.settings` is optional.
6. **Merge configuration once.** The host resolves preference/widget precedence; `heurist-map` normalizes the result but does not repeat the merge.
7. **Use state for reproducibility.** Extent, active document/layer, query, and selection belong to state when they need to be restored.
8. **Keep configuration-only mode lightweight.** Website configuration must not create a map engine.


### Marker clustering

`markerClustering` enables Leaflet.markercluster for GeoJSON point features. It can be set globally in `config.defaults.markerClustering` or explicitly in a MapLayer `options.markerClustering`. The layer option takes precedence over the global default.

When enabled:

- point features are grouped into clusters as the map is zoomed out;
- clicking a cluster zooms to its contents using the plugin default behaviour;
- overlapping markers can spiderfy at maximum zoom;
- line and polygon features in the same GeoJSON layer remain normal Leaflet paths;
- bulk marker insertion uses `chunkedLoading` to reduce long UI blocking for large result sets;
- clustering works with both normal and extent-loaded query layers because it is applied after GeoJSON retrieval.

The setting affects presentation only. It does not alter the Heurist query, result limit, partial-result metadata, or dynamic-request rules.

