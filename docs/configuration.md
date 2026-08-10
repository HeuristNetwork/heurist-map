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
      dynamicRequests: false,
      popupTemplate: null
    },

    dynamicDocument: {
      enabled: true,
      title: "Current results",
      minZoom: null,
      maxZoom: null,
      minimumZoomKm: null,
      maximumZoomKm: null,
      bounds: null
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
| `markerClustering` | MapLayer options | Inherited when the layer omits the option. The current Leaflet adapter does not yet implement clustering. |
| `maxAllowedFeatures` | Query MapLayer | Inherited when omitted and used as the query source limit. Allowed values are 500, 1000, 2000, and 5000. |
| `dynamicRequests` | MapLayer options | Inherited when omitted. Viewport-driven/dynamic request loading is reserved for the large-data implementation. |
| `popupTemplate` | GeoJSON MapLayer | Inherited when omitted. Templates support escaped `{{property}}` placeholders; `{{heurist.recordId}}` addresses Heurist metadata. |

Fallback values are applied with nullish semantics: explicit `false` and `0` values are not replaced by defaults.

### 2.3 `config.dynamicDocument`

`config.dynamicDocument` contains only properties specific to the internal dynamic **Current Results Map**:

- `enabled`;
- `title`;
- native `minZoom` / `maxZoom`;
- kilometre `minimumZoomKm` / `maximumZoomKm`;
- `bounds`.

The document has no separate `initiallyActive` flag. Startup activation is controlled only by `options.mapDocuments.initiallyActive`.

The `current-results` layer also has no separate persisted configuration object. It is an internal layer with fixed ID `current-results`, initially visible and selectable, and it inherits the layer-related values from `config.defaults`.

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
- popup template, dynamic requests, selection symbology, continuous-world control, Map Control CSS, and other specialist settings are hidden.

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

## 11. Design rules

When extending configuration, keep these rules:

1. **Keep runtime small.** Only environment-specific launch values belong in `bootstrap.runtime`.
2. **Do not duplicate persisted settings in runtime.** MapDocuments, basemap selection, UI, interaction, global defaults, and dynamic-document configuration belong in `heurist-map-settings` only.
3. **Use the built-in basemap catalog.** Persist only which built-in basemaps are allowed and which one is initial.
4. **Do not put a MapDocument in the bootstrap.** Persisted documents are loaded through the API; the Current Results Map is defined by `settings.config.dynamicDocument`.
5. **Missing settings mean defaults.** `bootstrap.settings` is optional.
6. **Merge configuration once.** The host resolves preference/widget precedence; `heurist-map` normalizes the result but does not repeat the merge.
7. **Use state for reproducibility.** Extent, active document/layer, query, and selection belong to state when they need to be restored.
8. **Keep configuration-only mode lightweight.** Website configuration must not create a map engine.
