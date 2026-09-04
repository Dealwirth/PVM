/* PVM-Prüf-Sandbox: simulierter Home-Assistant-Kern.
 *
 * Stellt die Teile von HA nach, die panel.js benutzt:
 *   - hass.states           (Entitäten mit state/attributes)
 *   - hass.connection       (sendMessagePromise für pvm/* und call_service)
 *   - Entitäten-Reload      (neue Geräte bekommen ihre Schalter/Sensoren)
 *
 * Benennung, unique_ids und Rollen spiegeln die echten Platform-Module von
 * PVM (custom_components/pvm/panel_data.py + Plattformen) eins zu eins,
 * damit die Sandbox ein realistisches Abbild der Integration ist.
 */
(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Entitäten-Spiegel (identisch zu panel_data.py)
  // ------------------------------------------------------------------
  const PLATFORM = {
    surplus: "sensor", engine_status: "sensor", setup: "sensor",
    rank: "sensor", status: "sensor", up: "button", down: "button",
    auto: "switch", power_charge: "switch", grid_min: "switch",
    grid_deadline: "switch", grid_fallback: "switch",
    comfort: "number", safety: "number", nominal: "number",
    power_limit: "number", min_on_power: "number", min_soc: "number",
    max_soc: "number", deadline_soc: "number", deadline_time: "time",
    test_start: "button", test_abort: "button", wp_test_result: "sensor",
    car_status: "sensor", scan: "button", rebuild: "button",
    mode: "select", theme: "select", reserve: "number", cycle: "number",
    min_on: "number", min_off: "number",
  };
  const GLOBAL_IDS = {
    surplus: "pvm_surplus", engine_status: "pvm_status", setup: "pvm_setup",
    reserve: "pvm_reserve", cycle: "pvm_cycle", min_on: "pvm_min_on",
    min_off: "pvm_min_off", mode: "pvm_mode", theme: "pvm_theme",
    scan: "pvm_scan", rebuild: "pvm_rebuild",
  };
  const DEVICE_PREFIXES = {
    rank: "pvm_rank", status: "pvm_status", up: "pvm_prio_up",
    down: "pvm_prio_down", auto: "pvm_auto", power_charge: "pvm_power_charge",
    grid_min: "pvm_grid_min", grid_deadline: "pvm_grid_deadline",
    grid_fallback: "pvm_grid_fallback", comfort: "pvm_comfort",
    safety: "pvm_safety", nominal: "pvm_nominal",
    power_limit: "pvm_power_limit", min_on_power: "pvm_min_on_power",
    min_soc: "pvm_min_soc", max_soc: "pvm_max_soc",
    deadline_soc: "pvm_deadline_soc", deadline_time: "pvm_deadline_time",
    test_start: "pvm_wp_test_start", test_abort: "pvm_wp_test_abort",
    wp_test_result: "pvm_wp_test_result", car_status: "pvm_car_status",
  };
  // Geräte-Entitäten je Rolle: kind -> Label (friendly_name)
  const ROLE_KINDS = {
    wallbox: [
      ["rank", "PVM Rang"], ["status", "Status"],
      ["auto", "Automatik"], ["power_charge", "Power Charge"],
      ["grid_min", "Netz für Mindest-SOC"], ["grid_deadline", "Netz für Frist-Ziel"],
      ["min_soc", "Mindest-SOC"], ["max_soc", "Max-SOC"],
      ["deadline_soc", "Frist-Ziel-SOC"], ["deadline_time", "Frist-Zeit"],
      ["power_limit", "Max. Ladeleistung"], ["min_on_power", "Mindest-Überschuss"],
      ["up", "Priorität ↑"], ["down", "Priorität ↓"],
    ],
    waermepumpe: [
      ["rank", "PVM Rang"], ["status", "Status"],
      ["auto", "Automatik"], ["grid_fallback", "Netz im Notfall"],
      ["comfort", "Soll-Temperatur"], ["safety", "Notfall-Minimum"],
      ["wp_test_result", "WP-Test"], ["test_start", "WP-Test starten"],
      ["test_abort", "WP-Test abbrechen"],
      ["up", "Priorität ↑"], ["down", "Priorität ↓"],
    ],
    verbraucher: [
      ["rank", "PVM Rang"], ["status", "Status"],
      ["auto", "Automatik"], ["nominal", "Leistung im Betrieb"],
      ["up", "Priorität ↑"], ["down", "Priorität ↓"],
    ],
    fahrzeug: [["car_status", "Status (Auto)"]],
  };
  const GLOBAL_LABEL = {
    surplus: "PVM Überschuss", engine_status: "PVM Status", setup: "PVM Einrichtung",
    reserve: "PVM Reserve", cycle: "PVM Zykluszeit", min_on: "PVM Mindest-Ein",
    min_off: "PVM Mindest-Aus", scan: "PVM Scan", rebuild: "PVM Neuaufbau",
    mode: "PVM Modus", theme: "PVM Design",
  };

  // ------------------------------------------------------------------
  // Welt (Zustand)
  // ------------------------------------------------------------------
  const world = {
    config: null,
    instance: "inst1",
    entities: {},   // entity_id -> {state, attributes}
    scan: { sets: [] },
    setup: "start",
    version: "1.5.0-sandbox",
    carMode: "charging", // "charging" | "away"
    listeners: [],
  };

  function freshEnergy(separate) {
    return separate
      ? {
          grid_mode: "separate",
          pv_sensor: "sensor.solarnet_pv_leistung",
          grid_import_sensor: "sensor.solarnet_leistung_verbrauch",
          grid_export_sensor: "sensor.solarnet_leistung_netzeinspeisung",
          house_sensor: null,
          battery_power_sensor: null,
          battery_soc_sensor: null,
          grid_sensor: null,
          grid_kind: "net",
        }
      : {
          grid_mode: "combined",
          pv_sensor: "sensor.solarnet_pv_leistung",
          grid_sensor: "sensor.solarnet_leistung_netz",
          grid_import_sensor: null,
          grid_export_sensor: null,
          house_sensor: null,
          battery_power_sensor: null,
          battery_soc_sensor: null,
          grid_kind: "net",
        };
  }

  function defaultDevice(role, name) {
    return {
      id: "",
      name,
      role,
      enabled: true,
      control: { type: "switch", switch_entity: null, number_entity: null, on_entity: null, off_entity: null, number_unit: "W", phases: 3 },
      sensors: { power: null, soc: null, temp: null },
      limits: { power_limit_w: 11000, min_on_power_w: 1400, min_on_s: 120, min_off_s: 60 },
      car: null,
      wp: null,
    };
  }

  function scenarioConfig(separate) {
    const energy = freshEnergy(separate);
    const wallbox = defaultDevice("wallbox", "Wallbox Garage");
    wallbox.id = "wb1";
    wallbox.sensors = { power: "sensor.wallbox_garage_leistung", soc: "sensor.auto_soc", temp: null };
    wallbox.control = { type: "switch", switch_entity: "switch.wallbox_garage_freigabe", number_entity: "number.wallbox_garage_max", on_entity: null, off_entity: null, number_unit: "A", phases: 3 };
    wallbox.car = { capacity_kwh: 60, min_soc: 30, max_soc: 80, min_charge_power_w: 4000, grid_min_allowed: true, grid_deadline_allowed: true, manual_force: false, deadline_time: null, deadline_soc: 0 };
    const auto = defaultDevice("fahrzeug", "Enyaq");
    auto.id = "car1";
    auto.sensors = { power: "sensor.auto_leistung", soc: "sensor.auto_soc", temp: null };
    auto.car = { capacity_kwh: 62, min_soc: 30, max_soc: 80, min_charge_power_w: 4000, grid_min_allowed: true, grid_deadline_allowed: true, manual_force: false, deadline_time: null, deadline_soc: 0 };
    return {
      energy,
      settings: {
        mode: "auto", reserve_w: 100, cycle_s: 30, min_on_s: 120, min_off_s: 60,
        wp_test_target_c: 70, wp_test_max_duration_min: 120, ui_theme: "ha",
      },
      devices: separate ? [wallbox, auto] : [wallbox, auto],
      wp_test_results: {},
    };
  }

  // ------------------------------------------------------------------
  // Entitäten anlegen (Spiegel der Plattform-Setups)
  // ------------------------------------------------------------------
  const GLOBAL_DEFAULT = {
    surplus: ["1600", { unit_of_measurement: "W" }],
    engine_status: ["Läuft", {}],
    setup: ["Bereit", {}],
    mode: ["Auto", { options: ["Auto", "Nur Überschuss", "Nur Ziele", "Aus"] }],
    theme: ["Home Assistant", { options: ["Home Assistant", "Sonnenaufgang", "Natur-frisch", "Kühl & klar"] }],
  };

  function ensureEntity(id, name, state, attrs) {
    if (world.entities[id]) return world.entities[id];
    const e = {
      entity_id: id,
      state: state == null ? "" : String(state),
      attributes: Object.assign({ friendly_name: name }, attrs || {}),
      last_updated: new Date().toISOString(),
    };
    world.entities[id] = e;
    return e;
  }

  function globalEntityId(key) {
    return PLATFORM[key] + "." + GLOBAL_IDS[key];
  }
  function deviceEntityId(kind, devId) {
    return PLATFORM[kind] + "." + DEVICE_PREFIXES[kind] + "_" + devId;
  }

  function buildEntities(config) {
    // Globale Entitäten (unique_id -> entity_id wie im echten HA)
    Object.keys(GLOBAL_IDS).forEach((key) => {
      const def = GLOBAL_DEFAULT[key];
      ensureEntity(
        globalEntityId(key),
        GLOBAL_LABEL[key],
        def ? def[0] : (PLATFORM[key] === "button" ? "" : "0"),
        def ? def[1] : {}
      );
    });
    // Geräte-Entitäten
    (config.devices || []).forEach((d) => {
      const devId = d.id;
      if (!devId) return;
      const kinds = ROLE_KINDS[d.role] || [];
      kinds.forEach(([kind, label]) => {
        const id = deviceEntityId(kind, devId);
        const e = ensureEntity(id, d.name + " – " + label, "", {});
        if (kind === "status") e.state = "wartet auf PVM";
        else if (kind === "car_status") e.state = "unterwegs";
        else if (kind === "rank") e.state = "1";
        else if (kind === "auto") e.state = "on";
        else if (PLATFORM[kind] === "button") e.state = "";
        else if (PLATFORM[kind] === "number") e.state = "50";
        else if (kind === "deadline_time") e.state = "18:00:00";
        else if (PLATFORM[kind] === "switch") e.state = "off";
      });
    });
    // Fremd-Entitäten (Sensoren des Nutzers)
    ensureEntity("sensor.solarnet_pv_leistung", "SolarNet PV-Leistung", "5.2", { unit_of_measurement: "kW", device_class: "power" });
    ensureEntity("sensor.solarnet_leistung_netzeinspeisung", "SolarNet Leistung Netzeinspeisung", "2.1", { unit_of_measurement: "kW", device_class: "power" });
    ensureEntity("sensor.solarnet_leistung_verbrauch", "SolarNet Leistung Verbrauch", "0.3", { unit_of_measurement: "kW", device_class: "power" });
    ensureEntity("sensor.solarnet_leistung_netz", "SolarNet Leistung Netz", "-2.1", { unit_of_measurement: "kW", device_class: "power" });
    ensureEntity("sensor.wallbox_garage_leistung", "Wallbox Garage Leistung", "4.6", { unit_of_measurement: "kW", device_class: "power" });
    ensureEntity("sensor.auto_leistung", "Enyaq Ladeleistung", "4.6", { unit_of_measurement: "kW", device_class: "power" });
    ensureEntity("sensor.auto_soc", "Enyaq Akku", "62", { unit_of_measurement: "%", device_class: "battery" });
    ensureEntity("switch.wallbox_garage_freigabe", "Wallbox Garage Freigabe", "on");
    ensureEntity("number.wallbox_garage_max", "Wallbox Garage Max", "16", { unit_of_measurement: "A" });
    ensureEntity("switch.poolpumpe", "Poolpumpe", "off");
  }

  function entityMapFor(config) {
    // Wie panel_data.build_entity_map
    const map = {};
    Object.keys(GLOBAL_IDS).forEach((k) => { map[k] = globalEntityId(k); });
    map.devices = {};
    (config.devices || []).forEach((d) => {
      const devId = d.id;
      if (!devId) return;
      const m = {};
      const kinds = ROLE_KINDS[d.role] || [];
      kinds.forEach(([kind]) => { m[kind] = deviceEntityId(kind, devId); });
      map.devices[devId] = m;
    });
    return map;
  }

  // ------------------------------------------------------------------
  // Reload simulieren (neue Geräte bekommen Entitäten)
  // ------------------------------------------------------------------
  function simulateReload() {
    world.instance = "inst" + Math.random().toString(36).slice(2, 8);
    buildEntities(world.config);
    return world.instance;
  }

  function scanSetsFor(config) {
    const sep = config.energy.grid_mode === "separate";
    const sets = [];
    sets.push({ role: "pv", title: "SolarNet PV-Leistung", fields: { entity: "sensor.solarnet_pv_leistung" } });
    if (sep) {
      sets.push({ role: "grid_import", title: "SolarNet Netzbezug", fields: { entity: "sensor.solarnet_leistung_verbrauch" } });
      sets.push({ role: "grid_export", title: "SolarNet Netzeinspeisung", fields: { entity: "sensor.solarnet_leistung_netzeinspeisung" } });
    } else {
      sets.push({ role: "grid", title: "SolarNet Leistung Netz", fields: { entity: "sensor.solarnet_leistung_netz" } });
    }
    sets.push({ role: "verbraucher", title: "Poolpumpe", fields: { switch_entity: "switch.poolpumpe", power_sensor: null } });
    return sets;
  }

  function listEntitiesFor() {
    return Object.keys(world.entities).map((id) => {
      const e = world.entities[id];
      return {
        entity_id: id,
        name: e.attributes.friendly_name || id,
        device_class: e.attributes.device_class || "",
        unit_of_measurement: e.attributes.unit_of_measurement || "",
        state_value: e.state,
        device_name: "",
        integration: "sandbox",
      };
    });
  }

  // ------------------------------------------------------------------
  // Auto-Situation umschalten (unterwegs / lädt an Wallbox Garage)
  // ------------------------------------------------------------------
  function applyCarMode(mode) {
    world.carMode = mode;
    const statusEnt = world.entities["sensor.pvm_car_status_car1"];
    const carPwr = world.entities["sensor.auto_leistung"];
    const wallPwr = world.entities["sensor.wallbox_garage_leistung"];
    if (mode === "charging") {
      if (statusEnt) {
        statusEnt.state = "lädt an Wallbox Garage";
        statusEnt.attributes.wallbox_id = "wb1";
      }
      if (carPwr && wallPwr) carPwr.state = wallPwr.state;
    } else {
      if (statusEnt) {
        statusEnt.state = "unterwegs";
        statusEnt.attributes.wallbox_id = null;
      }
      if (carPwr) carPwr.state = "0.0";
    }
  }

  // ------------------------------------------------------------------
  // Konfiguration / Kommandos
  // ------------------------------------------------------------------
  function loadScenario(separate) {
    world.config = scenarioConfig(separate);
    world.scan = { sets: scanSetsFor(world.config) };
    world.entities = {};
    simulateReload();
    applyCarMode(world.carMode === "charging" ? "charging" : "away");
    world.setup = "bereit";
    refreshUi();
  }

  function applyService(msg) {
    const { domain, service, service_data: data } = msg;
    const id = data && data.entity_id;
    if (!id) return;
    const ent = world.entities[id];
    if (!ent) return;
    if (domain === "switch") {
      if (service === "turn_on") ent.state = "on";
      if (service === "turn_off") ent.state = "off";
    } else if (domain === "number" && service === "set_value" && data.value != null) {
      ent.state = String(data.value);
    } else if (domain === "select" && service === "select_option") {
      ent.state = data.option;
    } else if (domain === "button" && service === "press") {
      log("🔘 gedrückt: " + id);
    }
  }

  async function handleWs(msg) {
    const t = msg.type || "";
    if (t === "call_service") {
      applyService(msg);
      return { result: null };
    }
    if (t === "subscribe_events") {
      return { result: null };
    }
    if (t === "pvm/get_config") {
      return { result: payload() };
    }
    if (t === "pvm/list_entities") {
      return { result: { entities: listEntitiesFor() } };
    }
    if (t === "pvm/save_config") {
      world.config = msg.config || world.config;
      world.scan = { sets: scanSetsFor(world.config) };
      log("💾 Konfiguration gespeichert (Geräte: " + (world.config.devices || []).length + ")");
      return { result: { ok: true, instance: world.instance } };
    }
    if (t === "pvm/reload") {
      log("🔄 Entitäten-Reload …");
      simulateReload();
      applyCarMode(world.carMode);
      return { result: { ok: true, instance: world.instance } };
    }
    if (t === "pvm/scan") {
      world.scan = { sets: scanSetsFor(world.config) };
      return { result: world.scan };
    }
    if (t === "auth") return { result: true };
    return { result: { ok: true } };
  }

  function payload() {
    return {
      config: world.config,
      entities: entityMapFor(world.config),
      scan: world.scan,
      setup: world.setup,
      version: world.version,
      instance: world.instance,
    };
  }

  // ------------------------------------------------------------------
  // hass-Objekt (wie HA es dem Panel reicht)
  // ------------------------------------------------------------------
  function makeHass() {
    const hass = {
      connection: {
        sendMessagePromise: async (msg) => {
          const r = await handleWs(msg);
          return r && r.result;
        },
        subscribeMessage: async () => {
          return { unsubscribe: () => {} };
        },
      },
      hassUrl: (path) => (window.top ? window.top.location.origin : "") + (path || "/"),
      states: world.entities,
    };
    return hass;
  }

  // Live-Ticker: Werte regelmäßig leicht ändern (wie state_changed-Events)
  let tick = 0;
  setInterval(() => {
    tick += 1;
    const pv = world.entities["sensor.solarnet_pv_leistung"];
    if (pv) pv.state = String((5.2 + Math.sin(tick / 3) * 1.8).toFixed(2));
    const sep = world.config && world.config.energy && world.config.energy.grid_mode === "separate";
    const grid = world.entities[sep ? "sensor.solarnet_leistung_netzeinspeisung" : "sensor.solarnet_leistung_netz"];
    if (grid && sep) grid.state = String((2.1 + Math.sin(tick / 4) * 1.2).toFixed(2));
    if (grid && !sep) grid.state = String((-2.1 - Math.sin(tick / 4) * 1.2).toFixed(2));
    const wall = world.entities["sensor.wallbox_garage_leistung"];
    if (wall) wall.state = String((4.6 + Math.sin(tick / 5) * 0.9).toFixed(2));
    if (world.carMode === "charging") {
      const carPwr = world.entities["sensor.auto_leistung"];
      if (wall && carPwr) carPwr.state = wall.state;
      const soc = world.entities["sensor.auto_soc"];
      if (soc) soc.state = String(Math.min(99, Math.round((62 + tick / 30) * 10) / 10));
    }
    // Live-Update: die 1-s-Live-Schleife der Seite liest hass.states direkt
  }, 1000);

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  function log(text) {
    const el = document.getElementById("log");
    if (el) el.textContent = new Date().toLocaleTimeString() + "  " + text;
  }

  function refreshUi() {
    const host = document.getElementById("host");
    host.innerHTML = "";
    const panel = document.createElement("pvm-panel");
    panel.hass = makeHass();
    host.appendChild(panel);
    log("✅ Bereit – Instanz " + world.instance + ", Geräte: " + (world.config.devices || []).length);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-scenario]").forEach((btn) => {
      btn.addEventListener("click", () => {
        loadScenario(btn.getAttribute("data-scenario") === "separate");
      });
    });
    document.querySelectorAll("[data-car]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-car");
        world.config = world.config || scenarioConfig(true);
        world.entities = world.entities || {};
        // Auto-Sensor-Entitäten sicherstellen, falls das Szenario sie noch nicht kennt
        if (!world.entities["sensor.pvm_car_status_car1"]) simulateReload();
        applyCarMode(mode);
        log("🚗 Auto jetzt: " + (mode === "charging" ? "lädt an Wallbox Garage" : "unterwegs"));
      });
    });
    document.querySelector("[data-reset]").addEventListener("click", () => {
      loadScenario(true);
    });
    loadScenario(true);
  });
})();
