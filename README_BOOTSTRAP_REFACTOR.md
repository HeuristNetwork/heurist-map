# Bootstrap refactor

The current bootstrap contract is intentionally small:

```javascript
{
  runtime: {
    viewerMode,
    configurationMode,
    database,
    apiBaseUrl,
    baseUrl,
    accessToken,
    requestHeaders
  },
  settings,
  state
}
```

`settings` is optional; canonical defaults are applied when it is absent. Basemap definitions, UI runtime overrides, document-loading mechanics, nested host configuration, `serverUrl`, and direct MapDocument objects are not bootstrap fields. See `docs/configuration.md` for the authoritative description.
