import { LitElement, html, css } from 'https://unpkg.com/lit-element@2.4.0/lit-element.js?module';

class PvmPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      narrow: { type: Boolean },
      route: { type: Object },
      panel: { type: Object },
      _config: { type: Object },
      _error: { type: String },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        height: 100%;
        background: var(--primary-background-color);
      }
      iframe {
        width: 100%;
        height: 100%;
        border: 0;
      }
      .error {
        padding: 24px;
        color: var(--error-color);
      }
    `;
  }

  constructor() {
    super();
    this._error = '';
    this._config = null;
  }

  setConfig(config) {
    this._config = config;
  }

  get config() {
    return this._config || (this.panel && this.panel.config) || {};
  }

  get appUrl() {
    const base = (this.config.pvm_url || '').replace(/\/$/, '');
    return base ? `${base}/?embed=ha` : '';
  }

  render() {
    if (!this.appUrl) {
      return html`<div class="error">
        PVM URL ist nicht konfiguriert. Bitte die PVM-Integration neu einrichten.
      </div>`;
    }
    return html`<iframe
      title="PVM"
      src=${this.appUrl}
      allow="clipboard-write"
      @load=${() => (this._error = '')}
    ></iframe>`;
  }
}

customElements.define('pvm-panel', PvmPanel);
