# Heurist Map integration, maintenance, and distribution

This document explains why `heurist-map` is maintained as an independent client project, how it integrates with the main Heurist application, its run modes, the maintenance contract between repositories, and the intended production distribution workflow.

For the internal class structure see [`architecture.md`](architecture.md). For the bootstrap/settings/state contract see [`configuration.md`](configuration.md).

## 1. Why `heurist-map` is an independent project

`heurist-map` is the presentation part of Heurist mapping. It consumes Heurist map/document/data services and renders the result, but it does not need the main Heurist client framework in order to do so.

Keeping it as an independent project has several benefits:

- the new map implementation can be developed and tested without mixing Leaflet/application code into the large legacy client codebase;
- its public boundary is explicit: bootstrap configuration in, Heurist API data in, public map API/events out;
- the map engine can remain hidden behind an adapter instead of becoming a dependency of unrelated Heurist widgets;
- it can run in the main administration UI, in generated/user websites, or as a standalone published page;
- the main Heurist application integrates one wrapper widget rather than importing many implementation classes;
- release and regression testing can be performed independently.

This is intended as a model for future client-side Heurist modules. Potential modules include `heurist-mirador4`, `heurist-graph`, `heurist-chart` (including crosstabs), `heurist-entry` for data editing, and eventually `heurist-design`.

The goal is not to split Heurist into unrelated products. The goal is to give major presentation/editor subsystems a clean module boundary so that they can be integrated into the main application without recreating the dependency mix of the legacy client.

## 2. Integration with the main Heurist application

### 2.1 `mapViewer` wrapper

The main Heurist UI embeds `heurist-map` through the jQuery widget `mapViewer.js`.

`mapViewer` owns the iframe and is the compatibility boundary between HAPI4/main-Heurist state and the standalone map application. It provides:

- bootstrap runtime information such as database name, public API base URL, and Heurist root URL;
- the effective `heurist-map-settings` configuration and optional initial state;
- same-origin iframe bridge functions for configuration updates and record editing;
- access to the parent Heurist session implicitly through same-origin requests/cookies;
- translation of `HRecordSet`/Heurist query state into plain query strings/IDs understood by the public map API;
- synchronization with main-Heurist lifecycle/search/selection events;
- forwarding of stable `heurist-map` events back into the main application;
- iframe visibility/lifecycle and resize handling;
- configuration-only startup for Preferences/Website Editor workflows.

The iframe bridge lives on `window.frameElement.heuristMapHost` for the lifetime of the iframe. The child retrieves the current bootstrap with:

```javascript
window.frameElement.heuristMapHost.getConfiguration()
```

This avoids giving the standalone project a dependency on HAPI4 or jQuery.

### 2.2 Main-Heurist event synchronization

When `eventbased` integration is enabled, `mapViewer` listens to the main application events used by the mapping context, including credentials, layout resize, record search start/finish, system initialization, and record selection.

`mapViewer` caches query/selection state and sends it to Current results only when the dynamic MapDocument/layer can use it. In the opposite direction, `heurist-map-selection-changed` is translated into the normal Heurist selection event.

This synchronization belongs in the wrapper, not in `heurist-map`.

## 3. Server/API dependencies

The normal map-data path uses public Heurist API contracts wherever practical.

### 3.1 Map presentation

`MapPresentationService` exposes the normalized presentation definition of persisted map records:

```text
GET /api/{database}/map/document/{recordId}
GET /api/{database}/map/layer/{recordId}
```

These endpoints turn Heurist MapDocument/MapLayer records into stable client-facing structures. The standalone client should not need to know the detail-type IDs used to store those records.

The lightweight list of available MapDocuments is loaded through the normal records API after resolving the database-specific MapDocument record type.

### 3.2 Map data

The public map-data controller/service provides renderable geographic data for a MapLayer.

It covers two broad cases:

1. **Static/external sources** — SHP, KML/KMZ, CSV/TSV, GeoJSON and their supported inline/file/archive forms are converted or returned as GeoJSON/map source data.
2. **Heurist database geography** — record/query geography is returned as GeoJSON, including paged requests and dynamic viewport predicates.

The client can therefore treat converted file sources and Heurist record geography through the same MapLayer/data-loader architecture.

### 3.3 Thematic attributes

Thematic rendering may require attributes that are not part of the geographic GeoJSON payload. `ThematicAttributeProvider` requests only the required direct/linked detail fields for the relevant record IDs through the public records-details API.

This keeps thematic attribute transport separate from geometry transport.

### 3.4 Publishing and preferences

Publishing and user preferences are **host services**, not map-data OpenAPI endpoints in the current architecture.

`HeuristHostAdapter` calls the main Heurist FrontController for:

- `UserController.get_prefs` / `save_prefs`;
- `MapPublishedController.save` / `get` / `delete`.

`MapPublishedService` validates and stores the published configuration/state JSON and builds the bootstrap used by the generated standalone page.

These internal host operations are intentionally separated from `HeuristApiClient`. They do not need to become part of the public OpenAPI contract merely because `heurist-map` uses them when embedded in Heurist.

### 3.5 Other host presentation helpers

Some optional presentation functions still use main-Heurist endpoints outside the public map API, notably standard record popup HTML and report-template discovery. These are isolated in `PopupProvider`/`ReportTemplateProvider` and require `runtime.baseUrl`.

A purely standalone integration can avoid those host-specific features or provide compatible services.

## 4. Run modes

There are three deployment/use contexts and two startup modes.

### 4.1 Main Heurist administration UI

The main Heurist UI creates `mapViewer` in normal map mode. `mapViewer` owns a same-origin iframe and provides the configuration bridge for the entire life of that iframe.

The wrapper supplies runtime/API information, user settings, current query/selection state, and event synchronization. The map itself retrieves MapDocuments, MapLayers, geometry, and thematic attributes from server APIs.

For Preferences editing, `mapViewer` can instead start `heurist-map` with:

```javascript
viewerMode: "configuration"
configurationMode: "preferences"
```

This starts only the configuration API/dialog and does not create Leaflet or load map data.

### 4.2 User website

The Website Editor uses configuration mode to define a `heurist-map-settings` object and stores that configuration with the webpage/widget record.

When the public webpage is rendered, it creates `mapViewer` with the stored settings (or another compatible bootstrap host). The website map therefore uses the same standalone application and public API contracts as the administration map, but with page-specific configuration rather than the user's general map preference.

### 4.3 Standalone / published map

A standalone HTML page can define `window.heuristMapBootstrap` manually and load the distribution bundle directly.

More commonly, the user creates a standalone map through the Publish dialog. The publish service stores a generated-map JSON document containing portable settings and optional captured state, and exposes a public generated-map URL. The generated page converts that document into the standard `{runtime, settings, state}` bootstrap before loading `heurist-map`.

The exact bootstrap and publishing structures are documented in [`configuration.md`](configuration.md).

## 5. Source code and repository

`heurist-map` is maintained in a separate repository from the main Heurist PHP/client repository.

The repository contains both source and release assets:

```text
heurist-map/
  src/
  test/
  docs/
  scripts/
  package.json
  vite.config.js
  dist/                 # production build committed for Heurist distribution
```

A separate repository is useful because the application has its own npm dependencies, Vite build, tests, rendering plugins, release cycle, and engine-adapter boundary. The main Heurist repository needs only the wrapper/integration code and the deployed build artifacts.

## 6. Maintaining `heurist-map` as part of Heurist

The strongest dependency is from server contracts to the map client, not from the map client back into the database design.

For example, if a new public MapLayer property is introduced:

1. the Heurist database/detail definition may store the new value;
2. `MapPresentationService` must expose it in the normalized MapLayer response;
3. the OpenAPI schema/example must describe it if it is public;
4. `heurist-map` must recognize/normalize/render it;
5. configuration/publishing allowlists must be updated if the property also belongs to persisted configuration;
6. tests/documentation should be updated on both sides.

The client should **not** read new database detail IDs directly to compensate for a server change. The presentation/data services remain the compatibility boundary.

This gives us mostly one-way coupling: changes in Heurist's storage/database design are absorbed by server presentation services, while `heurist-map` follows changes to the public presentation/data contract. Updating `heurist-map` should not require modifying unrelated legacy Heurist mapping code.

There are, however, explicit integration contracts that must remain compatible:

- `mapViewer` bootstrap/iframe bridge;
- public Heurist map/records API responses;
- host FrontController actions used for preferences and publishing;
- public `HeuristMapPublicApi` methods/events consumed by `mapViewer`.

Therefore “no backward interference” is the design goal, but not an excuse for incompatible contract changes. A breaking API or wrapper change still requires coordinated versions.

## 7. Distribution model

### 7.1 Proposed repository/build model

For the current Heurist deployment model, keeping both `/src` and `/dist` in the `heurist-map` repository is reasonable.

Development workflow:

```text
edit/test src
    ↓
npm run build
    ↓
verify dist
    ↓
commit source + package metadata + dist together
```

Committing `dist` has practical advantages for Heurist servers: production servers do not need Node/npm or network access to build the client, and the committed bundle is the exact artifact that was tested for that source revision.

The cost is repository size and the need for discipline: a source change that affects the build must not be committed without the corresponding rebuilt `dist`.

Source maps (`*.js.map`, `*.css.map`) are optional production artifacts. They are useful for debugging but do not need to be copied to normal production servers.

### 7.2 Shared server support directory

The proposed server layout is:

```text
/var/www/html/HEURIST/HEURIST_SUPPORT/heurist-map/
```

containing the synchronized contents of the committed `heurist-map/dist`.

Each installed Heurist version then exposes the same support build through:

```text
/var/www/html/<version-folder>/external/heurist-map
```

as a symlink to the shared support directory.

This is suitable **only while all Heurist versions sharing that symlink are compatible with the same `heurist-map` build**. If older supported Heurist versions require a different bootstrap/API contract, the support directory must become versioned, for example:

```text
HEURIST_SUPPORT/heurist-map/0.3.0/
HEURIST_SUPPORT/heurist-map/0.4.0/
```

with each Heurist version linked to its compatible map build.

This compatibility point is the main risk in using one unversioned shared symlink.

### 7.3 Synchronization cron job

A server-side cron script can synchronize the committed repository `dist` into the shared support location. The script should:

1. update/fetch the designated `heurist-map` release branch or checkout;
2. verify that the required entry files exist (`heurist-map.js` and `heurist-map-main.css`);
3. copy to a temporary directory;
4. optionally omit source maps;
5. atomically replace or `rsync --delete` the target directory so obsolete chunks/assets are removed;
6. set expected ownership/permissions;
7. log success/failure and send mail only on errors, consistent with other Heurist sync jobs.

The production cron job should **not run `npm install`/`npm build`** when `dist` is committed. Building remains a development/release responsibility.

### 7.4 Heurist distribution tar

The existing Heurist distribution process already includes `/var/www/html/HEURIST/HEURIST_SUPPORT/` when generating distribution packages. Once `HEURIST_SUPPORT/heurist-map` is synchronized, the normal distribution job can include it together with the other support assets.

This avoids adding npm/Vite to the normal Heurist distribution-generation path.

### 7.5 Runtime location

The main application launcher remains in the Heurist codebase:

```text
hclient/widgets/viewers/mapViewer.js
hclient/widgets/viewers/mapViewer.html
```

The compiled module is deployed under:

```text
external/heurist-map/
  heurist-map.js
  heurist-map-main.css
  heurist-map-*.js
  heurist-map-*.woff/woff2/... as generated
```

`mapViewer.html` should load the bundle from the installation's own `external/heurist-map` path rather than assuming a specific absolute `/heurist/` root when deployments may use another base path.

### 7.6 Cache/version handling

The current build uses stable main entry names and generated secondary assets. Production integration therefore needs an explicit cache-busting policy for the stable entry JS/CSS.

A suitable Heurist approach is to append the normal Heurist/application build version to the entry URLs, for example:

```text
external/heurist-map/heurist-map.js?v=<heurist-build-version>
external/heurist-map/heurist-map-main.css?v=<heurist-build-version>
```

The exact version source should be the same mechanism already used by Heurist for other static assets rather than a second manually maintained map version.

When a deployment replaces `dist`, obsolete generated chunks must be removed; copying new files over an old directory without deletion can leave confusing stale assets.

## 8. What is new compared with the legacy mapping client

The new implementation is not only a rewrite around Leaflet. Its module/API boundaries also enable behavior that was difficult to maintain consistently in the old mapping code.

Current improvements include:

- independent standalone/embeddable application with a stable public API;
- engine-neutral application layer and isolated Leaflet adapter;
- direct map-layer support for GeoJSON and server-converted SHP, KML/KMZ, CSV/TSV, including file/archive/inline forms supported by the server data service;
- dynamic loading by current map extent;
- paged loading of Heurist geographic data, with configuration supporting up to 5000 features per layer at one time;
- deferred source loading for hidden/out-of-range layers;
- cancellation of stale document, layer, and viewport requests;
- isolation of individual layer failures rather than failing the entire MapDocument;
- reinstated thematic mapping with separate thematic-attribute transport;
- legend rendering and shared symbology preview model;
- layer opacity and active-theme state that can be captured/restored for publishing;
- configurable native map tools (zoom, scale, bookmarks, print, search; selector reserved);
- raster image filters on images and tiles, including exact-color transparency for tiled imagery;
- configuration modes for preferences, website editing, and publishing;
- reproducible standalone published maps using the same bootstrap/settings/state contract;
- explicit synchronization between main-Heurist search/selection lifecycle and the standalone map through `mapViewer`;
- MapDocument activation guards so a slow initialization cannot overwrite a later user selection.

See the project README and tests for lower-level feature notes and examples. Historical phase notes in the README should be treated as implementation history; the architecture/configuration/integration documents describe the current contracts.

## 9. Release checklist

For a coordinated Heurist/`heurist-map` release:

1. run the full `heurist-map` test suite;
2. run `npm run build`;
3. verify the production bundle without the Vite development server;
4. update and commit `dist` together with source changes;
5. synchronize `dist` to `HEURIST_SUPPORT/heurist-map`;
6. verify all target Heurist version symlinks point to a compatible build;
7. verify OpenAPI examples/schemas match current server MapDocument/MapLayer/data output;
8. verify `mapViewer` against the current `HeuristMapPublicApi` events/methods;
9. test Preferences, Current results, persisted MapDocuments, dynamic viewport loading, thematic symbology, and publishing;
10. verify browser cache/version behavior after replacing the distribution.
