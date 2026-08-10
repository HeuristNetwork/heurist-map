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
    mode = 'preferences', value = null, parent = null, title = null,
    onSave = null, onCancel = null
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
    this.advanced = false;
  }

  setValue(value) {
    this.value = normalizeMapConfigurationSettings(value || {});
    if (this.form) this.populate();
    return this;
  }

  getValue() {
    if (this.form) this.value = normalizeMapConfigurationSettings(this.readForm());
    return clone(this.value);
  }

  serialize() { return serializeMapConfigurationSettings(this.getValue()); }

  open() {
    if (typeof document === 'undefined') throw new Error('MapConfigurationDialog requires a browser document');
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
    this.form.addEventListener('submit', (event) => { event.preventDefault(); void this.save(); });
    this.form.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); this.cancel(); }
    });

    this.form.append(this.buildAdvancedPanel());
    this.buildSections();

    const footer = document.createElement('footer');
    footer.className = 'heurist-map-config-footer';
    footer.append(button('Cancel', 'Cancel', () => this.cancel()), submitButton(submitLabel(this.mode)));
    this.form.append(footer);
    this.dialog.append(header, this.form);
    this.element.append(this.dialog);

    (this.parent || document.body).append(this.element);
    this.populate();
    this.updateAdvancedVisibility();
    firstFocusable(this.dialog)?.focus();
    return this;
  }

  buildAdvancedPanel() {
    const panel = document.createElement('div');
    panel.className = 'heurist-map-config-advanced-panel';
    const label = document.createElement('label');
    label.className = 'heurist-map-config-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.advanced;
    input.addEventListener('change', () => {
      this.advanced = input.checked;
      this.updateAdvancedVisibility();
    });
    label.append(input, document.createTextNode('Advanced settings'));
    panel.append(label);
    return panel;
  }

  cancel() {
    const value = this.getValue();
    this.close();
    this.onCancel?.(value, { mode: this.mode });
  }

  async save() {
    try {
      const value = this.getValue();
      const result = await this.onSave?.(value, { mode: this.mode, serialized: serializeMapConfigurationSettings(value) });
      if (result === false) return false;
      this.close();
      return value;
    } catch (error) {
      this.showError(error?.message || String(error));
      return false;
    }
  }

  close() {
    this.element?.remove();
    this.element = this.dialog = this.form = null;
    this.fields.clear();
    if (this.previousFocus?.focus) this.previousFocus.focus();
    this.previousFocus = null;
  }

  buildSections() {
    this.form.append(
      this.section('Interface', (body) => this.buildInterface(body), { open: true }),
      this.section('Current Results Map', (body) => this.buildCurrentResults(body), { open: true }),
      this.section('Default settings', (body) => this.buildDefaults(body), { open: true }),
      this.section('Map documents', (body) => this.buildMapDocuments(body), { advanced: true }),
      this.section('Base maps', (body) => this.buildBaseMaps(body), { advanced: true }),
      this.section('Interaction', (body) => this.buildInteraction(body), { advanced: true })
    );
  }

  buildCurrentResults(body) {
    this.checkbox(body, 'config.dynamicDocument.enabled', 'Enable current-results document', { hidden: true });
    this.text(body, 'config.dynamicDocument.title', 'Title');
    this.zoomFields(body, 'config.dynamicDocument', { allAdvanced: true });
    this.boundsFields(body, 'config.dynamicDocument.bounds', { advanced: true });
  }

  buildDefaults(body) {
    const pointExtent = this.number(body, 'config.defaults.zoomToPointInKM', 'Point selection extent (km)', { min: 0 });
    pointExtent.classList.add('heurist-map-config-inline-number', 'heurist-map-config-narrow-number');
    this.json(body, 'config.defaults.symbology', 'Default symbology');
    this.json(body, 'config.defaults.selectSymbology', 'Select symbology', { advanced: true });
    this.checkbox(body, 'config.defaults.preventContinuousWorldBasemap', 'Prevent continuous world basemap', { advanced: true });
    this.checkbox(body, 'config.defaults.markerClustering', 'Marker clustering');
    this.select(body, 'config.defaults.maxAllowedFeatures', 'Maximum allowed features', [
      ['10', '10'], ['500', '500'], ['1000', '1,000'], ['2000', '2,000'], ['5000', '5,000']
    ], { kind: 'positive-int' });
    this.checkbox(body, 'config.defaults.dynamicRequests', 'Dynamic requests', { advanced: true });
    this.textarea(body, 'config.defaults.popupTemplate', 'Popup template', { advanced: true });
  }

  buildMapDocuments(body) {
    this.text(body, 'options.mapDocuments.allowed', 'Allowed MapDocument IDs', {
      placeholder: 'All (or comma-separated record IDs)', kind: 'list-number'
    });
    this.text(body, 'options.mapDocuments.initiallyActive', 'Default document', {
      placeholder: 'Current results (default) or record ID', kind: 'identifier'
    });
  }

  buildBaseMaps(body) {
    this.text(body, 'options.baseMaps.allowed', 'Allowed base maps', {
      placeholder: 'All (or comma-separated IDs/names)', kind: 'list-string'
    });
    this.text(body, 'options.baseMaps.initial', 'Initial base map', { placeholder: 'Default' });
  }

  buildInterface(body) {
    const controls = document.createElement('fieldset');
    controls.className = 'heurist-map-config-group heurist-map-config-controls-group';
    controls.append(legend('Show map controls'));
    this.checkbox(controls, 'options.ui.enabled', 'Show map controls');

    const primary = document.createElement('div');
    primary.className = 'heurist-map-config-inline-checks';
    this.checkbox(primary, 'options.ui.showCurrentDocument', 'Current results');
    this.checkbox(primary, 'options.ui.showMapDocuments', 'Map documents');
    this.checkbox(primary, 'options.ui.showBaseMaps', 'Base maps');
    this.checkbox(primary, 'options.ui.showLegend', 'Legend');
    controls.append(primary);

    this.checkbox(controls, 'options.ui.initiallyExpanded', 'Initially expanded');

    const secondary = document.createElement('div');
    secondary.className = 'heurist-map-config-inline-checks';
    this.checkbox(secondary, 'options.ui.showZoomControl', 'Zoom control');
    this.checkbox(secondary, 'options.ui.showSearch', 'Search');
    this.checkbox(secondary, 'options.ui.showPublish', 'Publish');
    controls.append(secondary);

    this.checkbox(controls, 'options.ui.showLayers', 'Show layers', { hidden: true });
    this.select(controls, 'options.ui.placement', 'Control placement', [
      ['overlay', 'Overlay'], ['side', 'Side panel']
    ], { hidden: true });
    this.select(controls, 'options.ui.position', 'Control position', [
      ['top-left', 'Top left'], ['top-right', 'Top right'],
      ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']
    ], { hidden: true });
    this.textarea(controls, 'options.ui.controlCss', 'CSS for Map Control', { advanced: true });
    body.append(controls);
  }

  buildInteraction(body) {
    this.checkbox(body, 'options.interaction.selectionEnabled', 'Enable selection');
    this.checkbox(body, 'options.interaction.popupEnabled', 'Enable popups');
    this.checkbox(body, 'options.interaction.zoomOnSelection', 'Zoom on selection');
  }

  zoomFields(body, prefix, options = {}) {
    const row = document.createElement('div');
    row.className = 'heurist-map-config-grid';
    this.number(row, `${prefix}.minZoom`, 'Min zoom level', { min: 0, max: 22, step: 1, compact: true, advanced: options.allAdvanced === true });
    this.number(row, `${prefix}.maxZoom`, 'Max zoom level', { min: 0, max: 22, step: 1, compact: true, advanced: options.allAdvanced === true });
    this.number(row, `${prefix}.minimumZoomKm`, 'Zoom-in limit (km)', { min: 0, compact: true, advanced: options.allAdvanced === true || options.kmAdvanced === true });
    this.number(row, `${prefix}.maximumZoomKm`, 'Zoom-out limit (km)', { min: 0, compact: true, advanced: options.allAdvanced === true || options.kmAdvanced === true });
    body.append(row);
  }

  boundsFields(body, prefix, options = {}) {
    const row = document.createElement('div');
    row.className = 'heurist-map-config-grid heurist-map-config-bounds';
    if (options.advanced) this.markAdvanced(row);
    for (const [key, labelText] of [['west', 'West'], ['south', 'South'], ['east', 'East'], ['north', 'North']]) {
      this.number(row, `${prefix}.${key}`, labelText, { compact: true });
    }
    body.append(row);
  }

  section(title, build, options = {}) {
    const details = document.createElement('details');
    details.className = 'heurist-map-config-section';
    details.open = options.open === true;
    if (options.advanced) this.markAdvanced(details);
    const summary = document.createElement('summary');
    summary.textContent = title;
    const body = document.createElement('div');
    body.className = 'heurist-map-config-section-body';
    build(body);
    details.append(summary, body);
    return details;
  }

  checkbox(body, path, labelText, options = {}) {
    const row = document.createElement('label');
    row.className = 'heurist-map-config-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    this.register(path, input, 'boolean');
    row.append(input, document.createTextNode(labelText));
    this.decorate(row, options);
    body.append(row);
    return row;
  }

  select(body, path, labelText, choices, options = {}) {
    const { row, control } = labelledControl('select', labelText);
    for (const [value, text] of choices) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      control.append(option);
    }
    this.register(path, control, options.kind || 'string');
    this.decorate(row, options);
    body.append(row);
    return row;
  }

  text(body, path, labelText, options = {}) {
    const { row, control } = labelledControl('input', labelText);
    control.type = 'text';
    if (options.placeholder) control.placeholder = options.placeholder;
    this.register(path, control, options.kind || 'string-null');
    this.decorate(row, options);
    body.append(row);
    return row;
  }

  textarea(body, path, labelText, options = {}) {
    const { row, control } = labelledControl('textarea', labelText);
    control.rows = 3;
    this.register(path, control, 'string-null');
    this.decorate(row, options);
    body.append(row);
    return row;
  }

  json(body, path, labelText, options = {}) {
    const { row, control } = labelledControl('textarea', labelText);
    control.rows = 3;
    control.placeholder = 'JSON (optional)';
    this.register(path, control, 'json');
    this.decorate(row, options);
    body.append(row);
    return row;
  }

  number(body, path, labelText, options = {}) {
    const { row, control } = labelledControl('input', labelText);
    control.type = 'number';
    control.step = options.step ?? 'any';
    if (options.min !== undefined) control.min = String(options.min);
    if (options.max !== undefined) control.max = String(options.max);
    if (options.compact) row.classList.add('compact');
    this.register(path, control, path.endsWith('maxAllowedFeatures') ? 'positive-int' : 'number-null');
    this.decorate(row, options);
    body.append(row);
    return row;
  }

  decorate(element, options = {}) {
    if (options.advanced) this.markAdvanced(element);
    if (options.hidden) element.hidden = true;
  }

  markAdvanced(element) {
    element.dataset.advancedSetting = '1';
    return element;
  }

  updateAdvancedVisibility() {
    if (!this.form) return;
    for (const element of this.form.querySelectorAll('[data-advanced-setting="1"]')) {
      element.hidden = !this.advanced;
    }
  }

  register(path, control, kind) {
    control.dataset.configPath = path;
    this.fields.set(path, { control, kind });
  }

  populate() {
    for (const [path, field] of this.fields) {
      const current = getPath(this.value, path);
      if (field.kind === 'boolean') field.control.checked = current === true;
      else if (field.kind === 'json') field.control.value = current == null ? '' : JSON.stringify(current, null, 2);
      else if (field.kind.startsWith('list-')) field.control.value = Array.isArray(current) ? current.join(', ') : '';
      else field.control.value = current == null ? '' : String(current);
    }
  }

  readForm() {
    const result = { options: {}, config: {} };
    for (const [path, field] of this.fields) setPath(result, path, readControl(field, path));
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

function legend(text) { const item = document.createElement('legend'); item.textContent = text; return item; }
function button(text, title, handler) {
  const item = document.createElement('button');
  item.type = 'button'; item.textContent = text; item.title = title; item.addEventListener('click', handler); return item;
}
function submitButton(text) { const item = document.createElement('button'); item.type = 'submit'; item.className = 'primary'; item.textContent = text; return item; }
function submitLabel(mode) { return mode === 'publish' ? 'Publish' : mode === 'website' ? 'Save' : 'Apply'; }
function firstFocusable(root) { return root.querySelector('button, input, select, textarea, summary'); }
function defaultTitle(mode) { return mode === 'website' ? 'Website map configuration' : mode === 'publish' ? 'Publish map configuration' : 'Map preferences'; }
function getPath(object, path) { return path.split('.').reduce((current, key) => current?.[key], object); }
function setPath(object, path, value) {
  const parts = path.split('.'); let current = object;
  for (let index = 0; index < parts.length - 1; index += 1) { current[parts[index]] ||= {}; current = current[parts[index]]; }
  current[parts.at(-1)] = value;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
