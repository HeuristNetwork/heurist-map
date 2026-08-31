/**
 * PublishedDialog.js - Published item link dialog
 *
 * @project     Heurist mapping application
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */

/** Show the public URL returned after a successful publication. */
export class PublishedDialog {
  constructor({ publication = {}, parent = null } = {}) {
    this.publication = publication || {};
    this.parent = parent;
  }

  open() {
    this.close();
    const url = String(this.publication.url || '');
    const overlay = document.createElement('div');
    overlay.className = 'heurist-published-overlay';
    const dialog = document.createElement('section');
    dialog.className = 'heurist-published-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Published');

    const title = document.createElement('h2');
    title.textContent = 'Published';
    const text = document.createElement('p');
    text.textContent = 'The publication is available at:';
    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = url;
    input.setAttribute('aria-label', 'Published link');

    const actions = document.createElement('div');
    actions.className = 'heurist-published-actions';
    const copy = makeButton('Copy link', async () => {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else { input.focus(); input.select(); document.execCommand?.('copy'); }
      copy.textContent = 'Copied';
      setTimeout(() => { if (copy.isConnected) copy.textContent = 'Copy link'; }, 1500);
    });
    const open = makeButton('Open', () => { if (url) globalThis.open?.(url, '_blank', 'noopener'); });
    const close = makeButton('Close', () => this.close());
    actions.append(copy, open, close);
    dialog.append(title, text, input, actions);
    overlay.append(dialog);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) this.close(); });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') this.close(); });
    (this.parent || document.body).append(overlay);
    this.element = overlay;
    input.focus(); input.select();
    return this;
  }

  close() {
    this.element?.remove();
    this.element = null;
  }
}

function makeButton(text, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', () => { Promise.resolve(handler()).catch(() => {}); });
  return button;
}
