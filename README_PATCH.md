# Map configuration-only apply guard

- `mapViewer.js`: explicitly treats `viewerMode === 'configuration'` as return-only configuration editing; no live MapApplication apply path is entered.
- `test/configHostIntegration.test.js`: asserts the lightweight `HeuristMapConfigurationApi` does not expose `applyConfiguration()`.

Validation: `npm test` => 64/64 passed; `node --check mapViewer.js` passed.
