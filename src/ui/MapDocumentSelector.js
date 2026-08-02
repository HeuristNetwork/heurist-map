/** MapDocumentSelector.js - Render mutually exclusive MapDocument choices. */
export class MapDocumentSelector {
  constructor({ api, container }) { this.api = api; this.container = container; }
  render(documents, activeId) {
    this.container.replaceChildren();
    for (const document of documents) {
      const row = document.createElement ? document : createRow(document, activeId, this.api);
      this.container.append(row);
    }
    if (!documents.length) this.container.append(createEmpty('No map documents'));
  }
}

function createRow(item, activeId, api) {
  const row = document.createElement('div'); row.className = 'heurist-map-document-row';
  const label = document.createElement('label'); label.className = 'heurist-map-row-main';
  const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'heurist-map-document';
  radio.checked = String(item.id) === String(activeId);
  radio.addEventListener('change', () => radio.checked && api.activateMapDocument(item.id));
  const title = document.createElement('span'); title.textContent = item.title;
  label.append(radio, title);
  const actions = document.createElement('span'); actions.className = 'heurist-map-row-actions';
  actions.append(iconButton('fa-solid fa-magnifying-glass-plus', 'Zoom to map document extent', () => api.zoomToMapDocument(item.id)));
  actions.append(iconButton('fa-solid fa-pencil', 'Edit map document (not implemented)', () => api.requestEditMapDocument(item.id)));
  row.append(label, actions); return row;
}

function iconButton(icon, title, handler) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'heurist-map-icon-button'; button.title = title;
  button.innerHTML = `<span class="${icon}" aria-hidden="true"></span>`; button.addEventListener('click', handler); return button;
}
function createEmpty(text) { const e=document.createElement('div'); e.className='heurist-map-empty'; e.textContent=text; return e; }
