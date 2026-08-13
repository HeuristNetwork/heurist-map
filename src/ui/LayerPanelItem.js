/**
 * LayerPanelItem.js - One MapLayer row with state and actions.
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */
import { createLayerLegend } from './legend/LegendRenderer.js';

export class LayerPanelItem {
  constructor({ api, layer, editingEnabled = false, onEditLayer = null, showLegend = true }) {
    this.api = api;
    this.layer = layer;
    this.editingEnabled = editingEnabled;
    this.onEditLayer = onEditLayer;
    this.showLegend = showLegend !== false;
    this.element = this.create();
  }

  create() {
    const row = document.createElement('div');
    row.className = 'heurist-map-layer-row';
    row.dataset.layerId = this.layer.id;

    const main = document.createElement('div');
    main.className = 'heurist-map-row-main';
    main.append(this.createStateControl());

    const titleBlock = document.createElement('span');
    titleBlock.className = 'heurist-map-layer-title-block';
    const title = document.createElement('span');
    title.className = 'heurist-map-layer-title';
    const presentation = getLayerPresentation(this.layer);
    title.textContent = presentation.label;
    title.title = presentation.title;
    titleBlock.append(title);
    if (presentation.warning) {
      const warning = document.createElement('small');
      warning.className = 'heurist-map-layer-partial-warning';
      warning.textContent = presentation.warning;
      warning.title = presentation.warning;
      titleBlock.append(warning);
    }
    main.append(titleBlock);

    const actions = document.createElement('span');
    actions.className = 'heurist-map-row-actions';
    if (this.layer.loadState === 'loaded') {
      const zoomButton = button(
        'fa-solid fa-magnifying-glass-plus',
        'Zoom to layer extent',
        () => this.api.zoomToLayer(this.layer.id)
      );
      zoomButton.classList.add('heurist-map-layer-zoom-action');
      actions.append(zoomButton);
      actions.append(createOpacityControl(this.api, this.layer, row));
      if (String(this.layer.id) !== 'current-results' && this.editingEnabled && typeof this.onEditLayer === 'function') {
        actions.append(button(
          'fa-solid fa-pencil',
          'Edit layer',
          () => this.onEditLayer(this.layer.id)
        ));
      }
    }

    row.append(main, actions);
    const thematicSelector = this.createThematicSelector();
    if (thematicSelector) row.append(thematicSelector);
    if (this.showLegend && supportsSymbologyLegend(this.layer)) {
      const legend = createLayerLegend(this.layer);
      if (legend) row.append(legend);
    }
    return row;
  }


  createThematicSelector() {
    if (this.layer?.loadState !== 'loaded' || !supportsThematicSelection(this.layer)) return null;
    const thematic = Array.isArray(this.layer?.style?.thematic) ? this.layer.style.thematic : [];
    if (!thematic.length) return null;

    const list = document.createElement('div');
    list.className = 'heurist-map-layer-themes';
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-label', `Symbology for ${this.layer.title || this.layer.id}`);

    const activeIndex = thematic.findIndex((theme) => theme?.active === true);
    list.append(this.createThemeRadio('Default', null, activeIndex < 0));
    thematic.forEach((theme, index) => {
      list.append(this.createThemeRadio(theme?.title || `Theme ${index + 1}`, index, activeIndex === index));
    });
    return list;
  }

  createThemeRadio(labelText, themeIndex, checked) {
    const label = document.createElement('label');
    label.className = 'heurist-map-layer-theme-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `heurist-map-layer-theme-${this.layer.id}`;
    radio.checked = checked;
    radio.value = themeIndex == null ? 'default' : String(themeIndex);
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      Promise.resolve(this.api.setLayerTheme(this.layer.id, themeIndex)).catch(() => {});
    });

    const text = document.createElement('span');
    text.textContent = labelText;
    label.append(radio, text);
    return label;
  }

  createStateControl() {
    if (this.layer.loadState === 'loading') {
      const status = document.createElement('span');
      status.className = 'heurist-map-layer-status';
      status.title = 'Loading layer';
      status.setAttribute('aria-label', 'Loading layer');
      status.innerHTML = '<span class="heurist-map-spinner" aria-hidden="true"></span>';
      return status;
    }

    if (this.layer.loadState === 'error') {
      const retry = button(
        'fa-solid fa-triangle-exclamation',
        this.layer.error?.message || 'Layer loading failed; click to retry',
        () => this.api.reloadLayer(this.layer.id)
      );
      retry.classList.add('heurist-map-layer-error');
      return retry;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.layer.visible;
    checkbox.title = this.layer.loadState === 'deferred'
      ? 'Layer has not been loaded'
      : 'Layer loaded';
    checkbox.addEventListener('change', async () => {
      const requested = checkbox.checked;
      try {
        await this.api.setLayerVisibility(this.layer.id, requested);
      } catch (error) {
        checkbox.checked = !requested;
        throw error;
      }
    });
    return checkbox;
  }
}

function supportsSymbologyLegend(layer) {
  const sourceType = String(layer?.source?.type || '');
  return !['image', 'tile', 'iiif', 'geotiff'].includes(sourceType);
}

function supportsThematicSelection(layer) {
  const sourceType = String(layer?.source?.type || '');
  // Thematic attributes are retrieved through the Heurist records/details API.
  // Do not expose thematic controls for external/vector-file or raster sources.
  return sourceType === 'heurist-query' || sourceType === 'record';
}

function button(icon, title, handler) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'heurist-map-icon-button';
  element.title = title;
  element.innerHTML = `<span class="${icon}" aria-hidden="true"></span>`;
  element.addEventListener('click', handler);
  return element;
}

function createOpacityControl(api, layer, row) {
  const control = document.createElement('span');
  control.className = 'heurist-map-opacity-control';

  const trigger = button(
    'fa-solid fa-circle-half-stroke',
    'Set layer opacity',
    (event) => {
      event.stopPropagation();
      openOpacityPopover({ api, layer, row, trigger });
    }
  );

  control.append(trigger);
  return control;
}

function openOpacityPopover({ api, layer, row, trigger }) {
  closeOpenOpacityPopover();

  const popover = document.createElement('div');
  popover.className = 'heurist-map-opacity-popover';
  popover.dataset.heuristMapOpacityPopover = '1';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'heurist-map-opacity-close';
  close.title = 'Close opacity control';
  close.setAttribute('aria-label', 'Close opacity control');
  close.textContent = '×';

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '1';
  input.value = String(Math.round((layer.opacity ?? 1) * 100));
  input.title = 'Layer opacity';
  input.setAttribute('aria-label', 'Layer opacity');

  const value = document.createElement('span');
  value.className = 'heurist-map-opacity-value';
  value.textContent = `${input.value}%`;

  popover.append(input, value, close);
  row.append(popover);

  input.addEventListener('input', () => {
    value.textContent = `${input.value}%`;
    api.setLayerOpacity(layer.id, Number(input.value));
  });

  const cleanup = () => {
    document.removeEventListener('pointerdown', onOutsidePointerDown, true);
    popover.remove();
  };
  popover._heuristCleanup = cleanup;

  const onOutsidePointerDown = (event) => {
    if (!popover.contains(event.target) && !trigger.contains(event.target)) {
      cleanup();
    }
  };

  close.addEventListener('click', (event) => {
    event.stopPropagation();
    cleanup();
  });
  popover.addEventListener('pointerdown', (event) => event.stopPropagation());

  // Defer registration so the pointer event that opened the popover cannot
  // immediately close it again.
  queueMicrotask(() => document.addEventListener('pointerdown', onOutsidePointerDown, true));
}

function closeOpenOpacityPopover() {
  const popover = document.querySelector('[data-heurist-map-opacity-popover="1"]');
  if (typeof popover?._heuristCleanup === 'function') {
    popover._heuristCleanup();
  } else {
    popover?.remove();
  }
}

function getLayerPresentation(layer) {

  let label, title;
  let warning = null;

  const meta = layer?.resultMeta || {};
  const features = finiteCount(meta.returnedFeatures) ?? finiteCount(layer?.featureCount) ?? 0; 
  if (meta.isPartial === true) {
    const returnedRecords = finiteCount(meta.returnedRecords);
    const totalRecords = finiteCount(meta.totalRecords);
    const detail = returnedRecords != null && totalRecords != null
      ? `first ${formatCount(returnedRecords)} of ${formatCount(totalRecords)} records processed`
      : 'only part of the result set was loaded';
    title = `Result: ${formatCount(features)} features — ${detail}`;
    warning = `Partial load: ${detail}.`;
  }else{
    title = `Result: ${formatCount(features)} features`;
  }

  if (String(layer?.id) !== 'current-results') {
    label = layer?.title || String(layer?.id ?? '');
    if (String(label).trim().toLowerCase() === '[vector]') {
      label = `${formatCount(features)} features`;
    }
  }else{
    label = title;
    warning = null;
  }

  return { label, title, warning: warning };
}

function finiteCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null;
}

function formatCount(value) {
  return new Intl.NumberFormat().format(value);
}
