/**
 * PVM sidebar panel element.
 *
 * A self-contained custom element (no external dependencies) that embeds the
 * standalone PVM web UI in an iframe. Keeping it dependency-free means the
 * panel works in offline Home Assistant installations, where loading Lit from
 * a CDN would fail.
 */
const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
  <style>
    :host { display: block; height: 100%; background: var(--primary-background-color); }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
    .error { padding: 24px; color: var(--error-color); }
  </style>
  <div id="root"></div>
`;

class PvmPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));
    this._panel = undefined;
    this._hass = undefined;
  }

  get hass() {
    return this._hass;
  }

  set hass(value) {
    this._hass = value;
  }

  get panel() {
    return this._panel;
  }

  set panel(value) {
    this._panel = value;
    this._render();
  }

  setConfig(config) {
    this.__config = config;
    this._render();
  }

  get _config() {
    return this.__config || (this._panel && this._panel.config) || {};
  }

  get appUrl() {
    const base = (this._config.pvm_url || '').replace(/\/$/, '');
    return base ? `${base}/?embed=ha` : '';
  }

  _render() {
    const root = this.shadowRoot.getElementById('root');
    const url = this.appUrl;
    if (!url) {
      root.innerHTML =
        '<div class="error">PVM URL ist nicht konfiguriert. Bitte die PVM-Integration neu einrichten.</div>';
      return;
    }
    if (root.firstElementChild && root.firstElementChild.tagName === 'IFRAME') {
      return;
    }
    const iframe = document.createElement('iframe');
    iframe.title = 'PVM';
    iframe.src = url;
    iframe.setAttribute('allow', 'clipboard-write');
    root.replaceChildren(iframe);
  }
}

customElements.define('pvm-panel', PvmPanel);
