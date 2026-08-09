# Heurist Map bootstrap refactor

This patch replaces the consumed parent registry / `hostInstance` mechanism with one persistent same-origin bootstrap bridge attached to the iframe DOM element.

Bootstrap contract:

```js
{
  runtime: { /* database/API/host/runtime-only values */ },
  settings: { format: 'heurist-map-settings', version: 1, options: {}, config: {} },
  state: null,
  mapDocument: null
}
```

Key points:

- `mapViewer` owns `_mapBootstrap` for the lifetime of the widget.
- The iframe element exposes `heuristMapHost.getConfiguration()`; the child reads it as `window.frameElement.heuristMapHost`.
- Reloading the iframe does not consume or destroy bootstrap information.
- Preferences + explicit widget settings are merged once in `mapViewer`.
- `getHeuristMapConfig()` consumes normalized `settings` and no longer overlays runtime `ui`, `dynamicDocument`, etc.
- Legacy mixed `heuristMapOptions` settings are extracted once for compatibility.
- Saving preferences calls `bridge.updateSettings(settings)`, keeping the parent bootstrap current for later iframe reloads.
