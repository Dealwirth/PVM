# Installing PVM in Home Assistant via HACS

This repository ships a Home Assistant custom integration under
`custom_components/pvm` and is structured so it can be installed with
[HACS](https://hacs.xyz) as a custom repository. It also passes the official
**HACS Action** and **Hassfest** validations (see
`.github/workflows/hacs.yml` and `.github/workflows/hassfest.yml`).

> PVM has two parts: the **HA integration** (installed through HACS) and the
> **PVM backend** (a standalone Node.js service). HACS installs the
> integration; the backend still has to run somewhere. See
> [installation.md](installation.md) for the backend.

## 1. Start the PVM backend

The integration is only the bridge — it needs a reachable PVM backend. Run it
with Docker (recommended) or Node.js:

```bash
export PVM_API_SECRET="$(openssl rand -hex 32)"
docker compose up --build        # API + UI on http://<host>:7000
```

Note the URL (for example `http://homeassistant.local:7000`) and the
`PVM_API_SECRET`, which is the PVM API token you will paste into HA.

## 2. Add the repository to HACS

1. Open **HACS → Integrations**.
2. Open the three-dot menu → **Custom repositories**.
3. Repository: `https://github.com/Dealwirth/PVM`
4. Category: **Integration** → **Add**.
5. Search for **PVM (PV-Manager)** in HACS and choose **Download**.
6. **Restart Home Assistant.**

HACS copies the files into `config/custom_components/pvm`. The integration's
brand icon (`custom_components/pvm/brand/icon.png`) is shown in the HACS list.

## 3. Add the integration

1. Go to **Settings → Devices & Services → Add Integration**.
2. Search for **PVM**.
3. Enter:
   - **PVM URL** — the backend address, e.g. `http://homeassistant.local:7000`
   - **PVM API token** — the `PVM_API_SECRET` from step 1
   - **Verify TLS certificate** — leave on unless you use a self-signed cert
   - **Update interval (seconds)** — default `30`
4. Finish. PVM appears in the sidebar and exposes its diagnostic sensors and
   `pvm.*` services.

## Updating

HACS shows a new version whenever a GitHub **release** is published. Choose
**Update**, then **Restart Home Assistant**. The integration version is the
`version` field in `custom_components/pvm/manifest.json`.

## Removing

Remove the integration in **HACS → Integrations**, then delete the PVM config
entry under **Settings → Devices & Services**. The backend runs independently
and must be stopped separately.

## Troubleshooting

| Symptom                             | Fix                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `cannot_connect` during setup       | The backend URL is wrong, the backend is down, or `PVM_API_SECRET` does not match. |
| Sidebar panel blank                 | The PVM backend URL must be reachable from the browser.                            |
| `PVM is already configured`         | One entry per backend URL is allowed; edit the existing entry instead.             |
| Reauth prompt after changing secret | Update the token via the entry's **Reconfigure**/reauth flow.                      |

The integration requires Home Assistant **2024.7.0** or newer (declared in
`hacs.json`).
