/**
 * MapControlPanel.js - Engine-neutral application controls rendered above or beside the map.
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */
import { MapDocumentSelector } from './MapDocumentSelector.js';
import { LayerPanel } from './LayerPanel.js';
import { BaseMapSelector } from './BaseMapSelector.js';

export class MapControlPanel {
  constructor({ api, mapContainer, options }) {
    this.api = api;
    this.mapContainer = mapContainer;
    this.options = options;
    this.listeners = [];
    this.baseMapsExpanded = options.baseMapsInitiallyExpanded !== false;
  }

  mount() {
    if (this.options.enabled === false || this.options.placement === 'none') return;

    this.element = document.createElement('aside');
    this.element.className = 'heurist-map-control-panel';
    this.element.setAttribute('aria-label', 'Map controls');
    if (this.options.position) this.element.classList.add(`position-${this.options.position}`);
    if (this.options.maxHeight) this.element.style.maxHeight = String(this.options.maxHeight);
    this.applyControlCss();

    const header = document.createElement('div');
    header.className = 'heurist-map-panel-header';
    const hasDocumentControls = this.options.showCurrentDocument !== false || this.options.showMapDocuments !== false;
    const hasPanelSections = hasDocumentControls || this.options.showBaseMaps !== false;
    if (!hasPanelSections) {
      this.element.classList.add('controls-only');
    } else {
      const toggle = iconButton('fa-solid fa-layer-group', 'Show or hide map controls', () => {
        this.element.classList.toggle('collapsed');
        toggle.setAttribute('aria-expanded', String(!this.element.classList.contains('collapsed')));
      });
      toggle.classList.add('heurist-map-panel-toggle');
      toggle.setAttribute('aria-expanded', String(this.options.initiallyExpanded !== false));
      const title = document.createElement('strong');
      title.textContent = 'Map controls';
      header.append(toggle, title);
    }
    if (this.options.showHomeControl !== false) {
      header.append(iconButton('fa-solid fa-house', 'Zoom to active map document', () => this.api.zoomHome()));
    }

    const hostCapabilities = this.api.getHostCapabilities?.() || {};
    if (this.options.showOptions !== false && hostCapabilities.mapPreferences) {
      header.append(iconButton('fa-solid fa-gear', 'Map options', () => this.api.openPreferencesDialog()));
    }
    if (this.options.showPublish !== false && hostCapabilities.mapPublishing) {
      header.append(iconButton('fa-solid fa-share-nodes', 'Publish map', () => this.api.openPublishDialog()));
    }

    const body = document.createElement('div');
    body.className = 'heurist-map-panel-body';
    if (this.options.initiallyExpanded === false) this.element.classList.add('collapsed');

    if (hasDocumentControls) {
      this.documentsContainer = document.createElement('div');
      this.documentsContainer.className = 'heurist-map-documents';
      body.append(this.documentsContainer);
    }

    if (this.options.showBaseMaps !== false) {
      const baseSection = document.createElement('section');
      baseSection.className = 'heurist-map-basemap-section';
      this.baseMapsToggle = document.createElement('button');
      this.baseMapsToggle.type = 'button';
      this.baseMapsToggle.className = 'heurist-map-basemap-toggle';
      this.baseMapsToggle.addEventListener('click', () => {
        this.baseMapsExpanded = !this.baseMapsExpanded;
        this.updateBaseMapsExpansion();
      });
      this.baseMapsContainer = document.createElement('div');
      this.baseMapsContainer.className = 'heurist-map-basemap-list';
      baseSection.append(this.baseMapsToggle, this.baseMapsContainer);
      body.append(baseSection);
      this.updateBaseMapsExpansion();
    }

    this.element.append(header);
    if (hasPanelSections) this.element.append(body);
    const target = this.options.placement === 'external' && this.options.containerId
      ? document.getElementById(this.options.containerId)
      : this.mapContainer.parentElement;
    if (target && globalThis.getComputedStyle?.(target).position === 'static') target.style.position = 'relative';
    target?.append(this.element);

    this.documentSelector = this.documentsContainer
      ? new MapDocumentSelector({ api: this.api, container: this.documentsContainer })
      : null;
    this.baseMapSelector = this.baseMapsContainer
      ? new BaseMapSelector({ api: this.api, container: this.baseMapsContainer })
      : null;

    for (const eventName of [
      'heurist-map-documents-loaded', 'heurist-map-documents-changed',
      'heurist-map-document-activating', 'heurist-map-document-activated',
      'heurist-map-document-state-changed', 'heurist-map-document-unloaded',
      'heurist-map-layer-loaded', 'heurist-map-layer-visibility-changed',
      'heurist-map-layer-state-changed', 'heurist-map-layer-style-changed',
      'heurist-map-basemap-changed', 'heurist-map-error'
    ]) this.bind(eventName, () => this.refresh());

    // The opacity slider updates continuously. Rebuilding the panel for every
    // input event would remove the open popover, so defer that refresh until
    // the control is closed. Programmatic opacity changes still refresh when
    // no opacity control is open.
    this.bind('heurist-map-layer-opacity-changed', () => {
      if (!document.querySelector('[data-heurist-map-opacity-popover="1"]')) {
        this.refresh();
      }
    });
    this.refresh();
  }

  bind(name, handler) {
    this.api.addEventListener(name, handler);
    this.listeners.push([name, handler]);
  }

  refresh() {
    const activeId = this.api.getActiveMapDocument()?.id;
    const editingEnabled = this.api.getCapabilities?.().editing === true;
    const allDocuments = this.api.getMapDocuments();
    const documentActivating = allDocuments.some((item) => item.activating === true || item.loadState === 'loading');
    const documents = allDocuments.filter((item) => {
      if (item.showInPanel === false) return false;
      if (item.persistent === false) return this.options.showCurrentDocument !== false;
      return this.options.showMapDocuments !== false;
    });
    this.documentSelector?.render(documents, activeId, () => {
      if (this.options.showLayers === false) return null;
      const container = document.createElement('div');
      container.className = 'heurist-map-active-layers';
      new LayerPanel({
        api: this.api,
        container,
        editingEnabled,
        onEditLayer: (layerId) => this.editLayer(layerId),
        showLegend: this.options.showLegend !== false
      }).render(this.api.getLayers(), { loading: documentActivating });
      return container;
    }, {
      editingEnabled,
      onEditDocument: (documentId) => this.editMapDocument(documentId)
    });
    this.baseMapSelector?.render(this.api.getBaseMaps(), this.api.getActiveBaseMap()?.id);
    this.updateBaseMapsExpansion();
  }


  /** Request editing of a persisted MapDocument through the public map API. */
  editMapDocument(documentId) {
    return this.api.requestEditMapDocument(documentId);
  }

  /** Request editing of a persisted MapLayer through the public map API. */
  editLayer(layerId) {
    return this.api.requestEditLayer(layerId);
  }

  updateBaseMapsExpansion() {
    if (!this.baseMapsToggle || !this.baseMapsContainer) return;
    this.baseMapsToggle.textContent = `Base maps ${this.baseMapsExpanded ? '▾' : '▸'}`;
    this.baseMapsToggle.setAttribute('aria-expanded', String(this.baseMapsExpanded));
    this.baseMapsContainer.hidden = !this.baseMapsExpanded;
  }

  /** Apply custom Map Control CSS as inline declarations or a complete CSS rule. */
  applyControlCss() {
    this.controlCssStyle?.remove();
    this.controlCssStyle = null;
    const css = String(this.options.controlCss || '').trim();
    if (!css || !this.element) return;

    if (!css.includes('{')) {
      this.element.style.cssText = `${this.element.style.cssText};${css}`;
      return;
    }

    const style = document.createElement('style');
    style.className = 'heurist-map-control-custom-css';
    style.textContent = css;
    (this.element.ownerDocument?.head || document.head).append(style);
    this.controlCssStyle = style;
  }

  /** Rebuild the lightweight control panel with new presentation options. */
  applyOptions(options = {}) {
    const next = { ...this.options, ...options };
    const wasExpanded = this.element ? !this.element.classList.contains('collapsed') : next.initiallyExpanded !== false;
    this.destroy();
    this.options = next;
    this.listeners = [];
    this.baseMapsExpanded = next.baseMapsInitiallyExpanded !== false;
    this.mount();
    if (this.element && wasExpanded !== (next.initiallyExpanded !== false)) {
      this.element.classList.toggle('collapsed', !wasExpanded);
    }
    return this.element || null;
  }

  destroy() {
    for (const [name, handler] of this.listeners) this.api.removeEventListener(name, handler);
    this.controlCssStyle?.remove();
    this.controlCssStyle = null;
    this.element?.remove();
  }
}

function iconButton(icon, title, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'heurist-map-icon-button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = `<span class="${icon}" aria-hidden="true"></span>`;
  button.addEventListener('click', (event) => { event.stopPropagation(); Promise.resolve(handler(event)).catch(() => {}); });
  return button;
}
