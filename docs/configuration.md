# Heurist Map configuration

This document describes how `heurist-map` is configured in the main Heurist interface, in websites, in standalone use, and for published maps.

The configuration model deliberately separates three concepts:

1. **Bootstrap** — everything required to start one map application instance.
2. **Configuration/settings** — portable user-editable map behaviour and presentation settings.
3. **State** — the reproducible current map state, such as active document, extent, query, and selection.

Keeping these concepts separate avoids mixing database/API connection details with settings that may be saved in user preferences, a website page, or a published-map JSON file.

## 1. `heuristMapBootstrap`

`heuristMapBootstrap` is the complete input used to initialise one `heurist-map` instance.

```javascript
{
  runtime: {
    viewerMode: "map",                 // "map" | "configuration"
    configurationMode: "preferences", // "preferences" | "website" | "publish"
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
- API/server URL;
- access token and request headers;
- Heurist base URL used by the host adapter;
- viewer/configuration mode;
- provider-specific basemap credentials/options.

Runtime values are environment-specific. For example, a user preference should not permanently store the database URL or an authentication token.

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

User preferences normally do not require state. Published maps include state so that the published link can reproduce the map as it appeared when it was published.

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

In code this object is commonly passed as `heuristMapSettings`. In this document, **Heurist map configuration** means this persisted `heurist-map-settings` envelope.

The schema is an allowlist. Unknown fields and runtime fields are discarded during normalization/serialization.

### `options`

`options` controls viewer behaviour and user-interface capabilities.

`options.ui` controls the **Heurist Map Controls** panel:

- `enabled` — show/hide the Heurist control panel as a whole;
- `initiallyExpanded` — initial expanded/collapsed state;
- `showCurrentDocument` — Current results entry;
- `showMapDocuments` — Map documents section;
- `showLayers` — Layers section;
- `showBaseMaps` — Base maps section;
- `showLegend` — Legend;
- `showHomeControl` — Home tool;
- `showOptions` — Options tool;
- `showPublish` — Publish tool.

`options.nativeControls` controls Leaflet/native map tools independently:

- `zoom` — Leaflet zoom buttons;
- `scale` — Leaflet scale;
- `bookmark` — Leaflet.Bookmarks;
- `print` — leaflet.browser.print;
- `selector` — reserved for the future area-selection tool and currently disabled;
- `search` — leaflet-control-geocoder.

The remaining `options` properties control available/default MapDocuments, available/default basemaps, and interaction behaviour.

`mapDocuments.initiallyActive === null` means the dynamic **Current results** document is the default document.

### `config`

`config.defaults` contains defaults shared by map content where the individual MapDocument/MapLayer does not provide a value, including symbology, marker clustering, feature limits, popup template, and continuous-world behaviour.

`config.dynamicDocument` controls the dynamic **Current results** MapDocument, including its title, zoom restrictions, optional bounds, and `dynamicRequests` (Load by map extent).

## 3. Why bootstrap and persisted configuration are different

The structures differ intentionally.

A persisted configuration must be portable and safe. It can be copied between user preferences, website settings, and publishing without carrying authentication or server-specific details.

`heuristMapBootstrap`, on the other hand, represents one concrete application launch. It therefore combines:

```text
runtime environment
+ persisted settings
+ optional map state
+ optional direct MapDocument
```

The persisted configuration is therefore **part of** the bootstrap, not an alternative bootstrap format.

This also prevents configuration precedence from being evaluated in multiple places. The host prepares the effective `settings` once, and `heurist-map` consumes them without rebuilding a competing configuration from runtime fields.

## 4. Standalone `heurist-map` initialisation

A standalone application defines `window.heuristMapBootstrap` before loading the `heurist-map` bundle.

Example:

```html
<div id="heurist-map"></div>

<script>
window.heuristMapBootstrap = {
  runtime: {
    viewerMode: "map",
    containerId: "heurist-map",
    database: "my_database",
    apiBaseUrl: "https://example.org/heurist/api",
    host: null
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

<script type="module" src="/heurist/external/heurist-map/heurist-map.js"></script>
```

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
        ↓
explicit mapViewer heuristMapSettings
```

Explicit widget settings override the corresponding user preferences. `heurist-map` itself does not perform this merge again.

## 5. Configuration dialog

`MapConfigurationDialog` is one reusable editor with three modes:

- `preferences`
- `website`
- `publish`

All modes edit the same allowlisted `heurist-map-settings` configuration. The mode determines the surrounding workflow and the primary action label.

| Mode | Primary action | Purpose |
|---|---|---|
| `preferences` | **Apply** | Save the user's normal map preferences and apply compatible changes to the current map. |
| `website` | **Save** | Return configuration to the Website Editor, which stores it with the web page/widget. |
| `publish` | **Publish** | Save portable settings together with current map state as a published map. |

### Advanced settings

The dialog opens with **Advanced settings** disabled. This keeps the normal form small while retaining more specialized controls.

With Advanced settings disabled, entire sections such as **Map documents**, **Base maps**, and **Interaction** are hidden. Advanced-only individual controls are also hidden, including selected extent, zoom, popup, dynamic-request, selection-symbology, and Map Control CSS settings.

Advanced mode changes only what the dialog displays; it does not define a different JSON format. Advanced and non-advanced settings are stored in the same configuration schema.

## 6. Preferences mode

Preferences are user-specific settings stored under the preference key:

```text
heurist-map
```

They are normally defined through the Map configuration dialog opened from the **Map** tab / Map options in the main Heurist interface.

`mapViewer` reads the already-loaded preference with:

```javascript
window.hWin.HAPI4.get_prefs('heurist-map')
```

and includes it in the bootstrap settings supplied to `heurist-map`.

When the user presses **Apply**:

1. the `heurist-map` preference is saved;
2. `applyConfiguration()` applies compatible changes to the running map without completely reinitialising Leaflet;
3. the current document/view/query/selection are preserved where possible;
4. the parent-owned bootstrap settings are updated, so an iframe reload uses the newly saved settings.

Startup defaults such as the default document are saved for subsequent initialisation; Apply does not force an unexpected document switch in the current map.

These preferences affect `heurist-map` in the **main Heurist UI**.

## 7. Website mode

Website mode is used by the Heurist Website Editor.

The viewer is opened with:

```javascript
viewerMode: "configuration"
configurationMode: "website"
```

This is a lightweight configuration-only bootstrap. It creates the configuration API/dialog but does **not** initialise `MapApplication`, Leaflet, basemaps, MapDocuments, or map data.

When the user presses **Save**, the serialized `heurist-map-settings` value is returned to the Website Editor. The Website Editor is responsible for storing that value with the web page/widget.

Website configuration affects the `heurist-map` instance shown in the **user's website**. It is not saved as the user's general `heurist-map` preference.

## 8. Publish mode

Publish mode is opened from the **Publish** control in a running `heurist-map`.

The user can adjust the map configuration before publishing. When **Publish** is pressed, `heurist-map` stores a publish envelope containing the portable configuration plus the current reproducible state:

```javascript
{
  format: "heurist-map-publish",
  version: 1,
  options: {
    ui: {
      enabled: true,
      showHomeControl: false,
      showOptions: false,
      showPublish: false,
      /* ...other ui fields... */
    },
    nativeControls: {
      zoom: false,
      scale: false,
      bookmark: true,
      print: true,
      selector: false,
      search: true
    },
    /* mapDocuments, baseMaps, interaction */
  },
  config: { /* serialized settings.config */ },
  state: { /* captured map state */ }
}
```

The published JSON deliberately includes `state`, unlike normal preferences, because the published map must reproduce the selected document, visible layers, extent, query, and related map state.

After a successful publish, the configuration dialog closes and a small **Published map** dialog displays the public link with **Copy link**, **Open**, and **Close** actions.

The server-side publish allowlist must preserve the complete current `options.ui` and `options.nativeControls` sections. Dropping one of these fields changes the published map because missing fields are interpreted as canonical defaults.

The generated standalone page converts the stored publish document directly to the canonical bootstrap contract:

```javascript
window.heuristMapBootstrap = {
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

There is no secondary published-map bootstrap format to normalize inside `heurist-map`.

## 9. Configuration ownership summary

| Context | Stored value | Owner | Affects |
|---|---|---|---|
| Main Heurist preferences | `heurist-map-settings` | User preferences (`heurist-map` key) | Main Heurist map viewer |
| Website | `heurist-map-settings` | Website/page/widget definition | Map embedded in the user's website |
| Publish | `heurist-map-publish` = settings + state | Published-map JSON | Standalone published map |
| Bootstrap | `{runtime, settings, state}` | Current host/application instance | One concrete `heurist-map` startup |

## 10. Design rules

The following rules should be kept when extending map configuration:

1. **Do not put runtime connection values into persisted settings.** Database, API URLs, tokens, request headers, callbacks, and host objects belong to `bootstrap.runtime`.
2. **Add user-editable persisted properties to the configuration schema/defaults.** This keeps normalization and server-side publishing allowlists predictable.
3. **Merge configuration once.** The host resolves preference/widget precedence before `heurist-map` starts; `getHeuristMapConfig()` consumes the resulting bootstrap rather than repeating the merge.
4. **Use state for reproducibility, not preferences.** Current extent, active layer/document, query, and selection belong to state when they need to be restored.
5. **Configuration-only mode must remain lightweight.** Website configuration should not create or reinitialise the map engine.
