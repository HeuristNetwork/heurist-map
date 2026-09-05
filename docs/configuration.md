# Heurist Map configuration

This document describes how `heurist-map` is configured in the main Heurist interface, in websites, in standalone use, and for published maps.

The configuration model deliberately separates three concepts:

1. **Bootstrap** — everything required to start one map application instance.
2. **Configuration/settings** — portable user-editable map behaviour and presentation settings.
3. **State** — the reproducible current map state, such as active document, extent, query, and selection.

Keeping these concepts separate avoids mixing database/API connection details with settings that may be saved in user preferences, a website page, or a published-module JSON file.

## 1. `heuristModuleBootstrap`

`heuristModuleBootstrap` is the complete input used to initialise one `heurist-map` instance.

```javascript
{
  runtime: {
    viewerMode: "map",                // "map" | "configuration" | "draw"
    configurationMode: "preferences", // "preferences" | "website" | "publish"
    runtimeMode: "main",              // "main" | "website" | "standalone"
    readonly: false,
    database: "my_database",
    apiBaseUrl: "/heurist/api",
    baseUrl: "/heurist/",
    accessToken: null,
    requestHeaders: {},
    baseMapProviderOptions: {}
  },

  settings: {
    format: "heurist-map-settings",
    version: 1,
    options: { /* see below */ },
    config: { /* see below */ }
  },

  state: null
}
```

### `runtime`

`runtime` contains values required by the running application but which must **not** be stored as normal map preferences. Typical examples are:

- database name;
- public API URL;
- Heurist root URL (`baseUrl`) when host services such as preferences, publishing, popup templates, or record editing are available;
- access token and request headers;
- viewer/configuration mode;
- provider-specific basemap credentials/options.

Runtime values are environment-specific. For example, a user preference should not permanently store the database URL or an authentication token.

### 1.1 `viewerMode`, `configurationMode`, and `runtimeMode`

These properties describe different axes and must not be used interchangeably.

| Property | Values | Meaning |
| --- | --- | --- |
| `viewerMode` | `map`, `configuration`, `draw` | What this application instance does. `map` starts the viewer; `configuration` starts only the configuration API/dialog without Leaflet or `MapApplication`; `draw` starts an isolated drawing workspace. |
| `configurationMode` | `preferences`, `website`, `publish` | Configuration-dialog policy: title, available controls, forced restrictions, save semantics, and publishing options. It does not identify the deployment environment. |
| `runtimeMode` | `main`, `website`, `standalone` | Host context. `main` is the authenticated Heurist client; `website` is a Heurist website page; `standalone` is a published or independent map. It is runtime-only and is never persisted in `heurist-map-settings`. |

If `runtimeMode` is omitted, `HeuristModuleMap` infers `website` from `configurationMode: "website"`, `standalone` from `configurationMode: "publish"`, and `main` otherwise.

| Use | `viewerMode` | `configurationMode` | `runtimeMode` |
| --- | --- | --- | --- |
| Main-client map | `map` | `preferences` | `main` |
| User preferences | `configuration` | `preferences` | `main` |
| Website editor | `configuration` | `website` | `website` |
| Website map | `map` | `website` | `website` |
| Publish dialog | `configuration` | `publish` | `main` |
| Publication | `map` | `publish` | `standalone` |
| Geometry/BBOX editor | `draw` | normally `preferences` | normally `main` |

### `settings`

`settings` contains the portable, persisted Heurist map configuration described in the next section.

### `state`

`state` is optional. It describes a reproducible map state rather than general behaviour. The current implementation can store values such as:

```javascript
{
  extent: { west, south, east, north },
  zoom: 10,
  activeDocumentId: 123,
  baseMap: "OpenStreetMap",
  visibleLayerIds: [1234, "current-results"],
  layerOpacities: {
    "1234": 0.65,
    "current-results": 1
  },
  activeThemes: {
    "1234": -1,
    "current-results": 0
  },
  activeLayerId: null,
  query: "t:10",
  selection: [101, 102]
}
```

User preferences normally do not require state. Publications include state so that the published link can reproduce the map as it appeared when it was published.

## 2. Persisted Heurist map configuration

The portable configuration stored in preferences or a website is a versioned settings envelope:

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
      showHomeControl: false,
      showOptions: true,
      showPublish: true,
      showSourceHeader: false,
      controlCss: null
    },

    nativeControls: {
      zoom: true,
      scale: true,
      bookmark: false,
      print: false,
      selector: false,
      search: false
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
      markerClusterGridPixels: 20,
      markerClusterMaxLevel: 12,
      maxAllowedFeatures: 1000,
      popupTemplate: null
    },

    dynamicDocument: {
      enabled: true,
      title: "Filtered Result",
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

In code this object is commonly passed as `heuristMapSettings`. In this document, **Heurist map configuration** means this persisted `heurist-map-settings` envelope.

The schema is an allowlist. Unknown fields and runtime fields are discarded during normalization/serialization.

### `options`

`options` controls viewer behaviour and user-interface capabilities.

`options.ui` controls the **Heurist Map Controls** panel:

- `enabled` — show/hide the Heurist control panel as a whole;
- `initiallyExpanded` — initial expanded/collapsed state;
- `showCurrentDocument` — Filtered Result entry;
- `showMapDocuments` — Map documents section;
- `showLayers` — Layers section;
- `showBaseMaps` — Base maps section;
- `showLegend` — Legend;
- `showHomeControl` — Home tool;
- `showOptions` — Options tool;
- `showPublish` — Publish tool;
- `showSourceHeader` — header shown above the map container with the active MapDocument's title (the Filtered Result's configured title when the dynamic document is active).

`options.nativeControls` controls Leaflet/native map tools independently:

- `zoom` — Leaflet zoom buttons;
- `scale` — Leaflet scale;
- `bookmark` — Leaflet.Bookmarks;
- `print` — leaflet.browser.print;
- `selector` — reserved for the future area-selection tool and currently disabled;
- `search` — leaflet-control-geocoder.

The remaining `options` properties control available/default MapDocuments, available/default basemaps, and interaction behaviour.

`mapDocuments.initiallyActive === null` means the dynamic **Filtered Result** document is the default document.

### `config`

`config.defaults` contains defaults shared by map content where the individual MapDocument/MapLayer does not provide a value, including symbology, selection symbology, marker clustering, feature limits, popup template, and continuous-world behaviour.

`markerClusterMaxLevel` is the highest Leaflet zoom level at which a marker may belong to a cluster. Its default is `12`; above it, markers are displayed individually. `markerClusterGridPixels` remains the clustering radius in screen pixels.

### Where defaults are defined

| Defaults | Authoritative location |
| --- | --- |
| Persisted `options` and `config` defaults | `heurist-map/src/ui/config/mapConfigurationDefaults.js` (`HEURIST_MAP_OPTIONS_DEFAULTS`, `HEURIST_MAP_CONFIG_DEFAULTS`) |
| Persisted allowlist, validation, migration and serialization | `heurist-map/src/ui/config/mapConfigurationSchema.js` |
| Built-in basemaps | `heurist-map/src/basemaps/defaultBasemaps.js` |
| Complete built-in marker symbol | `heurist-map/src/utils/normalizeMapSymbol.js` (`DEFAULT_MAP_SYMBOL`) |
| Runtime-only mechanics and bootstrap fallbacks | `heurist-map/src/mapConfig.js` |
| Main-Heurist wrapper defaults | `heurist/hclient/modules/map/HeuristModuleMap.js` (`HEURIST_MODULE_MAP_DEFAULTS`) |
| Website/draw overrides | `HeuristModuleMap._websiteMapDefaults()` and `_drawMapDefaults()` |

Only values defined by the map defaults and accepted by `mapConfigurationSchema.js` are persisted. Runtime connection values and host callbacks never belong in the settings envelope.

Vector symbology uses sparse inheritance: built-in `DEFAULT_MAP_SYMBOL` → configured default symbology → MapLayer symbol → thematic renderer symbol → thematic range/facet symbol. Missing properties are resolved from the effective parent at runtime. Opacity values are canonical fractions in the range `0..1`; legacy percentages are accepted only when normalizing incoming data. `iconSize` is the semantic marker diameter and Leaflet circle `radius` is derived as `iconSize / 2`.

`config.dynamicDocument` controls the dynamic **Filtered Result** MapDocument, including its title, zoom restrictions, optional bounds, and `dynamicRequests` (Load by map extent).

### Temporary legacy symbology compatibility

While the old and new mapping systems coexist, the Heurist host adapter can use the existing user preferences:

```text
map_default_style -> config.defaults.symbology
map_select_style  -> config.defaults.selectSymbology
```

This is a runtime compatibility bridge only. An explicit `heurist-map` value takes precedence, and legacy values are not copied into the persisted `heurist-map-settings` object. This keeps existing projects visually consistent while allowing the new configuration format to become authoritative over time.

## 3. Why bootstrap and persisted configuration are different

The structures differ intentionally.

A persisted configuration must be portable and safe. It can be copied between user preferences, website settings, and publishing without carrying authentication or server-specific details.

`heuristModuleBootstrap`, on the other hand, represents one concrete application launch. It therefore combines:

```text
runtime environment
+ persisted settings
+ optional map state
```

The persisted configuration is therefore **part of** the bootstrap, not an alternative bootstrap format.

This also prevents configuration precedence from being evaluated in multiple places. The wrapper/host prepares the effective persisted settings before startup. The only current compatibility exception is the temporary legacy default/selection symbology bridge described above; it fills missing runtime defaults without modifying persisted settings.

## 4. Standalone `heurist-map` initialisation

A standalone application defines `window.heuristModuleBootstrap` before loading the `heurist-map` bundle.

Example:

```html
<div id="heurist-map"></div>

<script>
window.heuristModuleBootstrap = {
  runtime: {
    viewerMode: "map",
    database: "my_database",
    apiBaseUrl: "https://example.org/heurist/api",
    baseUrl: null
  },

  settings: {
    format: "heurist-map-settings",
    version: 1,
    options: {
      ui: {
        initiallyExpanded: true,
        showMapDocuments: true,
        showBaseMaps: true
      }
    },
    config: {
      defaults: {
        maxAllowedFeatures: 1000
      }
    }
  },

  state: null
};
</script>

<script type="module" src="/heurist/hclient/bundles/heurist-map/heurist-map.js"></script>
```

The map container ID is currently the internal constant `heurist-map`.

Missing persisted settings are filled from the canonical defaults by the configuration normalizer.

The old mixed `window.heuristMapOptions` startup object is **not supported**. Runtime parameters and persisted map settings must not be mixed together.

### Main Heurist iframe integration

When `heurist-map` runs inside `mapViewer`, the wrapper owns the bootstrap for the lifetime of the widget. The same-origin iframe reads it through:

```javascript
window.frameElement.heuristMapHost.getConfiguration()
```

The bridge is attached to the iframe DOM element, so it remains available after iframe navigation/reload. A reload therefore receives the current database/API information and the latest map settings without a registry or `postMessage` protocol.

For the main Heurist UI, `mapViewer` builds effective settings in this order:

```text
user preference "heurist-map"
        ↓ overridden by
explicit mapViewer heuristMapSettings
        ↓ overridden by (configuration-only editor only)
configurationValue
```

`heurist-map` does not repeat this persisted-settings merge.

## 5. Configuration dialog

`MapConfigurationDialog` is one reusable editor with three modes:

- `preferences`
- `website`
- `publish`

All modes edit the same allowlisted `heurist-map-settings` configuration. The mode determines the surrounding workflow and the primary action label.

| Mode | Primary action | Purpose |
|---|---|---|
| `preferences` | **Apply** | Save/return the user's normal map preferences. |
| `website` | **Save** | Return configuration to the Website Editor, which stores it with the web page/widget. |
| `publish` | **Publish** | Save portable settings together with current map state as a published map. |

### Advanced settings

The dialog opens with **Advanced settings** disabled in normal configuration modes. This keeps the normal form small while retaining more specialized controls. Publish mode intentionally presents its reduced publishing form rather than the normal Advanced settings switch.

Advanced mode changes only what the dialog displays; it does not define a different JSON format. Advanced and non-advanced settings are stored in the same configuration schema.

## 6. Preferences mode

Preferences are user-specific settings stored under the preference key:

```text
heurist-map
```

In the main Heurist Preferences dialog, `mapViewer` is started in lightweight configuration-only mode and returns the serialized settings to the Preferences widget, which saves them. In a running `heurist-map`, the same configuration dialog can also be opened through the map Options control.

`mapViewer` reads the already-loaded preference with:

```javascript
window.hWin.HAPI4.get_prefs('heurist-map')
```

and includes it in the bootstrap settings supplied to `heurist-map`.

The parent-owned iframe bridge is updated when settings change, so an iframe reload receives the current configuration.

## 7. Website mode

Website mode is intended for the Heurist Website Editor.

The viewer is opened with:

```javascript
viewerMode: "configuration"
configurationMode: "website"
```

This is a lightweight configuration-only bootstrap. It creates the configuration API/dialog but does **not** initialise `MapApplication`, Leaflet, basemaps, MapDocuments, or map data.

When the user presses **Save**, the serialized `heurist-map-settings` value is returned to the Website Editor. The Website Editor is responsible for storing that value with the web page/widget.

At page-render time the website creates `mapViewer` (or another compatible bootstrap host) with that stored configuration. Website configuration does not alter the user's general `heurist-map` preference.

## 8. Publish mode

Publish mode is opened from the **Publish** control in a running `heurist-map`.

The user can adjust the map configuration before publishing. Publish mode starts from the current settings but forces conservative standalone defaults for controls:

```javascript
options.ui.showOptions = false;
options.ui.showPublish = false;

options.nativeControls = {
  zoom: true,
  scale: true,
  bookmark: false,
  print: false,
  selector: false,
  search: false
};
```

When **Publish** is pressed, `heurist-map` stores a publish envelope containing the portable configuration plus, when requested, the current reproducible state:

```javascript
{
  format: "heurist-publication",
  version: 1,
  options: { /* serialized settings.options */ },
  config: { /* serialized settings.config */ },
  state: { /* captured map state, or null */ }
}
```

The published JSON deliberately includes `state` when **Preserve current state** is enabled, because the published map must reproduce the selected document, visible layers, opacity, active thematic symbology, basemap, extent, query, and selection.

After a successful publish, the configuration dialog closes and a small **Publication** dialog displays the public link with **Copy link**, **Open**, and **Close** actions.

The server-side publish allowlist must preserve the complete current `options.ui` and `options.nativeControls` sections. Dropping one of these fields changes the published map because missing fields are interpreted as canonical defaults.

The generated standalone page converts the stored publish document directly to the canonical bootstrap contract:

```javascript
window.heuristModuleBootstrap = {
  runtime: {
    database: "my_database",
    baseUrl: "/heurist/",
    apiBaseUrl: "/heurist/api"
  },
  settings: {
    format: "heurist-map-settings",
    version: 1,
    options: published.options,
    config: published.config
  },
  state: published.state
};
```

There is no secondary published-module bootstrap format to normalize inside `heurist-map`.

## 9. Configuration ownership summary

| Context | Stored value | Owner | Affects |
|---|---|---|---|
| Main Heurist preferences | `heurist-map-settings` | User preferences (`heurist-map` key) | Main Heurist map viewer |
| Website | `heurist-map-settings` | Website/page/widget definition | Map embedded in the user's website |
| Publish | `heurist-publication` = settings + optional state | Published-map JSON | Standalone published map |
| Bootstrap | `{runtime, settings, state}` | Current host/application instance | One concrete `heurist-map` startup |

## 10. Design rules

The following rules should be kept when extending map configuration:

1. **Do not put runtime connection values into persisted settings.** Database, API URLs, tokens, request headers, callbacks, and host objects belong to `bootstrap.runtime`.
2. **Add user-editable persisted properties to the configuration schema/defaults.** This keeps normalization and server-side publishing allowlists predictable.
3. **Merge persisted configuration once.** The host resolves preference/widget precedence before `heurist-map` starts. Compatibility fallbacks may fill missing runtime defaults but must not silently rewrite persisted settings.
4. **Use state for reproducibility, not preferences.** Current extent, active layer/document, query, selection, active theme, and runtime opacity belong to state when they need to be restored.
5. **Configuration-only mode must remain lightweight.** Website/preferences configuration should not create or reinitialise the map engine.
6. **Keep public server contracts explicit.** A new MapDocument/MapLayer/configuration property must be added consistently to server output, client normalization, configuration allowlists when applicable, publishing allowlists, and documentation.

See also [`architecture.md`](architecture.md) for client architecture and [`integration.md`](integration.md) for Heurist integration, repository maintenance, and distribution.
