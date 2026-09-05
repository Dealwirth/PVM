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
    version: "1.9.0-sandbox",
    carMode: "charging", // "charging" | "away"
    listeners: [],
  };

  // Kleine PV-Tageskurve für die Verlaufs- und Prognose-Darstellung (kW)
  function pvCurveAt(hourFloat) {
    const day = Math.sin(((hourFloat - 6.5) / 11.5) * Math.PI); // Sonnenaufgang ~6:30
    return Math.max(0, day) * 6.1;
  }

  // Sandbox-Sonnenzeit: Egal, wann du die Vorschau öffnest – „jetzt“ ist immer
  // 11:00 Uhr Solarzeit. So zeigen Verlauf und Prognose auch abends/nachts eine
  // plausible Tageskurve (die Demo bleibt jederzeit aussagekräftig).
  function solarHour(ts) {
    const realNow = new Date();
    const realH = realNow.getHours() + realNow.getMinutes() / 60;
    const d = new Date(ts);
    const real = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    let h = real + (11.0 - realH);
    while (h < 0) h += 24;
    while (h >= 24) h -= 24;
    return h;
  }

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
    const base = {
      id: "",
      name,
      role,
      enabled: true,
      control: { type: "switch", switch_entity: null, number_entity: null, on_entity: null, off_entity: null, temp_entity: null, has_limiter: false, number_unit: "W", phases: 3 },
      sensors: { power: null, soc: null, temp: null },
      limits: { power_limit_w: 11000, min_on_power_w: 1400, min_on_s: 120, min_off_s: 60 },
      car: null,
      wp: null,
    };
    if (role === "waermepumpe") base.wp = { comfort_c: 60, safety_min_c: 60, est_power_w: 2000, grid_fallback_allowed: true, boost_c: 65 };
    return base;
  }

  function scenarioConfig(separate) {
    const energy = freshEnergy(separate);
    const wallbox = defaultDevice("wallbox", "Wallbox Garage");
    wallbox.id = "wb1";
    wallbox.sensors = { power: "sensor.wallbox_garage_leistung", soc: null, temp: null };
    wallbox.control = { type: "switch", switch_entity: "switch.wallbox_garage_freigabe", number_entity: "number.wallbox_garage_max", on_entity: null, off_entity: null, temp_entity: null, has_limiter: true, number_unit: "A", phases: 3 };
    const auto = defaultDevice("fahrzeug", "Enyaq");
    auto.id = "car1";
    auto.sensors = { power: "sensor.auto_leistung", soc: "sensor.auto_soc", temp: null };
    auto.car = { capacity_kwh: 62, min_soc: 30, max_soc: 80, min_charge_power_w: 4000, grid_min_allowed: true, grid_deadline_allowed: true, manual_force: false, deadline_time: null, deadline_soc: 0, home_wallbox: "wb1" };
    const wp = defaultDevice("waermepumpe", "Wärmepumpe");
    wp.id = "wp1";
    wp.sensors = { power: null, soc: null, temp: "sensor.wp_vorlauf" };
    wp.control = { type: "wp_temp", switch_entity: null, number_entity: null, on_entity: null, off_entity: null, temp_entity: "number.wp_soll", has_limiter: false, number_unit: "W", phases: 3 };
    return {
      energy,
      settings: {
        mode: "auto", reserve_w: 100, cycle_s: 30, min_on_s: 120, min_off_s: 60,
        ui_theme: "ha", accent: "auto", accent_custom: "", intro_done: false,
        auto_pairing: false, manual_mode: false, forecast_enabled: false,
        forecast_api_key: "", pre_charge: true,
      },
      devices: separate ? [wallbox, auto, wp] : [wallbox, auto, wp],
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
    ensureEntity("sensor.wp_vorlauf", "Wärmepumpe Vorlauf", "52.0", { unit_of_measurement: "°C", device_class: "temperature" });
    ensureEntity("number.wp_soll", "Wärmepumpe Soll-Temperatur", "60.0", { unit_of_measurement: "°C", min: 30, max: 70, step: 0.5 });
    ensureEntity("sensor.haus_leistung", "Haus Leistung", "1.8", { unit_of_measurement: "kW", device_class: "power" });
    ensureEntity("sensor.pv_zaehlerstand", "PV Zählerstand (falsche Einheit)", "12.4", { unit_of_measurement: "kWh", device_class: "energy" });
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
    sets.push({ role: "house", title: "Haus Leistung", fields: { entity: "sensor.haus_leistung" } });
    sets.push({ role: "house", title: "Haus Zählerstand (kWh – Testschutz)", fields: { entity: "sensor.pv_zaehlerstand" } });
    if (sep) {
      sets.push({ role: "grid_import", title: "SolarNet Netzbezug", fields: { entity: "sensor.solarnet_leistung_verbrauch" } });
      sets.push({ role: "grid_export", title: "SolarNet Netzeinspeisung", fields: { entity: "sensor.solarnet_leistung_netzeinspeisung" } });
    } else {
      sets.push({ role: "grid", title: "SolarNet Leistung Netz", fields: { entity: "sensor.solarnet_leistung_netz" } });
    }
    sets.push({ role: "verbraucher", title: "Poolpumpe", fields: { switch_entity: "switch.poolpumpe", power_sensor: null } });
    sets.push({ role: "wp", title: "Wärmepumpe", fields: { temp_sensor: "sensor.wp_vorlauf", temp_entity: "number.wp_soll", switch_entity: null } });
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
  }  // pvm/control – wie im echten Backend (Manager.device_control)
  function applyPvmControl(msg) {
    const dev = (world.config.devices || []).find((d) => d.id === msg.device_id);
    if (!dev) return { ok: false, msg: "Gerät nicht gefunden." };
    const kind = msg.kind || "";
    if (kind === "dev_mode") {
      dev.enabled = !!msg.auto;
      const autoEnt = world.entities[deviceEntityId("auto", dev.id)];
      if (autoEnt) autoEnt.state = msg.auto ? "on" : "off";
      log("🔀 " + dev.name + " → " + (msg.auto ? "Automatik" : "Manuell"));
      refreshUi();
      return { ok: true, msg: msg.auto ? "Automatik an – PVM steuert wieder" : "Manuell – du steuerst jetzt selbst" };
    }
    const c = dev.control || {};
    if (kind === "start" || kind === "stop" || kind === "on" || kind === "off") {
      const entity = c.type === "buttons"
        ? (kind === "start" ? c.on_entity : c.off_entity)
        : c.switch_entity;
      if (!entity) return { ok: false, msg: "Steuerelement nicht konfiguriert." };
      const ent = world.entities[entity];
      if (ent) {
        if (ent.attributes && ent.attributes.domain_hint === "button") log("🔘 gedrückt: " + entity);
        else ent.state = (kind === "start" || kind === "on") ? "on" : "off";
      }
      log("⚡ " + dev.name + " → " + kind);
      refreshUi();
      return { ok: true, msg: "Gesendet." };
    }
    if (kind === "temp_ziel" || kind === "limit") {
      const entity = kind === "temp_ziel" ? c.temp_entity : c.number_entity;
      if (!entity) return { ok: false, msg: "Steuerelement nicht konfiguriert." };
      const ent = world.entities[entity];
      if (ent) ent.state = String(msg.value);
      const unit = ent && ent.attributes ? ent.attributes.unit_of_measurement || "" : "";
      log("🎚️ " + dev.name + " → " + msg.value + " " + unit);
      refreshUi();
      return { ok: true, msg: (kind === "temp_ziel" ? "Temperatur gesetzt: " : "Leistung gesetzt: ") + msg.value + " " + unit };
    }
    return { ok: false, msg: "Unbekannter Befehl." };
  }

  function mockEnergySuggest() {
    const e = world.config.energy || {};
    const sugg = {};
    if (!e.pv_sensor) sugg.pv = "sensor.solarnet_pv_leistung";
    if (!e.grid_sensor && e.grid_mode !== "separate") sugg.grid = "sensor.solarnet_leistung_netz";
    if (!e.grid_import_sensor && e.grid_mode === "separate") sugg.grid_import = "sensor.solarnet_leistung_verbrauch";
    if (!e.grid_export_sensor && e.grid_mode === "separate") sugg.grid_export = "sensor.solarnet_leistung_netzeinspeisung";
    if (!e.house_sensor) sugg.house = "sensor.haus_leistung";
    const warns = ["Hausverbrauch: sensor.pv_zaehlerstand liefert einen Zählerstand (kWh) statt einer Leistung – das wäre für die Anzeige falsch."];
    return { suggestions: sugg, warn: warns, auto: { ...sugg } };
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
      // Scan NICHT neu erzeugen – wie im echten HA bleibt die „Gefunden“-
      // Liste bis zum nächsten „Jetzt suchen“ unverändert (sonst kämen
      // übernommene Einträge nach dem Speichern sofort wieder).
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
    if (t === "pvm/forecast") {
      return { result: mockForecast() };
    }
    if (t === "pvm/analysis") {
      return { result: mockAnalysis() };
    }
    if (t === "pvm/forecast_refresh") {
      return { result: mockForecast() };
    }
    if (t === "pvm/control") {
      return { result: applyPvmControl(msg) };
    }
    if (t === "pvm/energy_suggest") {
      return { result: mockEnergySuggest() };
    }
    if (t === "history/history_during_period") {
      return { result: mockHistory(msg) };
    }
    if (t === "auth") return { result: true };
    return { result: { ok: true } };
  }

  // ------------------------------------------------------------------
  // Statistik & Prognose – Sandbox-Daten
  // ------------------------------------------------------------------
  function historyAmplitude(entityId) {
    const id = String(entityId || "");
    if (id.indexOf("pv") >= 0) return 5200;
    if (id.indexOf("netzeinspeisung") >= 0) return 2400;
    if (id.indexOf("verbrauch") >= 0) return 1900;
    if (id.indexOf("netz") >= 0) return 1400;
    if (id.indexOf("wallbox") >= 0) return 4600;
    if (id.indexOf("wp") >= 0) return 1900;
    if (id.indexOf("auto_leistung") >= 0) return 4600;
    return 1200;
  }
  function mockHistory(msg) {
    const ids = msg.entity_ids || [];
    const start = Date.parse(msg.start_time);
    const end = Date.parse(msg.end_time);
    const n = 70;
    const out = {};
    ids.forEach((eid, ei) => {
      const amp = historyAmplitude(eid);
      const points = [];
      for (let i = 0; i < n; i++) {
        const t = start + ((end - start) * i) / (n - 1);
        const ph = 2.1 + ei * 1.7;
        const wob = Math.sin(i / 6 + ph) * 0.22 + Math.sin(i / 2.2 + ph) * 0.1;
        const solar = pvCurveAt(solarHour(t)) * 1000;
        let v;
        if (eid.indexOf("pv") >= 0) v = solar * (0.8 + 0.2 * Math.sin(i / 5));
        else if (eid.indexOf("wallbox") >= 0 || eid.indexOf("auto_leistung") >= 0)
          v = world.carMode === "charging" ? amp * (1 + wob) : Math.max(0, amp * (0.06 + 0.05 * wob));
        else v = amp * (0.5 + 0.5 * Math.sin(i / 7 + ph)) + Math.max(0, solar * 0.25);
        const e = world.entities[eid];
        const unit = e && e.attributes ? e.attributes.unit_of_measurement : "W";
        const factor = unit === "kW" ? 1000 : unit === "mW" ? 0.001 : 1;
        points.push({ l: new Date(t).toISOString(), s: String(Math.max(0, v / factor).toFixed(factor === 1000 ? 3 : 1)) });
      }
      out[eid] = points;
    });
    return out;
  }

  function mockForecast() {
    const now = Date.now();
    const hNow = solarHour(now); // immer ~11:00 -> mittägliche Kurve
    const until = Math.max(hNow, Math.min(23.9, 18.2));
    const series = [];
    const nSeries = Math.min(13, Math.max(4, Math.round((until - hNow) / 0.25) + 1));
    for (let i = 0; i < nSeries; i++) {
      let kw = pvCurveAt(hNow + i * 0.25);
      if (i === 1) kw *= 0.35; // kurze Wolke in 15 Minuten
      if (i === 2) kw *= 0.85;
      series.push({ t: i * 15, pv_w: Math.round(kw * 1000) });
    }
    const dayCurve = [];
    for (let m = 0; m < 48; m++) {
      const h = hNow + (m / 48) * Math.max(0, 18.2 - hNow);
      dayCurve.push({ t: Math.round(m * 15), pv_w: Math.round(pvCurveAt(h) * 1000) });
    }
    let dayKwh = 0;
    for (let m = 0; m < 96; m++) {
      const h = hNow + (m / 96) * Math.max(0, 18.2 - hNow);
      dayKwh += pvCurveAt(h) * (Math.max(0, 18.2 - hNow) / 96);
    }
    return {
      source: "openmeteo",
      series: series,
      day_curve: dayCurve,
      day_kwh: Math.round(dayKwh * 10) / 10,
      recovery_min: 9,
      note: "Kurze Wolkenphase in ~15 Minuten – danach wieder volle Sonne. (Sandbox-Daten)",
    };
  }

  function mockAnalysis() {
    // Lernkurve (Sonnenstand → W je 1000 W/m²) + letzte Tage
    const curve = [
      { elev: 12.5, factor: 0.18, count: 41 },
      { elev: 17.5, factor: 0.26, count: 67 },
      { elev: 22.5, factor: 0.30, count: 88 },
      { elev: 27.5, factor: 0.32, count: 102 },
      { elev: 32.5, factor: 0.33, count: 96 },
      { elev: 37.5, factor: 0.31, count: 74 },
      { elev: 42.5, factor: 0.28, count: 39 },
    ];
    const days = [];
    const now = new Date();
    const peak = [4.1, 3.6, 4.6, 4.9, 3.2, 4.4, 5.1];
    for (let i = 0; i < peak.length; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      const label = d.toISOString().slice(0, 10);
      days.push({
        date: label,
        kwh: Math.round((peak[i] * 3.2) * 10) / 10,
        peak_w: Math.round(peak[i] * 1000),
        sun_min: 540 - i * 17,
        samples: 140 - i * 6,
      });
    }
    return {
      ok: true,
      curve: { points: curve, coverage: 507, days: 7 },
      days: days,
      today: days[0],
      note: "Lernkurve: PV-Leistung ÷ wolkenlose Einstrahlung je Sonnenstand – Grundlage der Prognose. (Sandbox-Daten)",
    };
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
