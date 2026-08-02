/**
 * MapDocumentSelector.js - Render mutually exclusive MapDocument choices.
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */
export class MapDocumentSelector {
  constructor({ api, container }) {
    this.api = api;
    this.container = container;
  }

  render(documents, activeId, createActiveContent) {
    this.container.replaceChildren();
    for (const item of documents) {
      const active = String(item.id) === String(activeId);
      const block = document.createElement('div');
      block.className = `heurist-map-document-block${active ? ' active' : ''}`;
      block.append(createRow(item, active, this.api));
      if (active && createActiveContent) {
        const content = createActiveContent(item);
        if (content) block.append(content);
      }
      this.container.append(block);
    }
    if (!documents.length) this.container.append(createEmpty('No map documents'));
  }
}

function createRow(item, active, api) {
  const row = document.createElement('div');
  row.className = 'heurist-map-document-row';

  const label = document.createElement('label');
  label.className = 'heurist-map-row-main';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'heurist-map-document';
  radio.checked = active;
  radio.disabled = item.activating === true;
  radio.setAttribute('aria-label', `Activate ${item.title}`);
  radio.addEventListener('change', () => {
    if (radio.checked) api.activateMapDocument(item.id).catch(() => {});
  });

  const status = createDocumentStatus(item);
  const title = document.createElement('span');
  title.className = 'heurist-map-document-title';
  title.textContent = item.title;
  title.title = item.error?.message || item.title;
  label.append(radio, status, title);

  const actions = document.createElement('span');
  actions.className = 'heurist-map-row-actions';
  actions.append(iconButton('fa-solid fa-magnifying-glass-plus', 'Zoom to map document extent', () => api.zoomToMapDocument(item.id)));
  if (active) actions.append(iconButton('fa-solid fa-rotate', 'Reload map document', () => api.reloadMapDocument(item.id).catch(() => {})));
  actions.append(iconButton('fa-solid fa-pencil', 'Edit map document', () => api.requestEditMapDocument(item.id)));
  row.append(label, actions);
  return row;
}

function createDocumentStatus(item) {
  const status = document.createElement('span');
  status.className = 'heurist-map-document-status';
  if (item.activating || item.loadState === 'loading') {
    status.innerHTML = '<span class="heurist-map-spinner" aria-hidden="true"></span>';
    status.title = 'Loading map document';
  } else if (item.loadState === 'error') {
    status.innerHTML = '<span class="fa-solid fa-triangle-exclamation" aria-hidden="true"></span>';
    status.classList.add('state-error');
    status.title = item.error?.message || 'Map document loading failed';
  }
  return status;
}

function iconButton(icon, title, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'heurist-map-icon-button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = `<span class="${icon}" aria-hidden="true"></span>`;
  button.addEventListener('click', (event) => { event.stopPropagation(); handler(event); });
  return button;
}

function createEmpty(text) {
  const element = document.createElement('div');
  element.className = 'heurist-map-empty';
  element.textContent = text;
  return element;
}
