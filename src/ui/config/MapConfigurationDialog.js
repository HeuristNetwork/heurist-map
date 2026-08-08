/**
 * MapConfigurationDialog.js - Reusable editor for persisted Heurist map settings
 *
 * The dialog owns no persistence. Preferences, website editing, and publishing
 * provide/receive the same allowlisted settings object through setValue(),
 * getValue(), and onSave.
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */

import {
  normalizeMapConfigurationMode,
  normalizeMapConfigurationSettings,
  serializeMapConfigurationSettings
} from './mapConfigurationSchema.js';

export class MapConfigurationDialog {
  constructor({
    mode = 'preferences',
    value = null,
    parent = null,
    title = null,
    onSave = null,
    onCancel = null
  } = {}) {
    this.mode = normalizeMapConfigurationMode(mode);
    this.value = normalizeMapConfigurationSettings(value || {});
    this.parent = parent;
    this.title = title || defaultTitle(this.mode);
    this.onSave = typeof onSave === 'function' ? onSave : null;
    this.onCancel = typeof onCancel === 'function' ? onCancel : null;
    this.element = null;
    this.dialog = null;
    this.form = null;
    this.fields = new Map();
    this.previousFocus = null;
  }

  /** Replace the editable settings value. */
  setValue(value) {
    this.value = normalizeMapConfigurationSettings(value || {});
    if (this.form) this.populate();
    return this;
  }

  /** Return the normalized allowlisted settings pair. */
  getValue() {
    if (this.form) this.value = normalizeMapConfigurationSettings(this.readForm());
    return clone(this.value);
  }

  /** Return the versioned JSON-safe persisted settings envelope. */
  serialize() {
    return serializeMapConfigurationSettings(this.getValue());
  }

  /** Create/show the modal dialog. */
  open() {
    if (typeof document === 'undefined') {
      throw new Error('MapConfigurationDialog requires a browser document');
    }
    if (this.element) return this;

    this.previousFocus = document.activeElement;
    this.element = document.createElement('div');
    this.element.className = 'heurist-map-config-backdrop';
    this.element.addEventListener('mousedown', (event) => {
      if (event.target === this.element) this.cancel();
    });

    this.dialog = document.createElement('section');
    this.dialog.className = 'heurist-map-config-dialog';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-label', this.title);

    const header = document.createElement('header');
    header.className = 'heurist-map-config-header';
    const heading = document.createElement('h2');
    heading.textContent = this.title;
    const closeButton = button('×', 'Close', () => this.cancel());
    closeButton.classList.add('heurist-map-config-close');
    header.append(heading, closeButton);

    this.form = document.createElement('form');
    this.form.className = 'heurist-map-config-form';
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.save();
    });
    this.form.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.cancel();
      }
    });

    this.buildSections();

    const footer = document.createElement('footer');
    footer.className = 'heurist-map-config-footer';
    footer.append(
      button('Cancel', 'Cancel', () => this.cancel()),
      submitButton(this.mode === 'publish' ? 'Continue' : 'Save')
    );
    this.form.append(footer);
    this.dialog.append(header, this.form);
    this.element.append(this.dialog);

    const target = this.parent || document.body;
    target.append(this.element);
    this.populate();
    firstFocusable(this.dialog)?.focus();
    return this;
  }

  /** Close and remove the dialog without saving. */
  cancel() {
    const value = this.getValue();
    this.close();
    this.onCancel?.(value, { mode: this.mode });
  }

  /** Normalize, emit, and close after a successful save callback. */
  async save() {
    try {
      const value = this.getValue();
      const result = await this.onSave?.(value, {
        mode: this.mode,
        serialized: serializeMapConfigurationSettings(value)
      });
      if (result === false) return false;
      this.close();
      return value;
    } catch (error) {
      this.showError(error?.message || String(error));
      return false;
    }
  }

  /** Remove the dialog from the DOM. */
  close() {
    this.element?.remove();
    this.element = null;
    this.dialog = null;
    this.form = null;
    this.fields.clear();
    if (this.previousFocus?.focus) this.previousFocus.focus();
    this.previousFocus = null;
  }

  buildSections() {
    this.form.append(
      this.section('Interface', (body) => this.buildInterface(body)),
      this.section('Map documents', (body) => this.buildMapDocuments(body)),
      this.section('Base maps', (body) => this.buildBaseMaps(body)),
      this.section('Interaction', (body) => this.buildInteraction(body)),
      this.section('Current results', (body) => this.buildCurrentResults(body))
    );
  }

  buildInterface(body) {
    this.checkbox(body, 'options.ui.enabled', 'Show map controls');
    this.select(body, 'options.ui.placement', 'Control placement', [
      ['overlay', 'Overlay'], ['side', 'Side panel']
    ]);
    this.select(body, 'options.ui.position', 'Control position', [
      ['top-left', 'Top left'], ['top-right', 'Top right'],
      ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']
    ]);
    this.checkbox(body, 'options.ui.initiallyExpanded', 'Initially expanded');
    this.checkbox(body, 'options.ui.showCurrentDocument', 'Show current-results document');
    this.checkbox(body, 'options.ui.showMapDocuments', 'Show map documents');
    this.checkbox(body, 'options.ui.showLayers', 'Show layers');
    this.checkbox(body, 'options.ui.showBaseMaps', 'Show base maps');
    this.checkbox(body, 'options.ui.showLegend', 'Show legend');
    this.checkbox(body, 'options.ui.showZoomControl', 'Show zoom control');
    this.checkbox(body, 'options.ui.showSearch', 'Show search');
    this.checkbox(body, 'options.ui.showPublish', 'Show publish control');
  }

  buildMapDocuments(body) {
    this.text(body, 'options.mapDocuments.allowed', 'Allowed MapDocument IDs', {
      placeholder: 'All (or comma-separated record IDs)', kind: 'list-number'
    });
    this.text(body, 'options.mapDocuments.initiallyActive', 'Initially active document', {
      placeholder: 'Default, record ID, or dynamic', kind: 'identifier'
    });
  }

  buildBaseMaps(body) {
    this.text(body, 'options.baseMaps.allowed', 'Allowed base maps', {
      placeholder: 'All (or comma-separated IDs/names)', kind: 'list-string'
    });
    this.text(body, 'options.baseMaps.initial', 'Initial base map', { placeholder: 'Default' });
  }

  buildInteraction(body) {
    this.checkbox(body, 'options.interaction.selectionEnabled', 'Enable selection');
    this.checkbox(body, 'options.interaction.popupEnabled', 'Enable popups');
    this.checkbox(body, 'options.interaction.zoomOnSelection', 'Zoom on selection');
  }

  buildCurrentResults(body) {
    const doc = document.createElement('fieldset');
    doc.className = 'heurist-map-config-group';
    doc.append(legend('Dynamic map document'));
    this.checkbox(doc, 'config.dynamicDocument.enabled', 'Enable current-results document');
    this.text(doc, 'config.dynamicDocument.title', 'Title');
    this.checkbox(doc, 'config.dynamicDocument.initiallyActive', 'Initially active');
    this.zoomFields(doc, 'config.dynamicDocument');
    this.boundsFields(doc, 'config.dynamicDocument.bounds');
    this.json(doc, 'config.dynamicDocument.symbology', 'Default symbology');

    const layer = document.createElement('fieldset');
    layer.className = 'heurist-map-config-group';
    layer.append(legend('Current-results layer'));
    this.text(layer, 'config.currentResultsLayer.title', 'Title');
    this.checkbox(layer, 'config.currentResultsLayer.visible', 'Initially visible');
    this.checkbox(layer, 'config.currentResultsLayer.selectable', 'Selectable');
    this.json(layer, 'config.currentResultsLayer.style', 'Default style');
    this.checkbox(layer, 'config.currentResultsLayer.options.markerClustering', 'Marker clustering');
    this.number(layer, 'config.currentResultsLayer.options.maxAllowedFeatures', 'Maximum allowed features', { min: 1, step: 1 });
    this.checkbox(layer, 'config.currentResultsLayer.options.dynamicRequests', 'Dynamic requests');
    this.zoomFields(layer, 'config.currentResultsLayer.options');
    this.textarea(layer, 'config.currentResultsLayer.options.popupTemplate', 'Popup template');

    body.append(doc, layer);
  }

  zoomFields(body, prefix) {
    const row = document.createElement('div');
    row.className = 'heurist-map-config-grid';
    this.number(row, `${prefix}.minZoom`, 'Min zoom level', { step: 1, compact: true });
    this.number(row, `${prefix}.maxZoom`, 'Max zoom level', { step: 1, compact: true });
    this.number(row, `${prefix}.minimumZoomKm`, 'Zoom-in limit (km)', { min: 0, compact: true });
    this.number(row, `${prefix}.maximumZoomKm`, 'Zoom-out limit (km)', { min: 0, compact: true });
    if (prefix === 'config.dynamicDocument') {
      this.number(row, `${prefix}.zoomToPointInKM`, 'Point selection extent (km)', { min: 0, compact: true });
    }
    body.append(row);
  }

  boundsFields(body, prefix) {
    const row = document.createElement('div');
    row.className = 'heurist-map-config-grid';
    for (const [key, labelText] of [['west', 'West'], ['south', 'South'], ['east', 'East'], ['north', 'North']]) {
      this.number(row, `${prefix}.${key}`, labelText, { compact: true });
    }
    body.append(row);
  }

  section(title, build) {
    const details = document.createElement('details');
    details.className = 'heurist-map-config-section';
    details.open = title === 'Interface' || title === 'Current results';
    const summary = document.createElement('summary');
    summary.textContent = title;
    const body = document.createElement('div');
    body.className = 'heurist-map-config-section-body';
    build(body);
    details.append(summary, body);
    return details;
  }

  checkbox(body, path, labelText) {
    const row = document.createElement('label');
    row.className = 'heurist-map-config-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    this.register(path, input, 'boolean');
    row.append(input, document.createTextNode(labelText));
    body.append(row);
  }

  select(body, path, labelText, choices) {
    const { row, control } = labelledControl('select', labelText);
    for (const [value, text] of choices) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      control.append(option);
    }
    this.register(path, control, 'string');
    body.append(row);
  }

  text(body, path, labelText, options = {}) {
    const { row, control } = labelledControl('input', labelText);
    control.type = 'text';
    if (options.placeholder) control.placeholder = options.placeholder;
    this.register(path, control, options.kind || 'string-null');
    body.append(row);
  }

  textarea(body, path, labelText) {
    const { row, control } = labelledControl('textarea', labelText);
    control.rows = 3;
    this.register(path, control, 'string-null');
    body.append(row);
  }

  json(body, path, labelText) {
    const { row, control } = labelledControl('textarea', labelText);
    control.rows = 3;
    control.placeholder = 'JSON (optional)';
    this.register(path, control, 'json');
    body.append(row);
  }

  number(body, path, labelText, options = {}) {
    const { row, control } = labelledControl('input', labelText);
    control.type = 'number';
    control.step = options.step ?? 'any';
    if (options.min !== undefined) control.min = String(options.min);
    if (options.compact) row.classList.add('compact');
    this.register(path, control, path.endsWith('maxAllowedFeatures') ? 'positive-int' : 'number-null');
    body.append(row);
  }

  register(path, control, kind) {
    control.dataset.configPath = path;
    this.fields.set(path, { control, kind });
  }

  populate() {
    const value = this.value;
    for (const [path, field] of this.fields) {
      const current = getPath(value, path);
      if (field.kind === 'boolean') {
        field.control.checked = current === true;
      } else if (field.kind === 'json') {
        field.control.value = current == null ? '' : JSON.stringify(current, null, 2);
      } else if (field.kind.startsWith('list-')) {
        field.control.value = Array.isArray(current) ? current.join(', ') : '';
      } else {
        field.control.value = current == null ? '' : String(current);
      }
    }
  }

  readForm() {
    const result = { options: {}, config: {} };
    for (const [path, field] of this.fields) {
      const value = readControl(field, path);
      setPath(result, path, value);
    }
    return result;
  }

  showError(message) {
    let error = this.form?.querySelector('.heurist-map-config-error');
    if (!error && this.form) {
      error = document.createElement('div');
      error.className = 'heurist-map-config-error';
      error.setAttribute('role', 'alert');
      this.form.prepend(error);
    }
    if (error) error.textContent = message;
  }
}

function readControl(field, path) {
  const control = field.control;
  if (field.kind === 'boolean') return control.checked;
  const text = control.value.trim();
  if (field.kind === 'number-null') return text === '' ? null : Number(text);
  if (field.kind === 'positive-int') return text === '' ? null : Number.parseInt(text, 10);
  if (field.kind === 'json') {
    if (!text) return null;
    try { return JSON.parse(text); } catch { throw new Error(`Invalid JSON in ${path}`); }
  }
  if (field.kind === 'list-number') {
    if (!text) return null;
    return text.split(',').map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0);
  }
  if (field.kind === 'list-string') {
    if (!text) return null;
    return text.split(',').map((item) => item.trim()).filter(Boolean);
  }
  if (field.kind === 'identifier') {
    if (!text) return null;
    return text === 'dynamic' ? 'dynamic' : Number(text);
  }
  return text || null;
}

function labelledControl(tag, labelText) {
  const row = document.createElement('label');
  row.className = 'heurist-map-config-field';
  const caption = document.createElement('span');
  caption.textContent = labelText;
  const control = document.createElement(tag);
  row.append(caption, control);
  return { row, control };
}

function legend(text) {
  const item = document.createElement('legend');
  item.textContent = text;
  return item;
}

function button(text, title, handler) {
  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = text;
  item.title = title;
  item.addEventListener('click', handler);
  return item;
}

function submitButton(text) {
  const item = document.createElement('button');
  item.type = 'submit';
  item.className = 'primary';
  item.textContent = text;
  return item;
}

function firstFocusable(root) {
  return root.querySelector('button, input, select, textarea, summary');
}

function defaultTitle(mode) {
  if (mode === 'website') return 'Website map configuration';
  if (mode === 'publish') return 'Publish map configuration';
  return 'Map preferences';
}

function getPath(object, path) {
  return path.split('.').reduce((current, key) => current?.[key], object);
}

function setPath(object, path, value) {
  const parts = path.split('.');
  let current = object;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current[parts[index]] ||= {};
    current = current[parts[index]];
  }
  current[parts.at(-1)] = value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
