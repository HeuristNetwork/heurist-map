/** LayerPanel.js - Render ordered layers for the active MapDocument. */
import { LayerPanelItem } from './LayerPanelItem.js';
export class LayerPanel {
  constructor({ api, container, editingEnabled = false, onEditLayer = null, showLegend = true }) {
    this.api = api;
    this.container = container;
    this.editingEnabled = editingEnabled;
    this.onEditLayer = onEditLayer;
    this.showLegend = showLegend !== false;
  }
  render(layers, { loading = false } = {}) {
    this.container.replaceChildren();
    for (const layer of layers) {
      this.container.append(new LayerPanelItem({
        api: this.api,
        layer,
        editingEnabled: this.editingEnabled,
        onEditLayer: this.onEditLayer,
        showLegend: this.showLegend
      }).element);
    }
    if (!layers.length) {
      const e = document.createElement('div');
      e.className = 'heurist-map-empty';
      e.textContent = loading ? 'Loading...' : 'No layers';
      this.container.append(e);
    }
  }
}
