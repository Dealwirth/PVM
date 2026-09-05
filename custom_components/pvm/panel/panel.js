/*!
 * PV Manager (PVM) – eigene Panel-Seite
 * -------------------------------------------------------------
 * Läuft als Sidebar-Panel in Home Assistant (custom panel,
 * embed_iframe). Komplett ohne externe Bibliotheken gebaut.
 *
 * Kommunikation mit Home Assistant (1:1):
 *   - this.hass.states            → Live-Zustände aller Entitäten
 *   - hass.connection             → WebSocket (pvm/*-Kommandos)
 *   - Service-Aufrufe über WS     → alle Steuer-Aktionen
 *
 * Alle Texte sind deutsch und bewusst einfach gehalten (Karten,
 * Aufklapp-Gruppen, große Buttons) – auch für Laien verständlich.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Beschriftungen (müssen zu const.py / detector.py passen)
   * ------------------------------------------------------------------ */
  const L = {
    app: "PV Manager",
    tagline: "Überschuss intelligent verteilen",
    nav: {
      start: "Erste Schritte",
      overview: "Übersicht",
      devices: "Geräte",
      order: "Reihenfolge",
      found: "Gefunden",
      stats: "Statistik",
      settings: "Einstellungen",
    },
    roles: {
      wallbox: "Wallbox / E-Auto",
      waermepumpe: "Wärmepumpe",
      verbraucher: "Verbraucher",
      fahrzeug: "Auto / E-Auto",
    },
    roleHint: {
      wallbox:
        "Lädt dein Auto mit PV-Überschuss – inkl. Mindest-SOC, Zeit-Zielen und Power Charge.",
      waermepumpe:
        "Heizt bei Überschuss auf Komfort-Temperatur – mit Notfall-Schutz gegen zu kaltes Wasser.",
      verbraucher:
        "Schaltet Geräte wie Pool, Boiler oder Waschmaschine bei Überschuss ein.",
      fahrzeug:
        "Überwacht Akkustand und Ladeleistung deines Autos – PVM erkennt automatisch, an welcher Wallbox es lädt (oder ob es unterwegs ist).",
    },
    control: {
      switch: "Ein Schalter (An/Aus)",
      switch_number: "Schalter + Leistungs-Begrenzung",
      buttons: "Zwei Taster (Start/Stopp)",
      wp_temp: "Nur Ziel-Temperatur (kein Ein/Aus)",
    },
    controlHint: {
      switch: "Ein Schalter schaltet das Gerät komplett an und aus.",
      switch_number:
        "Zusätzlich zum Schalter begrenzt PVM die Leistung über einen Zahlenwert (z. B. Ampere oder kW).",
      buttons:
        "Zwei getrennte Taster: einer startet, einer stoppt. PVM erkennt den Zustand über die Leistung.",
      wp_temp:
        "Deine Wärmepumpe lässt sich nicht an-/ausschalten – PVM stellt nur die gewünschte Speichertemperatur ein: bei Überschuss höher, sonst wieder zurück.",
    },
    modes: {
      auto: "Auto",
      surplus: "Nur Überschuss",
      deadline: "Nur Ziele",
      off: "Aus",
    },
    modeHint: {
      auto: "Volle Automatik: Überschuss laden plus Zeit-Ziele und Mindest-SOC.",
      surplus: "Nur mit PV-Überschuss – es wird kein Strom aus dem Netz geholt.",
      deadline: "Nur Zeit-Ziele und Mindest-SOC erreichen (kann Netzstrom nutzen).",
      off: "PVM steuert nichts – alles bleibt, wie es ist.",
    },
    gridKinds: {
      net: "Bezug positiv (+), Einspeisung negativ (−)",
      inverted: "Invertiert: Einspeisung positiv (+), Bezug negativ (−)",
      export_only: "Nur Einspeisung (positiv = Einspeisung)",
    },
    gridModes: {
      combined: "Ein Sensor (Bezug + / Einspeisung −)",
      separate: "Zwei getrennte Sensoren",
    },
    gridModeHint: {
      combined: "Ein Zähler liefert beides – z. B. SolarNet „Leistung Netz“ oder ein kombinierter Zähler.",
      separate: "Eigene Zähler für Netzbezug und Netzeinspeisung – PVM wertet beide getrennt aus.",
    },
    themes: {
      ha: "Home Assistant",
      sonnenaufgang: "Sonnenaufgang",
      natur: "Natur-frisch",
      klar: "Kühl & klar",
    },
    accents: {
      auto: "Automatisch (wie dein Design)",
      gruen: "Grün",
      orange: "Orange",
      lila: "Lila",
      rot: "Rot",
      tuerkis: "Türkis",
      blau: "Blau",
      custom: "Eigene Farbe …",
    },
  };
  // Deine Farbe (ersetzt das HA-Blau) für Knöpfe, Verläufe, Fortschritt und
  // kleine Details. "custom" holt sich die freie Farbe aus accent_custom.
  const ACCENT_COLORS = {
    gruen: "#43a047", orange: "#ef6c00", lila: "#7c4dff",
    rot: "#e53935", tuerkis: "#00b3a6", blau: "#039be5",
  };
  function accentColorOf(key) {
    if (key === "custom") {
      const custom = (configSettings().accent_custom || "").trim();
      if (/^#[0-9a-fA-F]{6}$/.test(custom)) return custom;
      return "";
    }
    return (key && ACCENT_COLORS[key]) || "";
  }

  /* ------------------------------------------------------------------ *
   * Styles (eingebettet – die Seite ist komplett autark)
   * ------------------------------------------------------------------ */
  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
/* Icons ohne eigene Größenangabe erhalten eine Basisgröße – sonst rendert
   ein freies SVG mit der vollen Seitenbreite (der „nur ein Bild“-Fehler).
   Charts (svg.flow, .chartbox svg) überschreiben das bewusst. */
h2 svg, h3 svg, button svg, .lbl svg, .stat .k svg, nav svg, .chip svg,
.step svg, .founditem svg, .seg svg, .devctl svg, .fdev svg, .serieschip svg,
.fcstrip svg, .cloud-badge svg, .flowtitle svg, .energycard svg {
  width:16px; height:16px; flex:0 0 auto; }
:host {
  /* Home-Assistant-Design: alle Farben/Ecken/Schatten kommen direkt aus dem
     HA-Theme (applyTheme liest sie beim Start). Fallback: dezente Defaults. */
  --acc: var(--primary-color, #0f6cbd); --acc2: var(--accent-color, #0f6cbd);
  --ok: var(--state-active-color, #2dd4a7); --warn: var(--warning-color, #ffb020);
  --bad: var(--error-color, #ff5d6c); --net: var(--state-inactive-color, #5b9cf0);
  --bg0: var(--background-color, var(--primary-background-color, #f6f7f8));
  --bg1: var(--app-header-background-color, var(--background-color, #f6f7f8));
  --bg2: var(--card-background-color, #ffffff);
  --card: var(--ha-card-background, var(--card-background-color, #ffffff));
  --card2: var(--ha-card-background, var(--secondary-background-color, rgba(0,0,0,.05)));
  --line: var(--divider-color, rgba(0,0,0,.12));
  --txt: var(--primary-text-color, #1c1c1e);
  --mut: var(--secondary-text-color, #727274);
  --r: var(--ha-card-border-radius, 12px);
  --sh: var(--ha-card-box-shadow, 0 2px 8px 0 rgba(0,0,0,.12));
  --btn: var(--primary-color, #0f6cbd);
  color-scheme: var(--ha-scheme, light);
  font-family: var(--primary-font-family, Roboto, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif);
  color: var(--txt);
  background: var(--background-color, var(--primary-background-color, #f6f7f8));
  display: block; width: 100%; min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
:host([theme="natur"]) {
  --acc:#3ecf8e; --acc2:#1ea97c; --bg0:#040f0c; --bg1:#081d17; --bg2:#0d2b21;
  --card:rgba(255,255,255,.045); --card2:rgba(255,255,255,.09);
  --line:rgba(255,255,255,.12); --txt:#eaf6f0; --mut:#93b8a6;
  background:
    radial-gradient(1200px 600px at 85% -10%, rgba(62,207,142,.15), transparent 60%),
    radial-gradient(900px 500px at -10% 110%, rgba(91,156,240,.12), transparent 55%),
    linear-gradient(180deg,#081d17,#040f0c);
}
:host([theme="klar"]) {
  --acc:#1a7fe0; --acc2:#7c6cff; color-scheme: light;
  --bg0:#eef4fb; --bg1:#e6eefa; --bg2:#ffffff;
  --card:rgba(255,255,255,.75); --card2:#ffffff; --line:rgba(15,50,90,.14);
  --txt:#0c2236; --mut:#46617c;
  background:
    radial-gradient(1000px 500px at 90% -5%, rgba(26,127,224,.14), transparent 55%),
    linear-gradient(180deg,var(--bg1),var(--bg0));
}
:host([theme="sonnenaufgang"]) {
  /* Warme Sonnenaufgang-Stimmung (dunkel, Orange/Gold). */
  --acc:#ff9f1c; --acc2:#ff6b35; color-scheme: dark;
  --bg0:#1a0f0a; --bg1:#24140c; --bg2:#2e1a10;
  --card:rgba(255,255,255,.05); --card2:rgba(255,255,255,.09);
  --line:rgba(255,255,255,.12); --txt:#fdf3e7; --mut:#c9a88f;
  background:
    radial-gradient(1200px 600px at 85% -10%, rgba(255,159,28,.16), transparent 60%),
    radial-gradient(900px 500px at -10% 110%, rgba(255,107,53,.14), transparent 55%),
    linear-gradient(180deg,#24140c,#1a0f0a);
}
:host([theme="ha"]) {
  /* alles über die HA-Variablen – wird in applyTheme gesetzt */
}
.wrap { max-width: 1100px; margin: 0 auto; padding: 14px 16px 90px; }

/* Kopfbereich im HA-Stil: eine „App-Bar“-Karte mit Titel, Live-Chips und
   Zurück-zu-HA-Button – in HA-Farben, hell/dunkel automatisch. */
header { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:10px 14px 10px 16px;
  background:var(--card); border:1px solid var(--line); border-radius:calc(var(--r) + 2px);
  box-shadow:var(--sh); }
.logo { width:40px;height:40px;border-radius:12px;flex:0 0 auto; display:grid;place-items:center;color:#fff;
  background:linear-gradient(135deg,var(--acc),var(--acc2)); box-shadow:0 4px 12px rgba(0,0,0,.22); overflow:hidden; }
.logo svg{width:23px;height:23px}
/* Neues PVM-Logo als Bild in einer abgerundeten weißen Karte – passt sich
   dem hellen/dunklen Theme an (Logo hat einen weißen Grund, der die
   Markenfarben trägt). */
.logo.brand { background:#fff; }
.logo.brand img { width:100%; height:100%; object-fit:contain; display:block; }
.titles { flex:1 1 auto; min-width:150px; }
.titles h1 { margin:0; font-size:18px; line-height:1.2; }
.titles p { margin:2px 0 0; color:var(--mut); font-size:12px; }
.chips { display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
.chip { background:var(--card2); border:1px solid var(--line); padding:6px 11px; border-radius:999px;
  font-size:12.5px; display:flex; gap:6px; align-items:center; white-space:nowrap; }
.chip b { font-weight:700 }
/* Live-Werte reservieren eine feste Breite – kein Springen der Beschriftungen */
.chips .chip b[data-live] { display:inline-block; min-width:4.6em; text-align:right; font-variant-numeric:tabular-nums; }
.chips .chip [data-el=statuschip] { display:inline-block; min-width:6em; }
.dot { width:8px;height:8px;border-radius:50%; background:var(--mut); display:inline-block; flex:0 0 auto; }
.dot.ok { background:var(--ok); box-shadow:0 0 8px var(--ok); animation:pulse 1.6s infinite; }
.dot.bad { background:var(--bad); box-shadow:0 0 8px var(--bad); }
.dot.warn { background:var(--warn); box-shadow:0 0 8px var(--warn); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }

/* Tabs: segmentierte Schaltflächen im Chip-Stil; bei schmalen Fenstern
   umbrechen statt abzuschneiden (auf breiten Bildschirmen eine Zeile). */
nav { display:flex; gap:4px; flex-wrap:wrap; margin-top:14px; padding:0 2px; }
nav button { border:0; background:transparent; color:var(--mut); font:inherit; font-size:13px;
  padding:8px 13px; border-radius:9px; cursor:pointer; transition:.16s; display:flex; gap:7px; align-items:center;
  white-space:nowrap; }
nav button svg{width:15px;height:15px}
nav button:hover { color:var(--txt); background:var(--card2); }
nav button.on { background:var(--card); color:var(--txt); font-weight:600; box-shadow:var(--sh), 0 0 0 1px var(--line); }
nav button.on svg { color:var(--acc); }
@media (min-width: 980px) { nav { flex-wrap:nowrap; } nav button { flex:1 1 0; justify-content:center; } }
/* Benachrichtigungs-Punkt an Reitern (wie App-Badges): zeigt, dass hier
   noch etwas offen ist (Einführung, Geräte, Energie-Sensoren) – der
   orangefarbene Punkt warnt vor einer kommenden Wolkenphase (Prognose). */
.navdot { width:8px;height:8px;border-radius:50%;flex:0 0 auto;
  background:var(--bad); box-shadow:0 0 6px var(--bad); display:inline-block;
  animation:pulse 1.6s infinite; }
.navdot.cloud { background:var(--warn); box-shadow:0 0 6px var(--warn); }

section.view { animation:fade .22s ease; }
@keyframes fade { from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:none} }
.hidden { display:none !important; }
h2.sec { font-size:17px; margin:20px 0 4px; }
h2.sec svg { width:18px; height:18px; vertical-align:-3px; color:var(--acc); }
p.sub { color:var(--mut); margin:2px 0 14px; font-size:13.5px; line-height:1.5; }

.hero { border-radius:var(--r); padding:26px 24px; margin-top:16px; position:relative; overflow:hidden;
  border:1px solid var(--line); background:var(--card2); box-shadow:var(--sh); }
.hero.compact { padding:18px 22px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
.hero.compact h2 { margin:0; font-size:19px; }
.hero.compact p { margin:0; font-size:13.5px; }
.hero h2 { margin:0 0 8px; font-size:22px; }
.hero p { margin:0 0 18px; color:var(--mut); max-width:600px; line-height:1.6; }
button.linkbtn { background:none; border:none; color:var(--acc); font:inherit; font-size:12.5px;
  cursor:pointer; padding:6px 4px; text-decoration:underline; text-underline-offset:3px; }
button.linkbtn:hover { opacity:.8; }
.sun { position:absolute; right:-60px; top:-60px; width:260px; height:260px; border-radius:50%; pointer-events:none;
  background:radial-gradient(circle, rgba(255,180,60,.35), rgba(255,120,40,.12) 55%, transparent 70%); }
.steps { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; margin-top:4px; }
.step { background:var(--card); border:1px solid var(--line); border-radius:var(--r); padding:15px 14px 13px;
  display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:.2s; box-shadow:var(--sh); }
.step:hover { border-color: var(--acc); transform:translateY(-2px); }
.step .n { width:26px;height:26px;border-radius:50%; display:grid;place-items:center; font-weight:800; font-size:13px;
  background:var(--card2); color:var(--mut); flex:0 0 auto; }
.step.done .n { background:var(--ok); color:#04231a; }
.step.active .n { background:linear-gradient(135deg,var(--acc),var(--acc2)); color:#fff; box-shadow:0 0 0 4px rgba(255,159,28,.18); }
.step b { font-size:14.5px }
.step span { color:var(--mut); font-size:12.5px; line-height:1.45; flex:1; }
.btnrow { display:flex; gap:10px; flex-wrap:wrap; margin-top:6px; }

button.btn { border:0; cursor:pointer; font:inherit; font-size:13.5px; font-weight:600; padding:11px 18px;
  border-radius:10px; transition:.18s; display:inline-flex; align-items:center; gap:8px;
  min-height:40px; }
button.btn svg{width:16px;height:16px}
.btn.primary { background:var(--btn); color:var(--primary-text-on-color, #fff); font-weight:600;
  box-shadow:0 2px 6px rgba(0,0,0,.18); }
.btn.primary:hover { filter:brightness(1.08); }
.btn.ghost { background:var(--card2); color:var(--txt); border:1px solid var(--line); }
.btn.ghost:hover { border-color: var(--btn); }
.btn.danger { background:color-mix(in srgb, var(--bad) 14%, transparent); color:var(--bad); border:1px solid color-mix(in srgb, var(--bad) 40%, transparent); }
.btn.danger:hover { background:color-mix(in srgb, var(--bad) 26%, transparent); }
.btn:disabled { opacity:.45; cursor:not-allowed; transform:none !important; }
button.ico { background:var(--card2); border:1px solid var(--line); border-radius:9px; cursor:pointer;
  width:32px;height:32px; display:grid;place-items:center; color:var(--mut); transition:.15s; padding:0; }
button.ico:hover { color:var(--txt); border-color:var(--acc); }
button.ico svg{width:15px;height:15px}

.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-top:10px; }
.stat { background:var(--card); border:1px solid var(--line); border-radius:var(--r); padding:14px 15px; box-shadow:var(--sh); }
.stat .k { color:var(--mut); font-size:11px; text-transform:uppercase; letter-spacing:.8px; display:flex; align-items:center; gap:6px; }
.stat .k svg{width:14px;height:14px}
.stat .v { font-size:25px; font-weight:800; margin-top:8px; font-variant-numeric: tabular-nums; white-space:nowrap; }
.stat .v span { display:inline-block; min-width:4em; text-align:right; }
.stat .v small { font-size:14px; font-weight:600; color:var(--mut); }
.stat .d { font-size:11.5px; color:var(--mut); margin-top:5px; min-height:13px; }
.stat .bar { height:5px;border-radius:3px;background:var(--card2); margin-top:10px;overflow:hidden; }
.stat .bar i { display:block; height:100%; border-radius:3px; transition:width .6s ease; background:linear-gradient(90deg,var(--acc),var(--acc2)); }

.flowbox { margin-top:14px; border:1px solid var(--line); border-radius:var(--r); background:var(--card); padding:14px; box-shadow:var(--sh); }
.flowtitle { font-size:14px; font-weight:700; margin-bottom:2px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
.flowtitle small { color:var(--mut); font-weight:400; font-size:12px; }
svg.flow { width:100%; height:auto; display:block; }
.nbox rect { filter: drop-shadow(0 5px 12px rgba(0,0,0,.25)); }
.nbox .nm { fill:var(--mut); font-size:10px; text-transform:uppercase; letter-spacing:1px; }
.nbox .nv { fill:var(--txt); font-size:20px; font-weight:800; }
.nbox .nu { fill:var(--mut); font-size:10.5px; }
.lbl { fill:var(--mut); font-size:10.5px; }
.path { stroke-dasharray:7 9; animation:dash 1.1s linear infinite; }
.path.slow { animation-duration:2.4s; }
.path.reverse { animation-direction: reverse; }
@keyframes dash { to { stroke-dashoffset:-16; } }

.devices { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:12px; margin-top:12px; }
.dev { background:var(--card); border:1px solid var(--line); border-radius:var(--r); padding:13px 14px;
  transition:.2s; position:relative; box-shadow:var(--sh); cursor:pointer; }
.dev:hover { border-color: var(--acc); box-shadow:var(--sh), 0 6px 16px -6px rgba(0,0,0,.25); transform:translateY(-2px); }
.dev .head { display:flex; align-items:center; gap:10px; }
.dev .ic { width:38px;height:38px;border-radius:11px; display:grid;place-items:center; flex:0 0 auto;
  background:linear-gradient(140deg, rgba(255,159,28,.22), transparent); border:1px solid rgba(255,159,28,.35); }
.dev .ic svg { width:21px; height:21px; color: var(--acc); }
.dev h3 { margin:0; font-size:14.5px; flex:1; overflow-wrap:anywhere; line-height:1.3; }
.dev .pill { font-size:10px; padding:3px 9px; border-radius:999px; border:1px solid var(--line);
  color:var(--mut); text-transform:uppercase; letter-spacing:.5px; white-space:nowrap; }
.dev .pill.on { color:#04231a; background:var(--ok); border-color:var(--ok); font-weight:800; }
.dev .pill.warn { color:#3d2400; background:var(--warn); border-color:var(--warn); font-weight:800; }
.dev .mid { display:flex; gap:12px; align-items:baseline; margin-top:12px; flex-wrap:wrap; }
.dev .bigw { font-size:22px; font-weight:800; font-variant-numeric:tabular-nums; min-width:70px; white-space:nowrap; }
.dev .bigw small { font-size:11px; color:var(--mut); font-weight:600; }
.dev .soc { flex:1; min-width:120px; margin-top:10px; }
.dev .soc .row { display:flex; justify-content:space-between; font-size:11px; color:var(--mut); margin-bottom:4px; }
.socbar { height:9px; border-radius:6px; background:var(--card2); overflow:hidden; }
.socbar i { display:block; height:100%; border-radius:6px; transition:width .5s ease; background:linear-gradient(90deg,var(--ok),var(--acc)); }
.dev .goal { margin-top:7px; font-size:11px; color:var(--mut); }
.dev .tags { margin-top:10px; display:flex; flex-wrap:wrap; gap:6px; }
.tag { font-size:11px; background:var(--card2); border:1px solid var(--line); border-radius:999px; padding:3px 9px; color:var(--mut); }
.tag.role { text-transform:uppercase; letter-spacing:.5px; font-size:9.5px; }
.dev .ops { display:flex; gap:8px; justify-content:flex-end; margin-top:11px; border-top:1px solid var(--line); padding-top:10px; align-items:center; min-height:34px; }
.dev .statusline { color:var(--mut); font-size:12px; margin-top:6px; display:flex; gap:6px; align-items:center; min-height:15px; }
.empty { color:var(--mut); text-align:center; padding:26px 10px; font-size:13.5px; }

.acc { border:1px solid var(--line); border-radius:var(--r); background:var(--card); margin-top:10px; overflow:hidden; box-shadow:var(--sh); }
.acc > button.h { width:100%; border:0; background:transparent; color:var(--txt); font:inherit; font-size:14.5px;
  font-weight:600; padding:14px 16px; cursor:pointer; display:flex; align-items:center; gap:10px; text-align:left; }
.acc > button.h .arr { margin-left:auto; transition:transform .25s; color:var(--mut); display:grid; }
.acc.open > button.h .arr { transform:rotate(180deg); }
.acc > button.h svg{width:18px;height:18px;color:var(--acc)}
.acc .body { max-height:0; overflow:hidden; transition:max-height .3s ease; }
.acc.open .body { max-height:1600px; }
.acc .inner { padding:2px 16px 16px; display:flex; flex-direction:column; gap:13px; }
.row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.row .grow { flex:1; min-width:180px; }
.lbl { font-size:13px; display:flex; flex-direction:column; gap:2px; }
.lbl small { color:var(--mut); font-size:11.5px; line-height:1.4; }
.lbl .val { font-weight:800; color: var(--acc); font-variant-numeric:tabular-nums; }
.entv { font-size:11.5px; color:var(--mut); word-break:break-all; line-height:1.4; margin-top:3px; }
input[type=range] { width:100%; accent-color:var(--acc); cursor:pointer; height:26px; }
input[type=range][disabled]{opacity:.4;cursor:not-allowed}
select, input[type=text], input[type=number] { background:var(--card2); border:1px solid var(--line);
  color:var(--txt); border-radius:10px; padding:8px 11px; font:inherit; font-size:13.5px; }
select:focus, input:focus { outline:2px solid rgba(255,159,28,.55); outline-offset:1px; }

.sw { width:42px; height:24px; border-radius:999px; border:1px solid var(--line); background:var(--card2);
  position:relative; cursor:pointer; transition:.2s; flex:0 0 auto; display:inline-block; padding:0; }
.sw i { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:var(--mut);
  transition:.2s cubic-bezier(.3,1.4,.5,1); }
.sw.on { background:linear-gradient(135deg,var(--acc),var(--acc2)); border-color:transparent; }
.sw.on i { left:20px; background:#fff; }

.pick { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; }
.pick label { border:1.5px solid var(--line); border-radius:10px; padding:11px 12px; cursor:pointer; transition:.15s;
  background:var(--card); display:flex; gap:9px; align-items:flex-start; }
.pick label:hover { border-color: var(--acc); }
.pick input { display:none; }
.pick label.sel { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 10%, transparent); box-shadow:0 0 0 1px var(--acc) inset; }
.pick .rb { width:16px;height:16px;border-radius:50%;border:2px solid var(--mut); margin-top:2px; flex:0 0 auto; }
.pick label.sel .rb { border-color: var(--acc); background: radial-gradient(circle, var(--acc) 45%, transparent 50%); }
.pick .tt { display:flex; flex-direction:column; gap:3px; }
.pick .tt b { font-size:13px; font-weight:600 }
.pick .tt span { font-size:11.5px; color:var(--mut); line-height:1.4; }

.overlay { position:fixed; inset:0; background:rgba(3,10,22,.6); backdrop-filter:blur(3px);
  display:grid; place-items:center; z-index:100; padding:18px; animation:fade .16s ease; }
.modal { width:min(620px,100%); max-height:92vh; overflow:auto; background:var(--bg1);
  border:1px solid var(--line); border-radius:var(--r); padding:20px; box-shadow:0 30px 80px rgba(0,0,0,.5);
  animation:pop .2s cubic-bezier(.2,1.2,.4,1); }
@keyframes pop { from{opacity:0; transform:scale(.94) translateY(10px)} to{opacity:1; transform:none} }
.modal h3 { margin:0 0 4px; font-size:18px; }
.modal .msub { color:var(--mut); font-size:13px; margin-bottom:14px; line-height:1.45; }
.modal .mbody { display:flex; flex-direction:column; gap:12px; }
.modal .mfoot { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
.f { display:flex; flex-direction:column; gap:5px; }
.f label { font-size:13px; font-weight:600; }
.f small { color:var(--mut); font-size:11.5px; line-height:1.4; }
.f .ent { display:flex; gap:7px; align-items:center; }
.f .ent input { flex:1; }
.f .ent button { flex:0 0 auto; }

.picklist { max-height:44vh; overflow:auto; display:flex; flex-direction:column; gap:6px; padding:2px; }
.pickitem { border:1px solid var(--line); border-radius:11px; padding:9px 11px; cursor:pointer; transition:.14s; background:var(--card); }
.pickitem:hover { border-color: var(--acc); background: var(--card2); }
.pickitem b { display:block; font-size:13px; }
.pickitem span { color:var(--mut); font-size:11px; word-break:break-all; line-height:1.4; }
.searchrow { display:flex; gap:8px; margin-bottom:8px; }
.searchrow input { flex:1; }

.founditem { border:1px solid var(--line); border-radius:var(--r); padding:13px 15px; margin-top:10px;
  background:var(--card); display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap; box-shadow:var(--sh); }
.founditem .grow { flex:1; min-width:200px; }
.founditem > .btn { margin-top:2px; flex:0 0 auto; }
.founditem h4 { margin:0 0 3px; font-size:14.5px; }
/* „Erweiterte Einstellungen“ im Geräte-Dialog: dezent, aufklappbar – so
   wirkt der Dialog nie überladen, alle Optionen bleiben aber erreichbar. */
.dlg-adv { border:1px dashed var(--line); border-radius:11px; padding:9px 12px; }
.dlg-adv summary { cursor:pointer; font-size:13px; font-weight:600; color:var(--mut); user-select:none; list-style:none; display:flex; align-items:center; gap:6px; }
.dlg-adv summary::before { content:"▸"; transition:transform .15s ease; font-size:11px; }
.dlg-adv[open] summary::before { transform:rotate(90deg); }
.dlg-adv summary:hover { color:var(--txt); }
.dlg-adv-inner { display:flex; flex-direction:column; gap:12px; margin-top:12px; padding-top:12px; border-top:1px solid var(--line); }
/* „i“-Info: Beschreibungen sind standardmäßig eingeklappt – ein Klick
   auf das ⓘ klappt sie auf (Dialoge wirken dadurch nie überladen). */
.info { display:inline-flex; align-items:center; justify-content:center; width:20px;height:20px;
  border-radius:50%; border:1px solid var(--line); background:var(--card2); color:var(--mut);
  font-size:12px; font-weight:800; cursor:pointer; flex:0 0 auto; margin-left:6px; vertical-align:-4px; }
.info:hover { color:var(--acc); border-color:var(--acc); }
.infobox { display:none; }
.infobox.open { display:block; }
/* Zahlenwert direkt am Schieberegler (nie raten, auf welchem Wert man steht) */
.numval { font-weight:800; color:var(--acc); font-variant-numeric:tabular-nums;
  min-width:64px; text-align:right; white-space:nowrap; }
.founditem p { margin:0; color:var(--mut); font-size:12px; line-height:1.45; word-break:break-word; }

#toasts { position:fixed; bottom:18px; right:18px; display:flex; flex-direction:column; gap:8px; z-index:400; }
.toast { background:var(--bg2); border:1px solid var(--line); border-left:4px solid var(--acc);
  padding:11px 15px; border-radius:12px; font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.4);
  animation:toastin .25s ease; max-width:330px; }
.toast.ok { border-left-color: var(--ok); }
.toast.bad { border-left-color: var(--bad); }
@keyframes toastin { from{opacity:0; transform:translateX(30px)} to{opacity:1; transform:none} }

.loadwrap { display:flex; flex-direction:column; gap:14px; align-items:center; justify-content:center; min-height:70vh; color:var(--mut); }
.spin { width:34px;height:34px;border-radius:50%; border:3px solid var(--card2); border-top-color: var(--acc);
  animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg) } }

/* ---- Sensor-Status in den Energie-Einstellungen (Haken + Detail) ---- */
.energycard { border:1px solid var(--line); border-radius:14px; padding:12px 14px; margin-top:8px;
  background:var(--card); cursor:pointer; transition:border-color .15s; }
.energycard:hover { border-color: var(--acc); }
.energycard .top { display:flex; align-items:center; gap:10px; }
.echeck { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700;
  padding:3px 9px; border-radius:20px; white-space:nowrap; }
.echeck.ok { background:rgba(46,204,113,.14); color:var(--ok); }
.echeck.no { background:var(--card2); color:var(--mut); }
.energycard .edetail { display:none; margin-top:10px; padding-top:10px; border-top:1px dashed var(--line);
  font-size:12.5px; color:var(--mut); }
.energycard.open .edetail { display:block; }
.energycard .edetail b { color:var(--txt); }
.energycard .eactions { display:flex; gap:8px; margin-top:10px; }

/* ---- Temperatur-Regler mit Zonen-Skala (Bakterien-/Heizungs-Grenzen) ---- */
.zrng { position:relative; flex:1.4; min-width:190px; }
.zrng input[type=range] { width:100%; height:30px; margin:0; background:transparent; }
.zrng .zscale { position:relative; height:14px; margin:-6px 2px 0; border-radius:7px;
  background:linear-gradient(90deg, #e0454b 0%, #e0454b var(--coldP), #ffcf5c var(--coldP), #4caf6d var(--midP), #ffcf5c var(--hotP), #e0454b var(--hotP), #e0454b 100%);
  opacity:.95; }
.zrng .zscale i { position:absolute; top:-3px; width:2px; height:20px; background:rgba(0,0,0,.55); }
.zrng .zscale i.cold { left:var(--coldP); } .zrng .zscale i.hot { left:var(--hotP); }
.ztick { display:flex; justify-content:space-between; font-size:10.5px; color:var(--mut); margin-top:3px; }
.zlegend { display:flex; gap:12px; flex-wrap:wrap; font-size:11px; color:var(--mut); margin-top:2px; }
.zlegend i { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:4px; vertical-align:-1px; }

/* ---- Auto/Manuell-Umschalter auf der Geräte-Karte ---- */
.seg { display:inline-flex; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.seg button { border:0; background:transparent; color:var(--mut); font-size:11.5px; font-weight:700;
  padding:5px 12px; cursor:pointer; }
.seg button.on { background:var(--acc); color:#fff; }
.seg button.man { background:var(--warn); color:#1c1c1c; }
.devctl { margin-top:10px; border:1px solid var(--line); border-radius:12px; background:var(--card2);
  padding:10px 12px; display:flex; flex-direction:column; gap:8px; font-size:12.5px; }
.devctl .ctlline { display:flex; align-items:center; gap:10px; }
.devctl .ctlline b { flex:1; }
.devctl button.btn { padding:6px 12px; }

/* ---- Geräte-Chips unter dem Energiefluss (dynamisch, skalierbar) ---- */
.flowdevs { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; margin-top:10px; }
.fdev { border:1px solid var(--line); border-radius:12px; padding:8px 10px; cursor:pointer;
  background:var(--card); display:flex; gap:8px; align-items:center; }
.fdev:hover { border-color: var(--acc); }
.fdev .fic { width:26px; height:26px; flex:0 0 26px; border-radius:8px; display:flex; align-items:center; justify-content:center;
  background:color-mix(in srgb, var(--acc) 16%, transparent); color:var(--acc); }
.fdev .fic svg { width:16px; height:16px; }
.fdev .fname { font-size:12px; font-weight:600; line-height:1.15; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fdev .fpw { font-size:13px; font-weight:800; color:var(--acc); font-variant-numeric:tabular-nums; }
.fdev.off { opacity:.62; }
.fdev.off .fpw { color:var(--mut); font-weight:600; }

/* ---- Statistik / Charts ---- */
.stattools { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:8px 0 4px; }
.chiprow { display:flex; gap:6px; flex-wrap:wrap; margin:6px 0; }
.serieschip { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); background:var(--card);
  border-radius:20px; padding:4px 11px; font-size:12px; cursor:pointer; color:var(--mut); user-select:none; }
.serieschip .dot { width:10px; height:10px; border-radius:50%; }
.serieschip.on { border-color:currentColor; color:var(--txt); }
.chartbox { border:1px solid var(--line); border-radius:16px; background:var(--card); padding:12px; overflow-x:auto; }
.chartbox svg { display:block; width:100%; }
.legline { font-size:11.5px; color:var(--mut); }
.fcstrip { display:flex; gap:8px; flex-wrap:wrap; }
.fchip { flex:1; min-width:130px; border:1px solid var(--line); border-radius:12px; background:var(--card); padding:8px 10px; }
.fchip b { display:block; font-size:15px; }
.fchip span { font-size:11.5px; color:var(--mut); }
.cloud-badge { display:inline-flex; align-items:center; gap:5px; font-size:11px; border-radius:20px; padding:2px 9px; }
.cloud-badge.warn { background:rgba(255,152,0,.16); color:#ff9800; }
.cloud-badge.ok { background:rgba(76,175,110,.16); color:var(--ok); }
`;

  /* ------------------------------------------------------------------ *
   * Icons (Inline-SVGs)
   * ------------------------------------------------------------------ */
  const I = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7M5 10v10h14V10"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M3 12h18"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
    plug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 2v5M15 2v5M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v6"/></svg>',
    pump: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9h18v7H3zM12 9v7M6 9V6h12v3"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    radar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12l5-5"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M4 12l5 5L20 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16H4a2 2 0 0 1-2-2v-3l2.5-5A2 2 0 0 1 6.3 5h11.4a2 2 0 0 1 1.8 1.1L22 11v3a2 2 0 0 1-2 2h-1"/><path d="M2 13h20"/><circle cx="7" cy="16" r="1.6"/><circle cx="17" cy="16" r="1.6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.5 19a4.5 4.5 0 0 0 .4-9A7 7 0 0 0 4.3 12.5 4 4 0 0 0 6 20h11.5z"/></svg>',
    sunny: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  };
  // Firmenlogo PVM – Solarpanel + Sonne + „PVM“-Wortmarke (vom Nutzer
  // geliefert, eingebettet als Data-URI, damit die Seite autark bleibt).
  const LOGO_SVG = '<img src="data:image/png;base64,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" alt="PVM">';
  const ROLE_ICON = { wallbox: I.bolt, waermepumpe: I.pump, verbraucher: I.plug, fahrzeug: I.car };

  /* ------------------------------------------------------------------ *
   * Panel-Zustand
   * ------------------------------------------------------------------ */
  const state = {
    panel: null,
    hass: null,
    config: null,
    entities: null,   // entity_id-Mapping aus pvm/get_config
    scan: {},
    setup: "start",
    version: "",
    entityList: null, // Cache für Entity-Picker
    entityListLoaded: false,
    view: "start",
    toastSeq: 0,
    modal: null,        // oberster geöffneter Dialog (für Kompatibilität)
    modalStack: [],     // gestapelte Dialoge: Picker/Sub-Dialoge zerstören den
                        // darunterliegenden Dialog nicht mehr (wichtig: Geräte-Dialog)
    deviceDialog: null,
    accOpen: {},        // offene Einstellungs-Akkordeons (bleiben nach Reload erhalten)
    instance: null,     // Instanz des aktuell geladenen Managers
    lastInstance: null, // Instanz beim letzten Speichern (für Reload-Erkennung)
    lastLive: 0,
    liveStates: {},   // Live-Zustände über WS-Subscription (state_changed)
    liveSubscribed: false,
    liveTimer: null,
    flowSig: null,
  };

  const $ = (root, sel) => root.querySelector(sel);
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

  /* CSS.escape gibt es nicht in jeder Umgebung (z. B. ältere WebViews) –
   * einfacher Fallback, damit Geräte-IDs mit Sonderzeichen sicher bleiben. */
  function cssEsc(id) {
    const s = String(id == null ? "" : id);
    if (window.CSS && typeof CSS.escape === "function") return CSS.escape(s);
    return s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function fmtW(w) {
    if (w == null || isNaN(w)) return "–";
    const n = Number(w);
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + " kW";
    return Math.round(n) + " W";
  }
  function fmtNum(v, unit) {
    if (v == null || v === "" || isNaN(Number(v))) return "–";
    const n = Number(v);
    const u = String(unit || "");
    if (u === "W") return Math.round(n) + " W";
    if (u === "kW") return n.toFixed(n >= 10 ? 1 : 2) + " kW";
    if (u === "%") return Math.round(n) + " %";
    if (u === "°C") return n.toFixed(1) + " °C";
    if (u === "A") return n.toFixed(1) + " A";
    if (u === "s") return Math.round(n) + " s";
    if (u === "min") return Math.round(n) + " min";
    if (u === "kWh") return n.toFixed(0) + " kWh";
    if (!u) return fmtW(n);
    return n + " " + u;
  }

  function st(entityId) {
    if (!entityId) return null;
    if (state.liveStates && state.liveStates[entityId]) return state.liveStates[entityId];
    return (state.hass && state.hass.states && state.hass.states[entityId]) || null;
  }
  function num(entityId) {
    const s = st(entityId);
    if (!s) return null;
    const v = parseFloat(s.state);
    return isNaN(v) ? null : v;
  }
  /** Leistungswert in Watt – kW/mW werden umgerechnet (Einheit beachten!). */
  function numW(entityId) {
    const s = st(entityId);
    if (!s) return null;
    const v = parseFloat(s.state);
    if (isNaN(v)) return null;
    const u = unitOf(entityId);
    if (u === "kW") return v * 1000;
    if (u === "mW") return v / 1000;
    return v;
  }
  function unitOf(entityId) {
    const s = st(entityId);
    return s && s.attributes ? s.attributes.unit_of_measurement || "" : "";
  }
  function _isPowerUnitJs(unit) {
    const u = String(unit || "").trim();
    return u === "W" || u === "kW" || u === "mW" || u.endsWith("W");
  }
  function isOn(entityId) {
    const s = st(entityId);
    return !!s && s.state === "on";
  }
  function friendlyOf(entityId) {
    const s = st(entityId);
    if (s && s.attributes && s.attributes.friendly_name) return s.attributes.friendly_name;
    return entityId;
  }

  function ws(type, extra) {
    if (!state.hass || !state.hass.connection)
      return Promise.reject(new Error("Keine Verbindung zu Home Assistant."));
    return state.hass.connection.sendMessagePromise(Object.assign({ type: type }, extra || {}));
  }
  /** WebSocket-Aufruf mit hartem Zeitlimit – nie endlos hängen lassen. */
  function wsTimeout(type, extra, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Zeitüberschreitung – bitte erneut versuchen."));
      }, ms || 20000);
      ws(type, extra).then(
        (res) => { clearTimeout(timer); resolve(res); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }
  function callSvc(domain, service, data) {
    if (!state.hass || !state.hass.connection)
      return Promise.reject(new Error("Keine Verbindung zu Home Assistant."));
    return state.hass.connection.sendMessagePromise({
      type: "call_service", domain, service, service_data: data || {},
    });
  }

  function toast(msg, kind) {
    const root = state.root;
    if (!root) return;
    let box = $(root, "#toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      root.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity .3s";
      setTimeout(() => el.remove(), 320);
    }, kind === "bad" ? 5200 : 3000);
  }

  function configEnergy() { return (state.config && state.config.energy) || {}; }
  function configSettings() { return (state.config && state.config.settings) || {}; }
  function devicesOf() { return (state.config && state.config.devices) || []; }
  function deviceById(id) { return devicesOf().find((d) => d.id === id); }
  function entOf(deviceId) {
    return ((state.entities && state.entities.devices) || {})[deviceId] || {};
  }
  // Rang unter den steuerbaren Geräten (Autos belegen keinen Rang – siehe
  // Reihenfolge-Seite & Backend rank_of). Liefert 0, wenn das Gerät nicht
  // steuerbar ist (z. B. Auto) oder nicht existiert.
  function rankOf(deviceId) {
    const controllable = devicesOf().filter((d) => d.role !== "fahrzeug");
    const index = controllable.findIndex((d) => d.id === deviceId);
    return index >= 0 ? index + 1 : 0;
  }

  /** Startansicht: Einrichtung fertig -> Übersicht (wie eine App, die immer
   *  mit dem Dashboard öffnet); sonst die Einführung. */
  function initialView() {
    return configSettings().intro_done ? "overview" : "start";
  }

  /** Setup-Punkte für die Benachrichtigungs-Punkte (wie bei einer App):
   *  Energie-Sensoren fehlen / keine Geräte / Intro noch offen. */
  function setupBadges() {
    const e = configEnergy();
    const hasEnergy = !!(e.pv_sensor || e.grid_sensor ||
      e.grid_import_sensor || e.grid_export_sensor);
    const badges = [];
    if (!hasEnergy) badges.push("energy");
    if (!devicesOf().length) badges.push("devices");
    if (!configSettings().intro_done) badges.push("intro");
    return badges;
  }

  /* ------------------------------------------------------------------ *
   * WebSocket / Konfiguration
   * ------------------------------------------------------------------ */
  async function fetchConfig() {
    const data = await ws("pvm/get_config");
    state.config = data.config;
    state.entities = data.entities || {};
    state.scan = data.scan || {};
    state.setup = data.setup || "start";
    state.version = data.version || "";
    state.instance = data.instance || null;
    return data;
  }
  async function saveConfig() {
    const res = await wsTimeout("pvm/save_config", { config: state.config }, 25000);
    // Instanz VOR dem evtl. Entitäten-Reload merken – nach dem Reload ist
    // die Instanz neu, daran erkennt settleAfterReload den Abschluss.
    state.lastInstance = (res && res.instance) || null;
    return !!(res && res.ok);
  }

  /* ------------------------------------------------------------------ *
   * Live-Daten: WS-Subscription auf state_changed + Fallback-Intervall.
   * Garantiert, dass ALLE Werte aktualisieren – auch wenn HA die
   * hass-Property nicht bei jeder Änderung neu setzt.
   * ------------------------------------------------------------------ */
  function subscribeLiveStates() {
    if (state.liveSubscribed || !state.hass || !state.hass.connection) return;
    state.liveSubscribed = true;
    state.hass.connection
      .subscribeMessage(
        (msg) => {
          const ev = msg && msg.event;
          if (!ev || ev.event_type !== "state_changed") return;
          const entityId = ev.data && ev.data.entity_id;
          const newState = ev.data && ev.data.new_state;
          if (!entityId) return;
          if (newState) state.liveStates[entityId] = newState;
          else delete state.liveStates[entityId];
        },
        { type: "subscribe_events", event_type: "state_changed" }
      )
      .catch(() => {
        /* Subscription nicht verfügbar – der Intervall läuft trotzdem */
      });
  }

  function startLiveLoop() {
    if (state.liveTimer) return;
    state.liveTimer = setInterval(() => {
      if (!state.config) return;
      liveNow();
      updateHeaderChip();
      updateDeviceLives();
      updateFlow();
    }, 1000);
  }

  function configSignature(cfg) {
    const c = cfg || {};
    const devs = (c.devices || []).map((d) => d.id).sort();
    return devs.join(",") + "|" + JSON.stringify(c.energy || {});
  }

  /** Speichert und aktualisiert die Seite sofort – ohne Wartezeit und ohne
   *  stilles Aufgeben. Die Antwort des Servers kommt immer (Konfiguration
   *  wird serverseitig sofort übernommen); neue Entitäten folgen im
   *  Hintergrund und werden hier nachgezogen. */
  /* Signatur der Geräte-Struktur: ändert sie sich (neues/entferntes Gerät,
   * Rollen- oder Namenswechsel), müssen die Entitäten neu geladen werden. */
  function deviceSig() {
    return devicesOf().map((d) => (d.id || "") + ":" + (d.role || "") + ":" + String(d.name || "")).join("|");
  }

  /* Löst den Entitäten-Reload aus und wartet, bis er fertig ist. Mehrere
   * schnelle Aufrufe werden aneinander gereiht (kein paralleler Reload). */
  let reloadChain = Promise.resolve();
  function reloadEntities() {
    const p = reloadChain.then(() =>
      wsTimeout("pvm/reload", {}, 40000).catch((err) => {
        state.reloadError = errText(err);
        return null;
      })
    );
    reloadChain = p.then(() => {});
    return p;
  }

  /** Speichert und aktualisiert die Seite sofort – ohne Wartezeit und ohne
   *  stilles Aufgeben. Bei ``opts.reload`` (Gerät hinzugefügt/entfernt oder
   *  Rolle/Name geändert) wird zuerst der Entitäten-Reload abgewartet, damit
   *  die neuen Geräte ihre Schalter/Sensoren sofort haben. */
  async function saveAndRefresh(msg, opts) {
    opts = opts || {};
    try {
      await saveConfig();
      toast(msg || "Gespeichert.", "ok");
    } catch (err) {
      toast("Speichern fehlgeschlagen: " + errText(err), "bad");
      return;
    }
    if (opts.reload) {
      await reloadEntities();
      if (state.reloadError) {
        toast("Gerät gespeichert – neue Bedienelemente folgen gleich. Falls nichts erscheint: Seite neu laden. (" + state.reloadError + ")", "bad");
        state.reloadError = null;
      }
    }
    if (opts.forecast) {
      // Prognose nach Einschalten/Schlüssel-Eintrag sofort berechnen,
      // damit die Statistik-Seite nicht 15 Minuten leer bleibt.
      wsTimeout("pvm/forecast_refresh", {}, 15000).then((res) => {
        statState.forecast = res || null;
        drawForecastPanel();
        updateForecastBadge();
      }).catch(() => {});
    }
    await refreshFromServer();
    settleAfterReload();
  }

  function entityMapComplete() {
    const devs = devicesOf();
    if (!devs.length) return true;
    const entDevs = (state.entities && state.entities.devices) || {};
    // Mindestens eine wirklich registrierte Entität pro Gerät (Werte != null)
    return devs.every((d) => {
      const m = entDevs[d.id];
      return !!m && Object.keys(m).some((k) => m[k]);
    });
  }

  /** Wartet nach dem Speichern, bis ein nötiger Entitäten-Reload abgeschlossen
   *  ist (erkennbar an einer neuen Instanz) bzw. alle Geräte Entitäten haben.
   *  Endet IMMER mit einem Neuaufbau – nie still hängen lassen. */
  function settleAfterReload() {
    const before = state.lastInstance;
    let tries = 0;
    const MAX = 20; // ~18 s – Reloads dauern je nach Gerätezahl einige Sekunden
    const finish = () => {
      const keepView = state.view;
      state.panel._renderApp();
      state.panel._nav(keepView);
      liveNow();
    };
    const step = () => {
      wsTimeout("pvm/get_config", {}, 8000)
        .then((data) => {
          if (!data || !data.config) return;
          state.entities = data.entities || {};
          tries += 1;
          const reloaded = !!(data.instance && before && data.instance !== before);
          if (entityMapComplete() || reloaded || tries >= MAX) {
            finish();
          } else {
            setTimeout(step, 700);
          }
        })
        .catch(() => {
          tries += 1;
          if (tries < MAX) setTimeout(step, 900);
          else finish();
        });
    };
    setTimeout(step, 700);
  }

  function errText(err) {
    const e = (err && err.message) || err;
    return String(e).replace(/^Error: /, "");
  }

  async function refreshFromServer() {
    const keepView = state.view;
    // Kurz warten, dann frische Konfiguration holen und rendern.
    // Falls PVM gerade entlädt/neu lädt, mehrmals versuchen – aber
    // nach dem letzten Versuch wird auf jeden Fall gerendert.
    for (let i = 0; i < 12; i++) {
      try {
        await fetchConfig();
        state.panel._renderApp();
        if (keepView) state.panel._nav(keepView);
        liveNow();
        return;
      } catch (err) {
        if (i === 11) {
          // Server nicht erreichbar: Seite trotzdem aktualisieren.
          if (state.config) {
            state.panel._renderApp();
            if (keepView) state.panel._nav(keepView);
          }
          toast("Aktualisierung dauerte ungewöhnlich lange – bitte Seite neu laden.", "bad");
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Haupt-Element
   * ------------------------------------------------------------------ */
  class PvmPanel extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" });
      state.panel = this;
      state.root = this.shadowRoot;
      if (state.config) {
        // Das Element wird neu aufgebaut (z. B. Seitenleiste erneut geöffnet):
        // sofort den letzten Stand zeigen und parallel frische Daten holen –
        // nie endlos auf dem Ladebildschirm hängen bleiben.
        this._renderApp();
        this._nav(state.view || initialView());
        liveNow();
        updateHeaderChip();
      } else {
        renderLoading();
      }
      setTimeout(() => this._init(), 30);
    }

    set hass(h) {
      state.hass = h;
      if (state.config) {
        liveNow();
        updateHeaderChip();
        updateDeviceLives();
      } else {
        this._init();
      }
    }

    async _init() {
      if (!state.hass || this._initialized) return;
      this._initialized = true;
      // Beim Öffnen kann PVM gerade neu laden – automatisch erneut versuchen,
      // statt sofort eine Fehlerseite zu zeigen.
      for (let i = 0; i < 6; i++) {
        try {
          await fetchConfig();
          this._renderApp();
          this._nav(state.view || initialView());
          liveNow();
          return;
        } catch (err) {
          if (i === 5) {
            if (state.config) {
              // Server gerade nicht erreichbar: letzten Stand anzeigen, damit
              // die Seite nie schwarz/leer bleibt.
              this._renderApp();
              this._nav(state.view || initialView());
              liveNow();
              toast("Aktualisierung fehlgeschlagen – es werden die letzten Daten angezeigt.", "bad");
            } else {
              renderError(String((err && err.message) || err));
            }
            return;
          }
          await new Promise((r) => setTimeout(r, 900));
        }
      }
    }

    _renderApp() {
      const root = state.root;
      if (!root) return;
      root.innerHTML = "";
      const style = document.createElement("style");
      style.textContent = CSS;
      root.appendChild(style);
      const wrap = buildShell();
      root.appendChild(wrap);
      applyTheme();
      subscribeLiveStates();
      startLiveLoop();
      this._nav("start");
    }

    _nav(view) {
      state.view = view;
      const root = state.root;
      if (!root) return;
      $$(root, "nav button").forEach((b) =>
        b.classList.toggle("on", b.getAttribute("data-view") === view));
      const container = $(root, "#view");
      if (!container) return;
      container.innerHTML = "";
      const section = document.createElement("section");
      section.className = "view";
      container.appendChild(section);
      let html = "";
      if (view === "start") html = htmlStart();
      else if (view === "overview") html = htmlOverview();
      else if (view === "devices") html = htmlDevices();
      else if (view === "order") html = htmlOrder();
      else if (view === "found") html = htmlFound();
      else if (view === "stats") html = htmlStats();
      else if (view === "settings") html = htmlSettings();
      section.innerHTML = html;
      liveNow();
      updateHeaderChip();
      updateDeviceLives();
      if (view === "stats") {
        // Verlauf erst laden, wenn die Sektion wirklich im DOM steht
        setTimeout(() => { drawStatChart(); loadStats(); }, 30);
      }
    }
  }
  customElements.define("pvm-panel", PvmPanel);

  function buildShell() {
    const root = document.createElement("div");
    root.className = "wrap";
    root.innerHTML = `
      <header>
        <div class="logo brand">${LOGO_SVG}</div>
        <div class="titles">
          <h1>PVM</h1>
          <p>${esc(L.tagline)}</p>
        </div>
        <div class="chips">
          <span class="chip"><span class="dot" data-el="statusdot"></span><span data-el="statuschip">…</span></span>
          <span class="chip">Überschuss <b data-live="surplus">–</b></span>
        </div>
        <button class="btn ghost" data-action="go-home" title="Zurück zu Home Assistant">${I.back} Home Assistant</button>
      </header>
      <nav>
        <button data-view="start">${I.sun} ${esc(L.nav.start)}${setupBadges().includes("intro") ? '<i class="navdot"></i>' : ""}</button>
        <button data-view="overview">${I.eye} ${esc(L.nav.overview)}</button>
        <button data-view="devices">${I.plug} ${esc(L.nav.devices)}${setupBadges().includes("devices") ? '<i class="navdot"></i>' : ""}</button>
        <button data-view="order">${I.list} ${esc(L.nav.order)}</button>
        <button data-view="found">${I.radar} ${esc(L.nav.found)}${setupBadges().includes("energy") ? '<i class="navdot"></i>' : ""}</button>
        <button data-view="stats">${I.chart} ${esc(L.nav.stats)}</button>
        <button data-view="settings">${I.gear} ${esc(L.nav.settings)}</button>
      </nav>
      <div id="view"></div>
    `;
    root.addEventListener("click", (ev) => onRootClick(root, ev));
    root.addEventListener("input", (ev) => onRootInput(root, ev));
    root.addEventListener("change", (ev) => onRootChange(root, ev));
    root.addEventListener("change", (ev) => onRootChange(root, ev));
    return root;
  }

  /* ------------------------------------------------------------------ *
   * Start-Ansicht
   * ------------------------------------------------------------------ */
  function energyStatus() {
    const e = configEnergy();
    const labels = [];
    if (e.pv_sensor) labels.push("PV-Leistung");
    if (gridSeparate()) {
      if (e.grid_import_sensor) labels.push("Netzbezug");
      if (e.grid_export_sensor) labels.push("Einspeisung");
      if (!e.grid_import_sensor && !e.grid_export_sensor) labels.push("Netz (getrennt) – noch nicht gewählt");
    } else {
      if (e.grid_sensor) labels.push("Netz (kombiniert)");
    }
    if (e.house_sensor) labels.push("Hausverbrauch");
    if (e.battery_power_sensor) labels.push("Speicher");
    const any = labels.length > 0;
    return { any, labels, text: labels.length ? labels.join(", ") : "keine Sensoren verbunden" };
  }

  function htmlStart() {
    const e = energyStatus();
    const devs = devicesOf();
    const ctl = devs.filter((d) => d.role !== "fahrzeug"); // steuerbare Geräte
    const s = configSettings();
    const introDone = !!s.intro_done;
    const allSteps = ["energy", "devices", "order", "design"];
    const stepState = {
      energy: e.any,
      devices: ctl.length > 0,
      order: ctl.length > 1,
      design: true,
    };
    const complete = e.any && ctl.length >= 1;
    const stepText = {
      energy: e.any
        ? "Verbunden: " + e.text
        : "PV-/Netz-Sensor verbinden – erst dann kennt PVM deinen Überschuss.",
      devices: ctl.length
        ? (ctl.length + (devs.length > ctl.length ? " + " + (devs.length - ctl.length) + " Auto" + (devs.length - ctl.length > 1 ? "s" : "") : "")) + " Gerät" + ((ctl.length + (devs.length > ctl.length ? 1 : 0)) > 1 ? "e" : "") + " konfiguriert"
        : (devs.length ? devs.length + " Auto(s) konfiguriert – füge ein steuerbares Gerät hinzu." : "Wallbox, Wärmepumpe oder Verbraucher hinzufügen – Schritt für Schritt gefragt."),
      order: ctl.length > 1
        ? "Prioritäten gesetzt – wer zuerst Überschuss bekommt."
        : "Bei mehreren Geräten legst du fest, wer zuerst bekommt.",
      design: "Design anpassen – dein Dashboard, deine Farben.",
    };
    const firstOpen = allSteps.find((sStep) => !stepState[sStep]) || allSteps[allSteps.length - 1];
    const quick = `
      <div class="cards">
        ${statCard("pv", "PV-Erzeugung", liveSurplusText("pv"))}
        ${statCard("surplus", "Überschuss", liveSurplusText("surplus"))}
        ${gridSeparate() ? statCard("grid_import", "Netzbezug", "–") + statCard("grid_export", "Einspeisung", "–") : statCard("grid", "Netz", "–")}
      </div>`;
    const hero = introDone ? `
      <div class="hero compact">
        <div class="sun"></div>
        <h2>Dein PV-Manager ☀️</h2>
        <p>Überschuss intelligent verteilen – live auf dieser Seite. <button class="btn ghost" data-action="intro-restart" style="padding:4px 10px;font-size:12px">Einführung erneut ansehen</button></p>
      </div>` : `
      <div class="hero">
        <div class="sun"></div>
        <h2>${(devs.length === 0 && !e.any) ? "Willkommen bei PV Manager ☀️" : "Dein PV-Manager"}</h2>
        <p>PV Manager verteilt deinen PV-Überschuss automatisch an Wallbox, Wärmepumpe und Verbraucher –
           sparsam und zuverlässig. In wenigen Schritten bist du fertig – alles direkt hier auf dieser Seite.</p>
        <div class="steps">
          ${allSteps.map((stepKey, i) => `
            <div class="step ${stepState[stepKey] ? "done" : ""} ${stepKey === firstOpen && !stepState[stepKey] ? "active" : ""}"
                 data-jump="${stepKey}">
              <div class="n">${stepState[stepKey] ? I.check : i + 1}</div>
              <b>${esc(stepLabel(stepKey))}</b>
              <span>${esc(stepText[stepKey])}</span>
            </div>`).join("")}
        </div>
        <div class="btnrow">
          <button class="btn primary" data-action="jump" data-to="energy">${I.grid} Energie-Sensoren</button>
          <button class="btn ghost" data-action="add-device">${I.plus} Gerät hinzufügen</button>
          <button class="btn ghost" data-action="run-scan">${I.radar} Automatisch suchen</button>
        </div>
        <div class="btnrow" style="margin-top:2px">
          <button class="btn ghost" data-action="setup-location" title="Steht deine PV-Anlage am Standort deiner Home-Assistant-Installation? Dann berechnet PVM die Prognose sofort kostenlos – ganz ohne API-Schlüssel.">${I.cloud} PV-Standort prüfen & Prognose aktivieren</button>
        </div>
        ${complete
          ? `<div class="btnrow" style="margin-top:2px"><button class="btn primary" data-action="intro-finish" style="padding:14px 26px;font-size:15px">🎉 Einführung beenden</button></div>`
          : `<div style="text-align:right;margin-top:6px"><button class="linkbtn" data-action="intro-skip">Einführung überspringen</button></div>`}
      </div>`;
    return `
      ${hero}
      ${(devs.length || e.any) ? `<h2 class="sec">Aktueller Stand</h2><p class="sub">${esc(e.text)} · ${ctl.length} Gerät${ctl.length === 1 ? "" : "e"}${ctl.length !== devs.length ? " (+ " + (devs.length - ctl.length) + " Auto" + (devs.length - ctl.length === 1 ? "" : "s") + ")" : ""}</p>` + quick + (devs.length ? `<div class="devices">${devs.map(htmlDeviceCard).join("")}</div>` : "") : ""}
    `;
  }

  function stepLabel(sStep) {
    return { energy: "Energie-Sensoren", devices: "Geräte hinzufügen", order: "Reihenfolge", design: "Design" }[sStep] || sStep;
  }
  function statCard(id, name, value) {
    return `<div class="stat"><div class="k">${name === "PV-Erzeugung" ? I.sun : name === "Überschuss" ? I.bolt : I.grid} ${esc(name)}</div>
      <div class="v"><span data-live="${id}">${esc(value)}</span></div></div>`;
  }
  function liveSurplusText(key) {
    const p = liveValue(key);
    return p ? p.text : "–";
  }

  /* ------------------------------------------------------------------ *
   * Live-Werte
   * ------------------------------------------------------------------ */
  function calcExport() {
    const e = configEnergy();
    const kind = e.grid_kind || "net";
    const grid = numW(e.grid_sensor);
    const pv = numW(e.pv_sensor);
    const house = numW(e.house_sensor);
    if (gridSeparate()) {
      // Zwei getrennte Zähler – der Überschuss ist die Einspeisung.
      if (e.grid_import_sensor || e.grid_export_sensor) {
        const imp = numW(e.grid_import_sensor);
        const exp = numW(e.grid_export_sensor);
        if (exp != null) return Math.max(0, exp);
        // Nur Bezug bekannt -> Überschuss unbekannt (nie fälschlich 0)
        if (e.grid_import_sensor) return null;
        return null;
      }
      // Noch keine Netz-Sensoren -> PV-Hausverbrauch als Anhaltspunkt
      if (e.pv_sensor && pv != null) {
        if (e.house_sensor && house != null) return Math.max(0, pv - house);
        return Math.max(0, pv);
      }
      return null;
    }
    if (e.grid_sensor && grid != null) {
      if (kind === "inverted") return Math.max(0, grid); // positiv = Einspeisung
      if (kind === "export_only") return Math.max(0, grid);
      return Math.max(0, -grid);
    }
    if (e.pv_sensor && pv != null) {
      if (e.house_sensor && house != null) return Math.max(0, pv - house);
      return Math.max(0, pv);
    }
    return null;
  }
  function liveValue(key) {
    const ent = state.entities || {};
    const e = configEnergy();
    if (key === "surplus") {
      // Überschuss IMMER zuerst direkt aus den Sensoren berechnen – so bleibt
      // die Anzeige aktuell, auch wenn der PVM-Überschuss-Sensor gerade alt
      // ist oder der letzte Zyklus ausfiel („Sensoren gehen nicht mehr“).
      const ex = calcExport();
      if (ex != null) {
        const val = Math.max(0, ex - Number(configSettings().reserve_w || 0));
        return { text: fmtW(val), raw: val };
      }
      const id = ent.surplus;
      const v = num(id);
      if (v != null) return { text: fmtNum(v, unitOf(id) || "W"), raw: v };
      return { text: "–", raw: 0 };
    }
    if (key === "pv") return { text: energyText("pv_sensor"), raw: 0 };
    if (key === "house") return { text: energyText("house_sensor"), raw: 0 };
    if (key === "grid") {
      if (gridSeparate()) {
        // Beide Richtungen bei getrennten Sensoren in einer Kachel zeigen
        const imp = numW(e.grid_import_sensor);
        const exp = numW(e.grid_export_sensor);
        if (imp == null && exp == null) return { text: "–", raw: 0 };
        const parts = [];
        if (imp != null) parts.push("↓ " + fmtW(imp));
        if (exp != null) parts.push("↑ " + fmtW(exp));
        return { text: parts.join("  "), raw: Math.max(0, imp || 0) };
      }
      return { text: energyText("grid_sensor"), raw: 0 };
    }
    if (key === "grid_import") {
      const v = numW(e.grid_import_sensor);
      return { text: v == null ? "–" : fmtW(v), raw: v == null ? 0 : v };
    }
    if (key === "grid_export") {
      const v = numW(e.grid_export_sensor);
      return { text: v == null ? "–" : fmtW(v), raw: v == null ? 0 : v };
    }
    if (key === "batt") return { text: energyText("battery_power_sensor"), raw: 0 };
    if (key.indexOf("devpwr:") === 0) {
      const d = deviceById(key.slice(7));
      const v = d ? numW(d.sensors && d.sensors.power) : null;
      return { text: v == null ? "–" : fmtW(v), raw: v == null ? 0 : v };
    }
    if (key.indexOf("devsoc:") === 0) {
      const d = deviceById(key.slice(7));
      const v = d ? num(d.sensors && d.sensors.soc) : null;
      return { text: v == null ? "–" : Math.round(v) + " %", raw: v == null ? 0 : v };
    }
    return null;
  }
  function energyText(key) {
    const e = configEnergy();
    const id = e[key];
    if (!id) return "–";
    const v = num(id);
    if (v == null) return "–";
    if (key === "grid_sensor") {
      // Richtung des kombinierten Sensors verständlich anzeigen
      const kind = e.grid_kind || "net";
      if (kind === "net") return v < 0 ? "↑ " + fmtW(-v) : "↓ " + fmtW(v);
      if (kind === "inverted") return v > 0 ? "↑ " + fmtW(v) : "↓ " + fmtW(-v);
      return v > 0 ? "↑ " + fmtW(v) : "–";
    }
    return fmtNum(v, unitOf(id));
  }
  let _liveT = 0;
  function liveNow() {
    const root = state.root;
    if (!root || !state.config) return;
    const now = Date.now();
    if (now - _liveT < 700) return;
    _liveT = now;
    $$(root, "[data-live]").forEach((el) => {
      const p = liveValue(el.getAttribute("data-live"));
      if (p && el.textContent !== p.text) el.textContent = p.text;
    });
  }

  /* Energiefluss-SVG live neu zeichnen (nur wenn sich Werte ändern) */
  function flowParams() {
    const e = configEnergy();
    const imp = numW(e.grid_import_sensor);
    const exp = numW(e.grid_export_sensor);
    const grid = numW(e.grid_sensor);
    const kind = e.grid_kind || "net";
    let importOn = false;
    let exportOn = false;
    if (gridSeparate()) {
      importOn = imp != null && imp > 40;
      exportOn = exp != null && exp > 40;
    } else if (grid != null) {
      if (kind === "net") {
        importOn = grid > 40;
        exportOn = -grid > 40;
      } else if (kind === "inverted") {
        importOn = grid < -40;  // negativ = Bezug
        exportOn = grid > 40;   // positiv = Einspeisung
      } else {
        exportOn = grid > 40;
      }
    }
    const surplus = liveValue("surplus");
    const devNames = devicesOf()
      .filter((d) => d.role !== "fahrzeug")
      .map((d) => d.name || "Gerät");
    return {
      pvRaw: numW(e.pv_sensor),
      houseV: numW(e.house_sensor),
      gridV: grid,
      imp,
      exp,
      batt: numW(e.battery_power_sensor),
      importOn,
      exportOn,
      surplusOn: surplus ? surplus.raw > 0 : false,
      devNames,
    };
  }

  function flowSignature() {
    const p = flowParams();
    return [
      p.pvRaw, p.houseV, p.gridV, p.imp, p.exp, p.batt,
      p.importOn, p.exportOn, p.surplusOn, p.devNames.join(","),
    ].join("|");
  }

  function updateFlow() {
    const root = state.root;
    if (!root || !state.config) return;
    const box = $(root, "[data-flow-svg]");
    if (!box) return;
    const sig = flowSignature();
    if (state.flowSig === sig) return;
    state.flowSig = sig;
    box.innerHTML = flowSvg(flowParams());
    const small = $(root, "[data-el=flowsmall]");
    if (small) {
      const p = flowParams();
      small.textContent = p.importOn
        ? "du holst Strom aus dem Netz"
        : p.exportOn
          ? "du speist Überschuss ein"
          : p.surplusOn
            ? "Überschuss fließt an deine Geräte"
            : "gerade kein Fluss";
    }
  }

  /* ------------------------------------------------------------------ *
   * Übersicht inkl. Energiefluss
   * ------------------------------------------------------------------ */
  function htmlOverview() {
    const devs = devicesOf();
    const e = configEnergy();
    const hasDevices = devs.length > 0;
    return `
      <h2 class="sec">Energie im Blick</h2>
      <p class="sub">${energySummaryText()}</p>
      <div class="cards">
        ${statCard("pv", "PV-Erzeugung", "–")}
        ${statCard("house", "Hausverbrauch", "–")}
        ${gridSeparate() ? statCard("grid_import", "Netzbezug", "–") + statCard("grid_export", "Einspeisung", "–") : statCard("grid", "Netz", "–")}
        ${e.battery_power_sensor ? statCard("batt", "Speicher", "–") : ""}
        ${statCard("surplus", "Überschuss für PVM", "–")}
      </div>
      <div class="flowbox">
        <div class="flowtitle">Dein Energiefluss
          <small data-el="flowsmall">…</small>
        </div>
        <div data-flow-svg>${flowSvg(flowParams())}</div>
        ${htmlFlowChips()}
      </div>
      <div class="flowbox">
        <div class="flowtitle">PVM-Geräte ${hasDevices ? "" : "– noch keine"}
          ${hasDevices ? "" : `<button class="btn ghost" data-action="add-device" style="padding:6px 12px;font-size:12.5px">${I.plus} Hinzufügen</button>`}
        </div>
        ${hasDevices ? `<div class="devices" style="margin-top:10px">${devs.map(htmlDeviceCard).join("")}</div>` : `<div class="empty">Füge Wallbox, Wärmepumpe oder Verbraucher hinzu – hier siehst du sie live.</div>`}
      </div>
    `;
  }

  function energySummaryText() {
    const s = configSettings();
    const mode = s.mode || "auto";
    const reserve = s.reserve_w || 0;
    const devs = devicesOf();
    const head = s.manual_mode ? "Manuell – PVM misst nur" : "Modus „" + L.modes[mode] + "“";
    return head + " · Reserve " + fmtW(reserve) +
      (devs.length ? " · " + devs.length + " Gerät" + (devs.length > 1 ? "e" : "") : "");
  }

  function flowSvg(o) {
    const W = 680, H = 250;
    const boxW = 150, boxH = 56;
    const rowY = 18;
    // Positionen: PV(links) Haus(mitte) Netz(rechts) Speicher(links unten)
    const px = 20, hx = (W - boxW) / 2, gx = W - boxW - 20;
    const centerY = rowY + boxH / 2;      // 46
    const hubY = 138;                      // Überschuss-Hub
    const hubX = (W - 220) / 2;
    const batX = 20, batY = 128;
    const col = {
      pv: "#ffb020", haus: "#7cc4ff", netz: "#ff7b8a", surplus: "var(--acc)", green: "#2dd4a7",
    };
    const node = (x, y, w, h, name, val, fill) => `
      <g class="nbox">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14"
              fill="rgba(255,255,255,.05)" stroke="${fill}" stroke-width="1.3"
              stroke-dasharray="${fill ? "0" : ""}"/>
        <text x="${x + w / 2}" y="${y + 24}" text-anchor="middle" class="nm">${esc(name)}</text>
        <text x="${x + w / 2}" y="${y + 44}" text-anchor="middle" class="nv">${esc(val)}</text>
      </g>`;
    const arrow = (x1, y1, x2, y2, color, cls, label, lx, ly) => `
      <path class="path ${cls || ""}" d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="3"/>
      ${label ? `<text x="${lx}" y="${ly}" text-anchor="middle" class="lbl">${esc(label)}</text>` : ""}`;

    const parts = [];
    const dash = (v) => v == null ? "–" : fmtW(v);
    // --- Knoten ---
    parts.push(node(px, rowY, boxW, boxH, "PV", dash(o.pvRaw), col.pv));
    parts.push(node(hx, rowY, boxW, boxH, "Haus", dash(o.houseV), col.haus));
    parts.push(node(gx, rowY, boxW, boxH, "Netz", netValue(o), col.netz));
    if (o.batt != null)
      parts.push(node(batX, batY, boxW, boxH - 6, "Speicher", fmtW(Math.abs(o.batt)), "#3ecf8e"));
    parts.push(node(hubX, hubY, 220, 54, "PVM-Überschuss", liveSurplusText("surplus"), col.surplus));

    // --- Verbindungen (obere Reihe) ---
    // PV -> Haus
    if (o.pvRaw != null && o.pvRaw > 40)
      parts.push(arrow(px + boxW, centerY, hx - 8, centerY, col.pv, "slow", "Eigenverbrauch", (px + boxW + hx - 8) / 2, centerY - 9));
    // Haus <-> Netz: Import (rot, rückwärts) oder Export (grün)
    if (o.importOn)
      parts.push(arrow(gx, centerY, hx + boxW + 8, centerY, col.netz, "", "Netzbezug", (gx + hx + boxW + 8) / 2, centerY - 9));
    else if (o.exportOn)
      parts.push(arrow(hx + boxW, centerY, gx - 8, centerY, col.green, "slow", "Einspeisung", (hx + boxW + gx - 8) / 2, centerY - 9));
    // --- Speicher <-> Hub ---
    if (o.batt != null && Math.abs(o.batt) > 40) {
      const charging = o.batt > 0; // positiv = Laden (Hub -> Speicher)
      parts.push(arrow(
        charging ? hubX - 8 : batX + boxW,
        batY + boxH / 2 - 3,
        charging ? batX + boxW : hubX - 8,
        batY + boxH / 2 - 3,
        col.green, charging ? "" : "slow",
        charging ? "Laden" : "Entladen",
        batX + boxW + 44, batY + boxH / 2 - 12
      ));
    }
    // --- zum Hub (aus PV, vertikal) ---
    if (o.surplusOn)
      parts.push(arrow(hx + boxW / 2, rowY + boxH, hx + boxW / 2, hubY - 8, col.surplus, "", "Überschuss", hx + boxW / 2 + 58, (rowY + boxH + hubY) / 2));
    // --- Hub -> Geräte (jedes Gerät ist eine eigene Box unter dem Fluss) ---
    if (o.surplusOn && o.devNames.length)
      parts.push(arrow(hubX + 110, hubY + 54, hubX + 110, H - 6, col.surplus, ""));
    if (o.devNames.length)
      parts.push(`<text x="${hubX + 118}" y="${H - 12}" text-anchor="middle" class="lbl">↓ an deine Geräte</text>`);
    return `<svg class="flow" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
  }

  /* Jedes Gerät wird unter dem Energiefluss zu einer eigenen, dynamischen
   * Box – mit echter Leistung (Sensor) oder geschätzter Leistung (falls das
   * Gerät keine Messung liefert, aber läuft). Skaliert bis zu vielen Geräten
   * (auto-fill-Grid). */
  function htmlFlowChips() {
    const devs = devicesOf().filter((d) => d.role !== "fahrzeug");
    if (!devs.length) return "";
    return `<div class="flowdevs">${devs.map((d) => `
      <div class="fdev" data-device="${esc(d.id)}" data-action="open-device" data-flowchip="1" title="${esc(d.name || "Gerät")} – Details & Einstellungen">
        <span class="fic">${ROLE_ICON[d.role] || I.plug}</span>
        <span style="min-width:0;flex:1">
          <div class="fname">${esc(d.name || "Gerät")}</div>
          <div class="fpw" data-el="chip-pw">–</div>
        </span>
      </div>`).join("")}</div>`;
  }

  /* Genaue oder geschätzte Leistung eines Geräts für die Fluss-Boxen */
  function flowChipPower(d) {
    const pid = d.sensors && d.sensors.power;
    const v = pid ? numW(pid) : null;
    if (v != null) return { text: fmtW(v), real: true };
    const running = deviceIsRunning(d);
    const est =
      d.role === "waermepumpe" ? (d.wp && d.wp.est_power_w)
      : d.role === "wallbox" ? (d.limits && d.limits.power_limit_w)
      : (d.limits && d.limits.nominal_power_w);
    if (running && est) return { text: "~ " + fmtW(est), real: false };
    return null;
  }

  function deviceIsRunning(d) {
    const s = st(entOf(d.id).status);
    if (s && s.state === "on") return true;
    const v = numW(d.sensors && d.sensors.power);
    if (v != null) return v > 60;
    return false;
  }

  function updateFlowChips() {
    const root = state.root;
    if (!root) return;
    devicesOf().forEach((d) => {
      const chip = $(root, '.fdev[data-flowchip="1"][data-device="' + cssEsc(d.id) + '"]');
      if (!chip) return;
      const pw = flowChipPower(d);
      const el = $(chip, "[data-el=chip-pw]");
      if (el && el.textContent !== (pw ? pw.text : "–")) el.textContent = pw ? pw.text : "–";
      chip.classList.toggle("off", !pw);
    });
  }
  function netValue(o) {
    // Netz-Knoten: getrennte Bezug-/Einspeisung-Sensoren -> beide anzeigen
    if (gridSeparate()) {
      const imp = o.imp != null ? o.imp : 0;
      const exp = o.exp != null ? o.exp : 0;
      return `↓ ${fmtW(imp)}  ↑ ${fmtW(exp)}`;
    }
    const g = o.gridV;
    const kind = (configEnergy().grid_kind) || "net";
    if (g == null) return "–";
    if (kind === "inverted") return g > 0 ? "↑ " + fmtW(g) : "↓ " + fmtW(-g);
    if (kind === "export_only") return g > 0 ? "↑ " + fmtW(g) : "–";
    if (g > 0) return "↓ " + fmtW(g); // Bezug
    return "↑ " + fmtW(-g); // Einspeisung
  }

  /* ------------------------------------------------------------------ *
   * Geräte
   * ------------------------------------------------------------------ */
  function htmlDevices() {
    const devs = devicesOf();
    const cars = devs.filter((d) => d.role === "fahrzeug");
    const others = devs.filter((d) => d.role !== "fahrzeug");
    const empty = `
      <div style="border:1px dashed var(--line);border-radius:16px;margin-top:16px;padding:34px 16px;text-align:center;color:var(--mut)">
        Noch keine Geräte.
        <div style="margin-top:12px"><button class="btn primary" data-action="add-device">${I.plus} Jetzt hinzufügen</button></div>
      </div>`;
    const autoPairing = !!configSettings().auto_pairing;
    return `
      <h2 class="sec">Geräte & Verbraucher</h2>
      <p class="sub">Tippe auf eine Karte, um alle Details und Einstellungen zu sehen.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        <button class="btn primary" data-action="add-device">${I.plus} Gerät hinzufügen</button>
        <button class="btn ghost" data-action="run-scan">${I.radar} Automatisch suchen</button>
      </div>
      ${others.length ? `<div class="devices" style="margin-top:14px">${others.map(htmlDeviceCard).join("")}</div>` : (devs.length ? "" : empty)}
      ${cars.length ? `
        <h2 class="sec" style="margin-top:22px">🚗 E-Autos
          <span style="font-weight:400;color:var(--mut);font-size:12.5px"> – ${autoPairing ? "PVM erkennt automatisch, an welcher Wallbox jedes Auto lädt." : "Zuordnung über die Heimat-Wallbox im Auto-Dialog."}</span>
        </h2>
        <div class="devices" style="margin-top:10px">${cars.map(htmlDeviceCard).join("")}</div>` : ""}
    `;
  }

  function htmlDeviceCard(device) {
    const role = device.role || "verbraucher";
    if (role === "fahrzeug") return htmlCarCard(device);
    const ent = entOf(device.id);
    const autoOn = isOn(ent.auto);
    const pid = device.sensors && device.sensors.power;
    const tags = [
      { t: "Prio " + (rankOf(device.id) || "–"), cls: "tag" },
      { t: L.roles[role] || role, cls: "tag role" },
    ];
    const ctrl = device.control || {};
    if (ctrl.type === "buttons") tags.push({ t: "2 Taster", cls: "tag" });
    else if (ctrl.type === "wp_temp") tags.push({ t: "Temp-Ziel", cls: "tag" });
    else if (ctrl.has_limiter) tags.push({ t: "Leistungs-Limit", cls: "tag" });
    // Ziel-Kachel für Wallboxen setzt der Live-Update anhand des
    // zugeordneten Autos (Auto & Wallbox sind getrennt, koppeln sich aber
    // automatisch – siehe updateDeviceLives).
    let goalTxt = "";
    if (role !== "wallbox") {
      const car = device.car;
      if (car) {
        goalTxt = "Ziel " + Math.round(car.min_soc || 0) + "–" + Math.round(car.max_soc || 100) + " %";
        if (Number(car.deadline_soc || 0) > 0 && car.deadline_time)
          goalTxt += " · bis " + car.deadline_time + " → " + Math.round(car.deadline_soc) + " %";
        if (car.manual_force) goalTxt += " · Power Charge an";
      }
    }
    return `
      <div class="dev" data-device="${esc(device.id)}" data-action="open-device" title="Details & Einstellungen">
        <div class="head">
          <div class="ic">${ROLE_ICON[role] || I.plug}</div>
          <h3>${esc(device.name || "Gerät")}</h3>
          <span class="pill" data-el="pill">…</span>
        </div>
        <div class="mid">
          ${pid ? `<div class="bigw" data-live="devpwr:${esc(device.id)}">–</div>` : ""}
        </div>
        ${role === "wallbox" ? `<div class="goal" data-el="assigned-car"></div>` : ""}
        ${goalTxt ? `<div class="goal">${esc(goalTxt)}</div>` : ""}
        <div class="statusline" data-el="statusline">…</div>
        <div class="tags">${tags.map((t) => `<span class="${t.cls}">${esc(t.t)}</span>`).join("")}</div>
        <div class="ops" style="align-items:center;gap:8px">
          <span class="seg" style="margin-right:auto" title="Automatisch: PVM entscheidet selbst. Manuell: du steuerst direkt – PVM lässt das Gerät in Ruhe.">
            <button class="${autoOn ? "on" : ""}" data-action="set-dev-mode" data-automode="auto" data-device="${esc(device.id)}" title="Automatik: PVM entscheidet">Auto</button>
            <button class="${autoOn ? "" : "man"}" data-action="set-dev-mode" data-automode="man" data-device="${esc(device.id)}" title="Manuell: du steuerst selbst">Manuell</button>
          </span>
          <button class="ico" data-action="manual-open" data-device="${esc(device.id)}" title="Jetzt steuern (nur bei Manuell)">${I.gear}</button>
          <button class="ico" data-action="edit-device" data-device="${esc(device.id)}" title="Bearbeiten">${I.edit}</button>
          <button class="ico" data-action="del-device" data-device="${esc(device.id)}" title="Entfernen">${I.del}</button>
        </div>
        ${manualControlsHtml(device, autoOn)}
      </div>`;
  }

  /* Kleines Ausklapp-Menü für die manuelle Steuerung direkt auf der Karte */
  function manualControlsHtml(device, autoOn) {
    return `
      <div class="devctl" data-el="devctl" data-device="${esc(device.id)}" data-auto="${autoOn ? "1" : "0"}" style="display:none">
        ${manualControlsInner(device, autoOn)}
      </div>`;
  }
  function manualControlsInner(device, autoOn) {
    const c = device.control || {};
    const ctl = [];
    const hint = `<div class="ctlline"><small style="color:var(--mut)">${autoOn ? "PVM steuert – Umschalten auf „Manuell“ zum Selbersteuern." : "Manuell – PVM steuert dieses Gerät gerade nicht."}</small></div>`;
    if (!autoOn) {
      if (c.type === "wp_temp" && c.temp_entity) {
        const v = num(c.temp_entity);
        // Regler an die echten Grenzen der Entität anpassen (z. B. Viessmann:
        // 30–70 °C) – sonst lehnt die Entität den Wert ab (out_of_range).
        const rng = numberEntityRange(c.temp_entity, { lo: 40, hi: 80, step: 0.5 });
        const start = v == null ? (device.wp && device.wp.boost_c) || 60 : v;
        const clamped = Math.min(rng.hi, Math.max(rng.lo, start));
        ctl.push(`
          <div class="ctlline"><b>Ziel-Temperatur</b>
            <input type="range" data-manual-temp min="${rng.lo}" max="${rng.hi}" step="${rng.step}" value="${clamped}" style="flex:1" data-target="${esc(c.temp_entity)}" data-unit="°C" data-device="${esc(device.id)}">
            <b class="numval">${esc(fmtNum(clamped, "°C"))}</b>
          </div>`);
      } else if (c.type === "buttons" && c.on_entity && c.off_entity) {
        ctl.push(`<div class="ctlline"><b>Start / Stopp</b>
          <button class="btn primary" data-action="dev-cmd" data-cmd="start" data-device="${esc(device.id)}" style="padding:6px 14px">Start</button>
          <button class="btn ghost" data-action="dev-cmd" data-cmd="stop" data-device="${esc(device.id)}" style="padding:6px 14px">Stopp</button></div>`);
      } else if (c.switch_entity) {
        ctl.push(`<div class="ctlline"><b>Gerät</b>
          <button class="btn primary" data-action="dev-cmd" data-cmd="on" data-device="${esc(device.id)}" style="padding:6px 14px">${I.bolt} Einschalten</button>
          <button class="btn ghost" data-action="dev-cmd" data-cmd="off" data-device="${esc(device.id)}" style="padding:6px 14px">Ausschalten</button></div>`);
      }
      if (c.has_limiter && c.number_entity) {
        const limit = numberEntityRange(c.number_entity, manualLimitRange(c));
        const v = num(c.number_entity);
        const start = v == null ? (limit.lo + limit.hi) / 2 : v;
        const clamped = Math.min(limit.hi, Math.max(limit.lo, start));
        ctl.push(`
          <div class="ctlline"><b>Leistung ${c.number_unit || "W"}</b>
            <input type="range" data-manual-limit min="${limit.lo}" max="${limit.hi}" step="${limit.step}" value="${clamped}" style="flex:1" data-target="${esc(c.number_entity)}" data-unit="${esc(c.number_unit || "W")}" data-device="${esc(device.id)}">
            <b class="numval">${esc(fmtNum(clamped, c.number_unit || "W"))}</b>
          </div>`);
      }
    }
    if (!ctl.length && autoOn) ctl.push(`<div class="ctlline"><small style="color:var(--mut)">Automatik ist aktiv. Schalte auf „Manuell", um hier selbst zu steuern.</small></div>`);
    return `${hint}${ctl.join("")}`;
  }
  function manualLimitRange(c) {
    const u = c.number_unit || "W";
    return { W: { lo: 500, hi: 22000, step: 100 }, kW: { lo: 0.5, hi: 22, step: 0.1 },
      A: { lo: 3, hi: 63, step: 0.5 }, mA: { lo: 3000, hi: 63000, step: 500 } }[u] || { lo: 0, hi: 100, step: 1 };
  }
  /** Echte Grenzen einer Nummern-Entität aus HA (min/max/step) – schlägt die
   *  des Geräts fehl, fällt der Regler auf die gewünschten Defaults zurück.
   *  So schickt die manuelle Steuerung nie Werte, die die Entität ablehnt. */
  function numberEntityRange(entityId, fallback) {
    const s = st(entityId);
    const a = s && s.attributes ? s.attributes : {};
    const f = (k) => {
      const v = parseFloat(a[k]);
      return isNaN(v) ? null : v;
    };
    const lo = f("min"), hi = f("max"), stp = f("step");
    return {
      lo: lo != null ? lo : fallback.lo,
      hi: hi != null ? hi : fallback.hi,
      step: stp && stp > 0 ? stp : fallback.step,
    };
  }

  function htmlCarCard(device) {
    const sid = device.sensors && device.sensors.soc;
    const pid = device.sensors && device.sensors.power;
    const socV = num(sid);
    const car = device.car || {};
    // Ohne SoC-Sensor bzw. ohne gültigen Wert keine Akku-Anzeige erfinden –
    // fehlende Daten werden ausgeblendet statt mit „–“ angezeigt.
    const hasSoc = !!sid && socV != null;
    const goalTxt = hasSoc ? "Ziel " + Math.round(car.min_soc || 0) + "–" + Math.round(car.max_soc || 100) + " %" : "";
    return `
      <div class="dev" data-device="${esc(device.id)}" data-action="open-device" title="Details & Einstellungen">
        <div class="head">
          <div class="ic">${I.car}</div>
          <h3>${esc(device.name || "Auto")}</h3>
          <span class="pill" data-el="pill">…</span>
        </div>
        <div class="mid">
          ${pid ? `<div class="bigw" data-live="devpwr:${esc(device.id)}">–</div>` : ""}
        </div>
        ${hasSoc ? `
          <div class="soc">
            <div class="row"><span>Akku</span><span data-live="devsoc:${esc(device.id)}">–</span></div>
            <div class="socbar"><i id="socbar-${esc(device.id)}" style="width:${Math.max(0, Math.min(100, socV))}%"></i></div>
          </div>` : ""}
        ${goalTxt ? `<div class="goal">${esc(goalTxt)}</div>` : ""}
        <div class="statusline" data-el="statusline">…</div>
        <div class="ops" style="justify-content:flex-end">
          <button class="ico" data-action="edit-device" data-device="${esc(device.id)}" title="Bearbeiten">${I.edit}</button>
          <button class="ico" data-action="del-device" data-device="${esc(device.id)}" title="Entfernen">${I.del}</button>
        </div>
      </div>`;
  }

  function deviceStateText(device) {
    if (device.role === "fahrzeug") {
      const s = st(entOf(device.id).car_status);
      if (s && s.state && !["unknown", "unavailable"].includes(s.state)) return s.state;
      return "unterwegs";
    }
    const s = st(entOf(device.id).status);
    if (s && s.state && !["unknown", "unavailable"].includes(s.state)) return s.state;
    const v = numW(device.sensors && device.sensors.power);
    if (v != null && v > 60) return "läuft gerade";
    return "wartet auf PVM";
  }

  function statusPillFor(device) {
    // Wichtig: data-el="pill" immer mit ausgeben, damit der Live-Update
    // den Status weiterhin findet (sonst friert der Status ein).
    const el = ' data-el="pill"';
    const txt = deviceStateText(device);
    if (device.role === "fahrzeug") {
      if (/^lädt\b/.test(txt)) return `<span class="pill on"${el}>LÄDT</span>`;
      return `<span class="pill"${el}>unterwegs</span>`;
    }
    const autoOn = isOn(entOf(device.id).auto);
    if (!autoOn) return `<span class="pill"${el}>Automatik aus</span>`;
    if (/^an\b|^läuft/i.test(txt)) return `<span class="pill on"${el}>AN</span>`;
    if (/fehler/i.test(txt)) return `<span class="pill warn"${el}>Fehler</span>`;
    if (/^aus\b/i.test(txt)) return `<span class="pill"${el}>aus</span>`;
    return `<span class="pill"${el}>bereit</span>`;
  }

  function updateDeviceLives() {
    const root = state.root;
    if (!root || !state.config) return;
    updateFlowChips();
    devicesOf().forEach((d) => {
      const card = $(root, '[data-device="' + cssEsc(d.id) + '"]');
      if (!card) return;
      const pill = $(card, '[data-el="pill"]');
      if (pill) {
        const want = statusPillFor(d);
        if (pill.outerHTML !== want) pill.outerHTML = want;
      }
      const line = $(card, '[data-el="statusline"]');
      if (line) line.textContent = deviceStateText(d);
      const sid = d.sensors && d.sensors.soc;
      const bar = $(card, "#socbar-" + cssEsc(d.id));
      if (bar) {
        const v = num(sid);
        bar.style.width = (v == null ? 0 : Math.max(0, Math.min(100, v))) + "%";
      }
      const autoNow = isOn(entOf(d.id).auto);
      $$(card, '[data-action="set-dev-mode"]').forEach((b) => {
        const man = b.getAttribute("data-automode") === "man";
        b.classList.toggle("on", !man && autoNow);
        b.classList.toggle("man", man && !autoNow);
      });
      // Auto/Manuell gewechselt: Ausklapp-Inhalt sofort aktualisieren,
      // damit die Regler/Knöpfe ohne Neuladen erscheinen (und wieder
      // verschwinden, wenn PVM die Steuerung zurücknimmt).
      const devctl = $(card, '[data-el="devctl"]');
      if (devctl) {
        const flag = autoNow ? "1" : "0";
        if (devctl.getAttribute("data-auto") !== flag) {
          const wasOpen = devctl.style.display === "block";
          devctl.setAttribute("data-auto", flag);
          devctl.innerHTML = manualControlsInner(d, autoNow);
          if (wasOpen) devctl.style.display = "block";
        }
      }
      // Wallbox: zeigt das zugeordnete Auto an (live ladend, sonst gelernt)
      const assigned = $(card, '[data-el="assigned-car"]');
      if (assigned) {
        const all = devicesOf().filter((c) => c.role === "fahrzeug");
        const live = all.filter((c) => {
          const s = st(entOf(c.id).car_status);
          return s && s.attributes && s.attributes.wallbox_id === d.id;
        });
        const home = all.filter((c) => (c.car || {}).home_wallbox === d.id && !live.includes(c));
        const txt =
          (live.length ? "🚗 " + live.map((c) => c.name || "Auto").join(", ") : "") +
          (home.length ? (live.length ? " · " : "") + "🏠 " + home.map((c) => c.name || "Auto").join(", ") + " (zu Hause)" : "");
        if (assigned.textContent !== txt) assigned.textContent = txt;
        // Ziel-Kachel zeigt die Wünsche des zugeordneten Autos (Auto & Wallbox
        // sind getrennt, koppeln sich aber automatisch).
        const goalCar = live[0] || home[0] || d;
        const gcar = (goalCar.car || {});
        let goalTxt = "Ziel " + Math.round(gcar.min_soc || 0) + "–" + Math.round(gcar.max_soc || 100) + " %";
        if (Number(gcar.deadline_soc || 0) > 0 && gcar.deadline_time)
          goalTxt += " · bis " + gcar.deadline_time + " → " + Math.round(gcar.deadline_soc) + " %";
        if (gcar.manual_force) goalTxt += " · Power Charge an";
        const goalEl = $(card, '.goal[data-el="wb-goal"]');
        if (!goalEl && goalTxt) {
          const div = document.createElement("div");
          div.className = "goal";
          div.setAttribute("data-el", "wb-goal");
          div.textContent = goalTxt;
          const statusline = $(card, '[data-el="statusline"]');
          assigned.insertAdjacentElement("afterend", div);
        } else if (goalEl && goalEl.textContent !== goalTxt) {
          goalEl.textContent = goalTxt;
        }
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Reihenfolge
   * ------------------------------------------------------------------ */
  function htmlOrder() {
    const devs = devicesOf().filter((d) => d.role !== "fahrzeug");
    if (!devs.length) {
      return `<h2 class="sec">Reihenfolge</h2>
        <p class="sub">Wer zuerst Überschuss bekommt, legst du hier fest.</p>
        <div style="border:1px dashed var(--line);border-radius:16px;margin-top:16px;padding:30px;text-align:center;color:var(--mut)">
          Noch keine Geräte – füge zuerst welche hinzu.</div>`;
    }
    return `
      <h2 class="sec">Reihenfolge (Prioritäten)</h2>
      <p class="sub">Oben = höchste Priorität. Wer zuerst da ist, bekommt zuerst Überschuss.<br><small>Autos (reine Überwachung) stehen hier bewusst nicht – sie verbrauchen nur, wenn sie an einer Wallbox laden.</small></p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px" data-el="orderlist">
        ${devs.map((d, i) => `
          <div class="row" style="background:var(--card);border:1px solid var(--line);border-radius:13px;padding:10px 12px" data-device="${esc(d.id)}">
            <span style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:800;
              background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;flex:0 0 auto">${i + 1}</span>
            <b class="grow">${esc(d.name || "Gerät")}</b>
            <span class="tag" style="text-transform:none">${esc((L.roles[d.role] || d.role))}</span>
            <button class="ico" data-action="move-dev" data-device="${esc(d.id)}" data-dir="-1" title="Höher (mehr Priorität)">${I.up}</button>
            <button class="ico" data-action="move-dev" data-device="${esc(d.id)}" data-dir="1" title="Tiefer">${I.down}</button>
          </div>`).join("")}
      </div>
      <p class="sub" style="margin-top:14px">Änderungen speichert PVM sofort – die Reihenfolge gilt ab jetzt.</p>`;
  }

  /* ------------------------------------------------------------------ *
   * Gefunden (Scan)
   * ------------------------------------------------------------------ */
  function htmlFound() {
    const sets = (state.scan && state.scan.sets) || [];
    const measures = sets.filter((s) => ["pv", "grid", "grid_import", "grid_export", "house"].includes(s.role));
    const devs = sets.filter((s) => !["pv", "grid", "grid_import", "grid_export", "house"].includes(s.role));
    const rl = (r) => ({ pv: "PV-Leistung", grid: "Netz", grid_import: "Netzbezug (separat)", grid_export: "Einspeisung (separat)", house: "Haus", wallbox: "Wallbox", wp: "Wärmepumpe", verbraucher: "Verbraucher", fahrzeug: "Auto" }[r] || r);
    return `
      <h2 class="sec">Automatisch gefunden</h2>
      <p class="sub">PVM durchsucht deine Geräte nach passenden Sensoren und Verbrauchern. Du übernimmst nur, was wirklich deins ist.</p>
      <button class="btn primary" data-action="run-scan">${I.radar} Jetzt suchen</button>
      ${(measures.length || devs.length) ? `
        ${measures.length ? `<h2 class="sec" style="margin-top:18px">Messungen</h2>` + measures.map((m) => foundHtml(m, "measure", rl(m.role))).join("") : ""}
        ${devs.length ? `<h2 class="sec" style="margin-top:18px">Geräte</h2>` + devs.map((m) => foundHtml(m, "device", rl(m.role))).join("") : ""}`
      : `<div class="empty" style="border:1px dashed var(--line);border-radius:16px;margin-top:16px;padding:26px">
           Noch keine Vorschläge. Starte die Suche – alles Gefundene erscheint hier mit einem Klick zum Übernehmen.</div>`}
    `;
  }
  function foundHtml(f, kind, roleLabel) {
    const fields = f.fields || {};
    const id = fields.entity || fields.power_sensor || fields.switch_entity || fields.temp_sensor || "";
    const extra = fields.soc_sensor ? " · SoC: " + esc(fields.soc_sensor) : "";
    const desc = id
      ? esc(friendlyOf(id)) + " · " + esc(id) + extra
      : "Mehrere passende Entitäten – PVM füllt das Formular vor.";
    return `
      <div class="founditem">
        <div class="grow">
          <h4>${esc(f.title || "Gefunden")}</h4>
          <p><span class="tag role" style="margin-right:6px">${esc(roleLabel)}</span>${desc}</p>
        </div>
        <button class="btn ghost" data-action="adopt" data-idx="${setsIndexOf(f)}">Übernehmen</button>
      </div>`;
  }
  function setsIndexOf(f) {
    const sets = (state.scan && state.scan.sets) || [];
    return sets.indexOf(f);
  }

  /* ------------------------------------------------------------------ *
   * Statistik: Leistungs-Charts + PV-Prognose (alles selbst gebaut, SVG)
   * ------------------------------------------------------------------ */
  const STAT_COLORS = {
    pv: "#ffb020", house: "#4fc3f7", grid: "#ff7b8a", grid_import: "#ef5350",
    grid_export: "#26c6a0", batt: "#3ecf8e", wallbox: "#ab6bff", devices: "#ff9f6b",
    forecast: "#90caf9",
  };
  const STAT_LABELS = {
    pv: "PV", house: "Haus", grid: "Netz", grid_import: "Netzbezug",
    grid_export: "Einspeisung", batt: "Speicher", wallbox: "Wallboxen", devices: "Geräte",
  };
  const STAT_MODES = [
    { id: "all", label: "Alles" },
    { id: "pv", label: "Nur PV" },
    { id: "consum", label: "Verbraucher" },
    { id: "walls", label: "Wallboxen" },
    { id: "grid", label: "Netz" },
  ];
  const statState = {
    rangeH: 24,
    mode: "all",
    type: "area",
    // Standard = „Alles“: jede vorhandene Reihe ist an (statModeSets hält
    // die Modi synchron, einzelne Reihen lassen sich per Chip abwählen).
    on: { pv: true, house: true, grid: true, grid_import: true, grid_export: true, batt: true, wallbox: true, devices: true },
    data: null,
    forecast: null,
    loading: false,
  };
  function statDefaultOn() { return { pv: true, house: true, grid: true, grid_import: true, grid_export: true, batt: true, wallbox: true, devices: true }; }

  function statSources() {
    // Entity-Quellen je Serie (die überhaupt konfiguriert sind)
    const e = configEnergy();
    const devs = devicesOf();
    const src = {};
    const put = (k, list) => { if (list.length) src[k] = list; };
    put("pv", [e.pv_sensor].filter(Boolean));
    put("house", [e.house_sensor].filter(Boolean));
    put("batt", [e.battery_power_sensor].filter(Boolean));
    if (gridSeparate()) {
      put("grid_import", [e.grid_import_sensor].filter(Boolean));
      put("grid_export", [e.grid_export_sensor].filter(Boolean));
    } else {
      put("grid", [e.grid_sensor].filter(Boolean));
    }
    put("wallbox", devs.filter((d) => d.role === "wallbox" && d.sensors && d.sensors.power)
      .map((d) => d.sensors.power));
    put("devices", devs.filter((d) => d.role !== "wallbox" && d.role !== "fahrzeug" && d.sensors && d.sensors.power)
      .map((d) => d.sensors.power));
    return src;
  }

  function statModeSets(mode) {
    const base = { pv: true, house: true, grid: false, grid_import: false, grid_export: false, batt: false, wallbox: false, devices: false };
    if (mode === "all") {
      return { pv: true, house: true, grid: true, grid_import: true, grid_export: true, batt: true, wallbox: true, devices: true };
    }
    if (mode === "pv") { base.pv = true; base.house = false; return base; }
    if (mode === "grid") { base.grid = true; base.grid_import = true; base.grid_export = true; return base; }
    if (mode === "walls") {
      base.pv = false; base.wallbox = true; return base;
    }
    if (mode === "consum") {
      base.pv = false; base.house = true; base.devices = true; return base;
    }
    return base;
  }

  function htmlStats() {
    const has = Object.keys(statSources()).length;
    return `
      <h2 class="sec">${I.chart} Statistik & Prognose</h2>
      <p class="sub">Welche Leistung lief wann? Wähle einen Blick – jede Reihe lässt sich unten einzeln an- und abwählen (ausgegraut = ausgeblendet).</p>
      <div class="stattools">
        <span class="chiprow" style="margin:0">${STAT_MODES.map((m) => `<button class="serieschip ${statState.mode === m.id ? "on" : ""}" data-action="stat-mode" data-stat-mode="${m.id}">${m.label}</button>`).join("")}</span>
        <button class="btn ghost" data-action="stat-range" data-stat-range="24" style="padding:5px 10px">24 h</button>
        <button class="btn ghost" data-action="stat-range" data-stat-range="168" style="padding:5px 10px">7 Tage</button>
        <button class="btn ghost" data-action="stat-type" data-stat-type="area" style="padding:5px 10px">Fläche</button>
        <button class="btn ghost" data-action="stat-type" data-stat-type="line" style="padding:5px 10px">Linie</button>
        <button class="btn ghost" data-action="stat-refresh" style="padding:5px 10px">${I.wifi} Aktualisieren</button>
      </div>
      ${has ? `
        <div class="chartbox" data-el="stat-chart"><span style="color:var(--mut)">Lade Verlauf …</span></div>
        <div class="chiprow" data-el="stat-series"></div>
      ` : `<div class="empty" style="border:1px dashed var(--line);border-radius:16px;padding:22px">Verbinde zuerst Energie-Sensoren (PV, Netz) – dann erscheint hier dein Verlauf.</div>`}
      <div class="flowbox" style="margin-top:14px">
        <div class="flowtitle">${I.cloud} PV-Prognose
          <small>erwartete Leistung: nächste 15 Min, 3 h, ganzer Tag</small>
        </div>
        <div data-el="stat-forecast"><span style="color:var(--mut)">…</span></div>
      </div>
    `;
  }

  function statActiveSeries() {
    const src = statSources();
    return Object.keys(statState.on).filter((k) => statState.on[k] && src[k]);
  }

  async function loadStats() {
    if (statState.loading) return;
    statState.loading = true;
    const src = statSources();
    const root = state.root;
    const chartEl = root && $(root, "[data-el=stat-chart]");
    try {
      if (!state.hass || !state.hass.connection) {
        statState.loading = false;
        if (chartEl) {
          chartEl.innerHTML =
            `<div class="empty" style="padding:16px;color:var(--mut)">Der Verlauf wird direkt aus Home Assistant geladen – er erscheint hier, sobald PVM in HA läuft und Sensoren verbunden sind.</div>`;
        }
        return;
      }
      if (!Object.keys(src).length) {
        statState.loading = false;
        return;
      }
      const entityIds = Array.from(new Set(Object.values(src).reduce((a, b) => a.concat(b), [])));
      const end = new Date();
      const start = new Date(end.getTime() - statState.rangeH * 3600 * 1000);
      const raw = await state.hass.connection.sendMessagePromise({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: entityIds,
        minimal_response: true,
        no_attributes: true,
      });
      // HA antwortet: Dict {entity_id: [..]} – bei genau einer Entität aber
      // eine nackte Liste (bekanntes HA-Verhalten). Beides normalisieren.
      const byEntity = Array.isArray(raw) && entityIds.length === 1
        ? { [entityIds[0]]: raw }
        : (raw || {});
      const series = {};
      const per = Math.max(1, Math.round(statState.rangeH * 3600 / 120)); // ~120 Stützpunkte
      const startTs = start.getTime();
      const endTs = end.getTime();
      const bucketT = (i) => startTs + ((i + 0.5) * (endTs - startTs)) / per;
      Object.keys(src).forEach((key) => {
        const vals = new Array(per).fill(null);
        const sums = new Array(per).fill(0);
        const cnts = new Array(per).fill(0);
        src[key].forEach((entityId) => {
          const states = byEntity[entityId] || [];
          // Einheiten-Umrechnung je Entität (kW → W, mW → W): Der Chart
          // rechnet durchgängig in Watt – ein kW-Sensor darf nicht als
          // „6 W“ auftauchen (das machte alle Kurven platt).
          const sNow = st(entityId);
          const unit = sNow && sNow.attributes
            ? sNow.attributes.unit_of_measurement || "" : "";
          const factor = unit === "kW" ? 1000 : unit === "mW" ? 0.001 : 1;
          states.forEach((stRec) => {
            const v = parseFloat(stRec && (stRec.s != null ? stRec.s : stRec.state));
            if (stRec == null || isNaN(v)) return;
            // minimal_response: Zeitstempel in "lu" (last_updated) bzw. "lc"
            // (last_changed) – beide sind epoch-Sekunden. Ohne minimal_response
            // heißen die Felder last_updated/last_changed (ISO-String).
            const tsRaw = stRec.lu != null ? stRec.lu
              : stRec.lc != null ? stRec.lc
              : stRec.l != null ? stRec.l
              : stRec.last_updated != null ? stRec.last_updated
              : stRec.last_changed;
            const ts = typeof tsRaw === "number" ? tsRaw * 1000 : Date.parse(tsRaw);
            if (isNaN(ts) || ts < startTs || ts > endTs) return;
            const bi = Math.min(per - 1, Math.max(0, Math.floor(((ts - startTs) / (endTs - startTs)) * per)));
            sums[bi] += v * factor; cnts[bi] += 1;
          });
        });
        for (let i = 0; i < per; i++) {
          vals[i] = cnts[i] ? sums[i] / cnts[i] : null;
        }
        series[key] = { label: STAT_LABELS[key] || key, points: vals, t: bucketT };
      });
      statState.data = { series, startTs, endTs, per };
      drawStatChart();
    } catch (err) {
      if (chartEl) chartEl.innerHTML = `<span style="color:var(--bad)">Verlauf konnte nicht geladen werden: ${esc(errText(err))}</span>`;
    } finally {
      statState.loading = false;
    }
    loadForecastPanel();
  }

  function drawStatChart() {
    const root = state.root;
    if (!root || !statState.data) return;
    const box = $(root, "[data-el=stat-chart]");
    const chipsEl = $(root, "[data-el=stat-series]");
    if (!box) return;
    const { series, startTs, endTs, per } = statState.data;
    const active = statActiveSeries();
    const W = 760, H = 250, padL = 46, padB = 26, padT = 12, padR = 14;
    const iw = W - padL - padR, ih = H - padT - padB;
    let max = 100;
    active.forEach((k) => {
      const s = series[k];
      if (!s) return;
      s.points.forEach((v) => { if (v != null) max = Math.max(max, Math.abs(v)); });
    });
    max = niceCeil(max);
    const x = (i) => padL + (i / (per - 1)) * iw;
    const y = (v) => padT + ih - (v / max) * ih;
    const lines = active.map((k) => {
      const s = series[k];
      if (!s) return "";
      const color = STAT_COLORS[k] || "#888";
      let d = "";
      let area = "";
      let pen = false;
      s.points.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        const px = x(i), py = y(v);
        d += (pen ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1);
        area += (area ? "L" : "M") + px.toFixed(1) + " " + (padT + ih).toFixed(1) + " L" + px.toFixed(1) + " " + py.toFixed(1);
        pen = true;
      });
      const fill = statState.type === "area"
        ? `<path d="${area} L${x(per - 1)} ${padT + ih} Z" fill="${color}" opacity="0.12"/>` : "";
      return `${fill}<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }).join("");
    const gridLines = [];
    const steps = 4;
    for (let g = 0; g <= steps; g++) {
      const v = (max / steps) * g;
      const gy = y(v);
      gridLines.push(`<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4"/>`);
      gridLines.push(`<text x="${padL - 7}" y="${gy + 4}" text-anchor="end" class="legline">${fmtW(v)}</text>`);
    }
    const tl = per; // Zeitachse: einige Stundenlabels
    const hourStep = Math.max(1, Math.round(tl / 6));
    const timeLines = [];
    for (let i = 0; i < per; i += hourStep) {
      const d = new Date(startTs + (i / per) * (endTs - startTs));
      const label = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      timeLines.push(`<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="legline">${label}</text>`);
    }
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${gridLines.join("")}${lines}${timeLines.join("")}</svg>`;
    if (chipsEl) {
      // Alle vorhandenen Reihen zeigen – abgewählte bleiben sichtbar, aber
      // ausgegraut (ein Klick holt sie sofort zurück, kein Modus nötig).
      const order = ["pv", "house", "grid", "grid_import", "grid_export", "batt", "wallbox", "devices"];
      const keys = Object.keys(series).sort((a, b) => order.indexOf(a) - order.indexOf(b) || a.localeCompare(b));
      chipsEl.innerHTML = keys.map((k) => {
        const s = series[k];
        const color = STAT_COLORS[k] || "#888";
        const last = s && s.points.filter((v) => v != null).pop();
        const on = statState.on[k] !== false;
        return `<button class="serieschip ${on ? "on" : ""}" data-action="stat-series" data-stat-series="${k}" title="${on ? "Reihe ausblenden" : "Reihe anzeigen"}">
          <i class="dot" style="background:${color}"></i>${esc(s.label)}<span style="opacity:.75">${last == null ? "–" : fmtW(last)}</span></button>`;
      }).join("");
    }
  }

  function niceCeil(v) {
    if (v <= 200) return 200;
    if (v <= 500) return 500;
    if (v <= 1000) return 1000;
    if (v <= 2000) return 2000;
    const k = v / 1000;
    const m = Math.ceil(k / 2) * 2;
    return m * 1000;
  }

  async function loadForecastPanel() {
    const root = state.root;
    const el = root && $(root, "[data-el=stat-forecast]");
    if (!el) return;
    const s = configSettings();
    if (s.forecast_enabled === false) {
      el.innerHTML = `<div class="empty" style="padding:14px;color:var(--mut)">PV-Prognose ist in den Einstellungen ausgeschaltet.</div>`;
      return;
    }
    try {
      const fc = await wsTimeout("pvm/forecast", {}, 15000).catch(() => null);
      statState.forecast = fc;
      drawForecastPanel();
      updateForecastBadge();
    } catch (err) { /* Prognose optional */ }
  }

  /** Benachrichtigungs-Punkt am Statistik-Reiter, wenn eine Wolkenphase
   *  bevorsteht (Prognose eingeschaltet & Einbruch erkannt). */
  function updateForecastBadge() {
    const root = state.root;
    if (!root) return;
    const btn = root.querySelector('nav button[data-view="stats"]');
    if (!btn) return;
    const fc = statState.forecast || {};
    const series = fc.series || [];
    const nowVal = series.length ? series[0].pv_w : null;
    const in15 = series.length > 1 ? series[1].pv_w : null;
    const cloudy = configSettings().forecast_enabled
      && nowVal != null && in15 != null && in15 < nowVal * 0.6;
    const hasDot = !!btn.querySelector(".navdot.cloud");
    if (cloudy && !hasDot) {
      const dot = document.createElement("i");
      dot.className = "navdot cloud";
      btn.appendChild(dot);
    } else if (!cloudy && hasDot) {
      btn.querySelector(".navdot.cloud").remove();
    }
  }

  function drawForecastPanel() {
    const root = state.root;
    const el = root && $(root, "[data-el=stat-forecast]");
    if (!el) return;
    const fc = statState.forecast || {};
    const series = fc.series || [];
    const dayCurve = fc.day_curve || [];
    const nowVal = series.length ? series[0].pv_w : null;
    const in15 = series.length > 1 ? series[1].pv_w : null;
    const next3hW = series.filter((p) => p.pv_w != null);
    const h3 = next3hW.length ? next3hW.map((p) => p.pv_w).reduce((a, b) => a + b, 0) * 0.25 / 1000 : null;
    const cloudy = nowVal != null && in15 != null && in15 < nowVal * 0.6;
    const chips = `
      <div class="fcstrip">
        <div class="fchip"><b>${nowVal == null ? "–" : fmtW(nowVal)}</b><span>jetzt (ca.)</span></div>
        <div class="fchip"><b>${in15 == null ? "–" : fmtW(in15)}</b><span>in 15 Minuten</span></div>
        <div class="fchip"><b>${h3 == null ? "–" : h3.toFixed(1) + " kWh"}</b><span>nächste 3 Stunden</span></div>
        <div class="fchip"><b>${fc.day_kwh == null ? "–" : fc.day_kwh.toFixed(1) + " kWh"}</b><span>Rest des Tages (grob)</span></div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${fc.source === "openmeteo"
          ? `<span class="cloud-badge ok">${I.cloud} Open-Meteo (anonym)</span>`
          : fc.source === "local"
            ? `<span class="cloud-badge ok">${I.sunny} lokales Modell</span>`
            : `<span class="cloud-badge warn">${I.cloud} keine Prognose</span>`}
        ${cloudy ? `<span class="cloud-badge warn">${I.cloud} Wolke in Sicht – kurze Phase</span>` : ""}
        <span class="legline" style="flex:1;text-align:right">${esc(fc.note || "")}</span>
      </div>`;
    // Mini-Kurve der nächsten 3 h
    const w = series.map((p) => p.pv_w).filter((v) => v != null);
    const mini = w.length ? svgMini(w, Math.max(100, ...w)) : "";
    el.innerHTML = chips + mini;
  }
  function svgMini(values, maxV) {
    const W = 700, H = 70;
    const pts = values.map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * W;
      const y = H - (Math.max(0, v) / maxV) * (H - 8) - 4;
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    const area = "0," + (H - 4) + " " + pts.join(" ") + " " + W + "," + (H - 4);
    return `<svg viewBox="0 0 ${W} ${H}" style="margin-top:8px" xmlns="http://www.w3.org/2000/svg">
      <polygon points="${area}" fill="var(--acc)" opacity="0.14"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="var(--acc)" stroke-width="2.2"/>
    </svg>`;
  }

  function refreshStatsView() {
    const root = state.root;
    const section = root && $(root, "#view .view");
    if (!section || state.view !== "stats") return;
    section.innerHTML = htmlStats();
    drawStatChart();
    loadForecastPanel();
  }

  /* ------------------------------------------------------------------ *
   * Einstellungen
   * ------------------------------------------------------------------ */
  /* Anschluss-Variante: die Auswahl des Nutzers wird in ``grid_mode``
   * gespeichert und überlebt damit jeden Neustart/Neuaufbau – nur bei
   * alten Konfigurationen wird sie aus den Sensoren abgeleitet. */
  function gridModeOf(e) {
    const m = e && e.grid_mode;
    if (m === "separate" || m === "combined") return m;
    return e.grid_import_sensor || e.grid_export_sensor ? "separate" : "combined";
  }
  function gridSeparate() { return gridModeOf(configEnergy()) === "separate"; }
  function htmlSettings() {
    const s = configSettings();
    const e = configEnergy();
    const theme = s.ui_theme || "ha";
    const customColor = (s.accent_custom || "").trim();
    const gridMode = gridModeOf(e);
    const gridChoice = `
      <div class="f"><label>Dein Netzanschluss</label><small>Wie misst dein Zähler? Änderungen werden sofort gespeichert – du kannst jederzeit wechseln.</small></div>
      <div class="pick">
        ${Object.keys(L.gridModes).map((m) => `
          <label class="${gridMode === m ? "sel" : ""}" data-grid-mode="${m}">
            <span class="rb"></span>
            <span class="tt"><b>${esc(L.gridModes[m])}</b><span>${esc(L.gridModeHint[m])}</span></span>
          </label>`).join("")}
      </div>`;
    const combinedRows = gridMode === "combined" ? `
        ${energyRow("grid", "Netz (kombiniert)", "Ein Sensor für beides: Bezug und Einspeisung aus einem Zähler.", e.grid_sensor)}
        <div class="row">
          <span class="lbl grow">Vorzeichen deines Zählers<small>Wie dein Zähler die Werte liefert – wichtig für die Berechnung.</small></span>
          <select data-setting="grid_kind" style="max-width:100%;flex:1">
            ${Object.keys(L.gridKinds).map((k) => `<option value="${k}" ${(e.grid_kind || "net") === k ? "selected" : ""}>${esc(L.gridKinds[k])}</option>`).join("")}
          </select>
        </div>` : "";
    const separateRows = gridMode === "separate" ? `
        ${energyRow("grid_import", "Netzbezug", "Strom aus dem Netz – positiv = Bezug (z. B. SolarNet „Leistung Netzbezug“)", e.grid_import_sensor)}
        ${energyRow("grid_export", "Einspeisung", "Strom ins Netz – positiv = Einspeisung (z. B. SolarNet „Leistung Netzeinspeisung“)", e.grid_export_sensor)}` : "";
    return `
      <h2 class="sec">Einstellungen</h2>
      <p class="sub">Jede Gruppe klappt sich auf – Änderungen speicherst du unten mit einem Klick.</p>
      ${accordion("energy", I.grid, "Energie-Sensoren", `
        ${gridChoice}
        ${energyRow("pv", "PV-Leistung", "Dein Wechselrichter (W oder kW)", e.pv_sensor)}
        ${combinedRows}
        ${separateRows}
        ${energyRow("house", "Hausverbrauch (optional)", "Gesamtverbrauch des Hauses", e.house_sensor)}
        ${energyRow("battery_power", "Speicher-Leistung (optional)", "Lade-/Entladeleistung deines Batteriespeichers", e.battery_power_sensor)}
        ${energyRow("battery_soc", "Speicher-SoC (optional)", "Ladezustand des Speichers in %", e.battery_soc_sensor)}
        <div class="row" style="justify-content:flex-end;gap:8px">
          <button class="btn ghost" data-action="energy-suggest" title="PVM durchsucht deine Sensoren und schlägt passende vor – du prüfst nur noch kurz.">${I.radar} Automatisch finden</button>
          <button class="btn primary" data-action="save-energy">${I.check} Speichern</button>
        </div>
      `, true)}
      ${accordion("steuerung", I.gear, "Steuerung", `
        <div class="row" style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--card)">
          <span class="lbl grow"><b>Automatik / Manuell</b><small><b>Automatik:</b> PVM verteilt den Überschuss selbst. <b>Manuell:</b> PVM misst nur noch mit und lässt alle Geräte in Ruhe – du steuerst selbst.</small></span>
          <span class="sw ${s.manual_mode ? "on" : ""}" data-settings-toggle="manual_mode" title="Automatik / Manuell"><i></i></span>
        </div>
        <span class="lbl">Betriebsmodus<small>Wie PVM deine Geräte im Automatik-Modus steuert.</small></span>
        <div class="pick">
          ${Object.keys(L.modes).map((m) => `
            <label class="${(s.mode || "auto") === m ? "sel" : ""}" data-mode="${m}">
              <span class="rb"></span>
              <span class="tt"><b>${esc(L.modes[m])}</b><span>${esc(L.modeHint[m])}</span></span>
            </label>`).join("")}
        </div>
        <div class="row" style="border-top:1px solid var(--line);padding-top:12px">
          <span class="lbl grow">Automatische Auto-Erkennung<small>Standard: aus. Wenn eingeschaltet, erkennt PVM über Einsteck-Zeitpunkt und Ladeleistung, welches Auto an welcher Wallbox hängt – und lernt die Zuordnung. Aus: PVM nutzt nur die im Auto hinterlegte Heimat-Wallbox.</small></span>
          <span class="sw ${s.auto_pairing ? "on" : ""}" data-settings-toggle="auto_pairing"><i></i></span>
        </div>
        ${slider("reserve", "Einspeise-Reserve", s.reserve_w, 0, 2000, 10, "W", "Leistung, die als Puffer für Wolken zurückbleibt.")}
        ${slider("cycle", "Zykluszeit", s.cycle_s, 10, 300, 5, "s", "Wie oft PVM neu entscheidet (empfohlen: 30 s).")}
        ${slider("min_on", "Mindest-Einschaltdauer", s.min_on_s, 30, 600, 10, "s", "So lange bleibt ein Gerät nach dem Einschalten mindestens an (kein Flackern).")}
        ${slider("min_off", "Mindest-Ausschaltdauer", s.min_off_s, 10, 300, 5, "s", "So lange bleibt ein Gerät nach dem Ausschalten mindestens aus.")}
      `)}
      ${accordion("prognose", I.cloud, "PV-Prognose & smartes Laden", `
        <div class="row">
          <span class="lbl grow">PV-Prognose<small>Standard: aus. Einschalten, wenn PVM die kommende PV-Leistung abschätzen soll (nächste 15 Min genau, 3 h, ganzer Tag). Ohne Internet fällt PVM auf das lokale Modell zurück – die Steuerung funktioniert immer.</small></span>
          <span class="sw ${s.forecast_enabled ? "on" : ""}" data-settings-toggle="forecast_enabled"><i></i></span>
        </div>
        ${s.forecast_enabled ? `
        <details class="accdetails" ${s.forecast_api_key || s.forecast_lat ? "open" : ""}><summary>API, Standort & Koordinaten (optional)</summary>
          <p class="sub" style="margin-bottom:6px">PVM nutzt die kostenlose Open-Meteo-Prognose – <b>kein Konto nötig</b>. Die Koordinaten deiner Home-Assistant-Installation werden automatisch verwendet (unter Einstellungen → System → Allgemein → Zonename/Standort einstellbar).</p>
          <div class="row">
            <span class="lbl grow">Breitengrad (nur bei anderem PV-Standort)<small>Leer lassen = Standort der HA-Installation.</small></span>
            <input type="text" placeholder="z. B. 48.1374" value="${esc(s.forecast_lat || "")}" data-setting-input="forecast_lat" style="flex:1;min-width:120px" autocomplete="off">
          </div>
          <div class="row">
            <span class="lbl grow">Längengrad (nur bei anderem PV-Standort)<small>Leer lassen = Standort der HA-Installation.</small></span>
            <input type="text" placeholder="z. B. 11.5755" value="${esc(s.forecast_lon || "")}" data-setting-input="forecast_lon" style="flex:1;min-width:120px" autocomplete="off">
          </div>
          <div class="row">
            <span class="lbl grow">Eigener API-Schlüssel (optional)<small>Wer einen eigenen Schlüssel bei <b>open-meteo.com</b> anlegt (kostenlos, ohne Konto: Seite öffnen → „Forecast API“ → Schlüssel kopieren), bekommt schnellere Abfragen mit höherer Priorität. Feldfrei lassen = anonyme Abfrage.</small></span>
            <input type="text" placeholder="API-Schlüssel (optional)" value="${esc(s.forecast_api_key || "")}" data-setting-input="forecast_api_key" style="flex:1;min-width:180px" autocomplete="off">
          </div>
        </details>
        <div class="row" style="justify-content:flex-end;gap:8px">
          <button class="btn ghost" data-action="forecast-refresh" style="padding:6px 12px">${I.wifi} Prognose jetzt aktualisieren</button>
        </div>
        <p class="sub" style="margin-top:4px">Bei Wolken (PV-Einbruch in ~15 Min) erscheint der orangefarbene Punkt am Statistik-Reiter.</p>` : ""}
        <div class="row">
          <span class="lbl grow">Vorausschauendes Laden<small>Hat ein Auto eine aktive Frist (Ziel bis Uhrzeit), hält PVM die Wallbox über kurze Wolkenphasen an statt abzuschalten – die Sonne kommt laut Prognose gleich wieder. So geht keine Ladezeit verloren und es wird seltener geschaltet.</small></span>
          <span class="sw ${s.pre_charge !== false ? "on" : ""}" data-settings-toggle="pre_charge"><i></i></span>
        </div>
      `)}
      ${accordion("design", I.eye, "Design & Darstellung", `
        <span class="lbl">Dein Look<small>„Home Assistant“ folgt deinem HA-Theme inkl. hell/dunkel; die anderen Designs sind feste Stimmungen.</small></span>
        <div class="pick">
          ${Object.keys(L.themes).map((t) => `
            <label class="${theme === t ? "sel" : ""}" data-theme-pick="${t}">
              <span class="rb"></span>
              <span class="tt"><b>${esc(L.themes[t])}</b><span>${themeDots(t)}</span></span>
            </label>`).join("")}
        </div>
        <span class="lbl" style="margin-top:10px">Deine Farbe (ersetzt das HA-Blau)<small>Färbt Knöpfe, Verläufe, Fortschritt und kleine Details. „Automatisch“ nutzt die Farbe deines HA-Designs.</small></span>
        <div class="pick">
          ${Object.keys(L.accents).map((a) => {
            const color = a === "custom"
              ? (customColor || "#0f6cbd")
              : (ACCENT_COLORS[a] || "var(--acc2)");
            return `
            <label class="${(s.accent || "auto") === a ? "sel" : ""}" data-accent-pick="${a}">
              <span class="rb" style="background:${a === "auto" ? "var(--acc2)" : color}"></span>
              <span class="tt"><b>${esc(L.accents[a])}</b>${
                a === "custom"
                  ? `<span class="row" style="gap:8px;align-items:center"><input type="color" data-accent-color value="${esc(customColor || "#0f6cbd")}" title="Farbe frei wählen" style="width:40px;height:28px;padding:0;border:1px solid var(--line);border-radius:6px;background:var(--card2);cursor:pointer"><small>${esc(customColor || "Farbe wählen")}</small></span>`
                  : a !== "auto"
                    ? `<span><i style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${ACCENT_COLORS[a]};vertical-align:-3px"></i> ${ACCENT_COLORS[a]}</span>`
                    : ""
              }</span>
            </label>`;
          }).join("")}
        </div>
      `)}
      ${accordion("system", I.wifi, "System", `
        <div class="row">
          <span class="lbl grow">Version<small>Deine installierte PVM-Version.</small></span>
          <span class="chip"><b>v${esc(state.version || "?")}</b></span>
        </div>
        <div class="row">
          <button class="btn ghost" data-action="run-scan">${I.radar} Geräte suchen</button>
          <button class="btn ghost" data-action="self-test">${I.check} Selbsttest</button>
          <button class="btn ghost" data-action="reload">${I.wifi} Seite neu laden</button>
        </div>
        <p class="sub" style="margin:4px 0 0">Tipp: Der Selbsttest prüft Sensoren und Steuerung und meldet Probleme als Benachrichtigung.</p>
      `)}
    `;
  }
  function accordion(id, icon, title, inner, open) {
    // Offen/Zu-Zustand bleibt über Re-Renders erhalten (state.accOpen),
    // damit sich z. B. die Design-Wahl nicht nach jedem Klick zuklappt.
    const isOpen = state.accOpen[id] !== undefined ? state.accOpen[id] : !!open;
    return `
      <div class="acc ${isOpen ? "open" : ""}" data-acc="${id}">
        <button class="h">${icon} ${esc(title)}<span class="arr">${I.down}</span></button>
        <div class="body"><div class="inner">${inner}</div></div>
      </div>`;
  }
  function themeDots(t) {
    const pal = {
      ha: ["#03a9f4", "#039be5", "#3c8dbc"],
      sonnenaufgang: ["#ff9f1c", "#ff6b35", "#2dd4a7"],
      natur: ["#3ecf8e", "#1ea97c", "#38a8ff"],
      klar: ["#1a7fe0", "#7c6cff", "#ff9f1c"],
    }[t] || [];
    return `<span style="display:flex;gap:5px;margin-top:2px">${pal.map((c) => `<i style="width:13px;height:13px;border-radius:50%;background:${c};display:inline-block"></i>`).join("")}</span>`;
  }
  function energyRow(key, label, hint, entityId) {
    const has = !!entityId;
    const liveKey = { pv: "pv", house: "house", grid: "grid", grid_import: "grid_import",
      grid_export: "grid_export", battery_power: "batt", battery_soc: "batt" }[key];
    const live = liveKey ? liveValue(liveKey) : null;
    const chip = has
      ? `<span class="echeck ok" title="Mit diesem Sensor verbunden – tippen für Details">${I.check} Verbunden</span>`
      : `<span class="echeck no" title="Noch kein Sensor gewählt">• ohne Sensor</span>`;
    const detail = has ? `
        <div><b>Verbunden mit:</b> ${esc(friendlyOf(entityId))}<br>
        <span style="word-break:break-all">${esc(entityId)}</span>
        ${live && live.text !== "–" ? `<br>Aktuell: <b>${esc(live.text)}</b>` : ""}</div>`
      : `<div>Noch kein Sensor ausgewählt. Tippe auf „Sensor wählen“, um den passenden ${esc(label.toLowerCase())}-Sensor zu verbinden.</div>`;
    return `
      <div class="energycard" data-energy-card="${key}" title="Tippen für Details">
        <div class="top">
          <span class="lbl grow" style="margin:0"><b>${esc(label)}</b><small style="display:block">${esc(hint)}</small></span>
          ${chip}
        </div>
        <div class="edetail">${detail}
          <div class="eactions">
            <button class="btn ghost" data-action="pick-energy" data-energy="${key}" style="padding:7px 12px">${I.search} Sensor wählen</button>
            <button class="btn ghost" data-action="clear-energy" data-energy="${key}" ${has ? "" : "disabled"} title="Sensor entfernen" style="padding:7px 10px">${I.del}</button>
          </div>
        </div>
      </div>`;
  }
  function slider(key, label, value, min, max, step, unit, hint) {
    const v = value == null ? min : Number(value);
    return `
      <div class="row">
        <span class="lbl grow">${esc(label)}<small>${esc(hint)}</small>
          <span class="val" data-el="slider-${key}">${esc(fmtNum(v, unit))}</span>
        </span>
        <input type="range" data-slider="${key}" min="${min}" max="${max}" step="${step}" value="${v}" style="flex:1.2;min-width:160px">
      </div>`;
  }
  const sliderUnit = (key) => ({ reserve: "W", cycle: "s", min_on: "s", min_off: "s" }[key] || "");

  /* ------------------------------------------------------------------ *
   * Dialoge (vollständig selbst gebaut)
   * ------------------------------------------------------------------ */
  function openModal(html) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    overlay.addEventListener("mousedown", (ev) => {
      if (ev.target === overlay) closeModal();
    });
    state.root.appendChild(overlay);
    state.modalStack.push(overlay);
    state.modal = overlay;
    return overlay;
  }
  function closeModal() {
    const overlay = state.modalStack.pop();
    if (overlay) overlay.remove();
    state.modal = state.modalStack[state.modalStack.length - 1] || null;
    // Der Geräte-Dialog-Lebenszyklus hängt am obersten Dialog: Erst wenn wirklich
    // kein Dialog mehr offen ist, vergessen wir den Geräte-Dialog-Zustand.
    if (!state.modal) state.deviceDialog = null;
  }
  function confirmModal(title, text, okLabel, onOk) {
    const overlay = openModal(`
      <h3>${esc(title)}</h3>
      <div class="msub">${esc(text)}</div>
      <div class="mfoot">
        <button class="btn ghost" data-close>Abbrechen</button>
        <button class="btn danger" data-ok>${esc(okLabel || "Entfernen")}</button>
      </div>`);
    overlay.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-close]")) closeModal();
      else if (ev.target.closest("[data-ok]")) { closeModal(); onOk(); }
    });
  }

  /* --- Entity-Picker (Suche über alle passenden Entitäten) --- */
  async function ensureEntityList() {
    if (state.entityListLoaded) return state.entityList;
    try {
      const res = await ws("pvm/list_entities");
      state.entityList = res.entities || [];
    } catch (err) {
      state.entityList = [];
    }
    state.entityListLoaded = true;
    return state.entityList;
  }

  function openEntityPicker(opts, onSelect) {
    const { title = "Entität wählen", domains = null } = opts;
    let activeDomain = null;
    ensureEntityList().then((list) => {
      const render = () => {
        const q = (search.value || "").toLowerCase();
        const items = (list || []).filter((it) => {
          if (activeDomain && it.entity_id.split(".")[0] !== activeDomain) return false;
          if (!q) return true;
          const name = String(it.name || "").toLowerCase();
          return name.includes(q) || it.entity_id.toLowerCase().includes(q);
        }).slice(0, 60);
        listEl.innerHTML = items.length
          ? items.map((it) => `
              <div class="pickitem" data-entity="${esc(it.entity_id)}">
                <b>${esc(it.name || it.entity_id)}</b>
                <span>${esc(it.entity_id)}${it.device_name ? " · " + esc(it.device_name) : ""}${it.unit_of_measurement ? " · " + esc(it.unit_of_measurement) : ""}</span>
              </div>`).join("")
          : `<div class="empty">Nichts gefunden – anderen Begriff probieren.</div>`;
      };
      const overlay = openModal(`
        <h3>${esc(title)}</h3>
        <div class="msub">Tippe zum Suchen – z. B. „Wallbox“, „PV“ oder „Netz“.</div>
        <div class="searchrow"><input type="text" placeholder="Suchen …" data-el="pk-search"></div>
        ${domains && domains.length ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
            ${domains.map((d) => `<button class="btn ghost" data-domain="${esc(d)}" style="padding:5px 11px;font-size:12px">${esc(d)}</button>`).join("")}
          </div>` : ""}
        <div class="picklist" data-el="pk-list"></div>
      `);
      const search = $(overlay, "[data-el=pk-search]");
      const listEl = $(overlay, "[data-el=pk-list]");
      search.focus();
      render();
      search.addEventListener("input", render);
      overlay.addEventListener("click", (ev) => {
        const dBtn = ev.target.closest("[data-domain]");
        if (dBtn) {
          activeDomain = activeDomain === dBtn.getAttribute("data-domain") ? null : dBtn.getAttribute("data-domain");
          $$(overlay, "[data-domain]").forEach((b) =>
            b.classList.toggle("primary", b === dBtn && !!activeDomain));
          render();
          return;
        }
        const item = ev.target.closest(".pickitem");
        if (item) {
          closeModal();
          onSelect(item.getAttribute("data-entity"));
        }
      });
    });
  }

  /* --- Geräte-Dialog --- */
  function openDeviceDialog(existing) {
    const d = existing
      ? JSON.parse(JSON.stringify(existing))
      : defaultDevice("wallbox");
    state.deviceDialog = { device: d, step: 1 };
    renderDeviceDialog();
  }

  function renderDeviceDialog() {
    const dd = state.deviceDialog;
    if (!dd) return;
    const d = dd.device;
    const isEdit = !!d.id;
    const overlay = openModal(`
      <h3>${isEdit ? "Gerät bearbeiten" : "Gerät hinzufügen"}</h3>
      <div class="msub" data-el="dlg-sub">${deviceSub(dd.step)}</div>
      <div class="mbody" data-el="dlg-body">${deviceBody(dd.step, d)}</div>
      <div class="mfoot">
        <button class="btn ghost" data-close>Abbrechen</button>
        <button class="btn ghost" data-back style="${dd.step === 1 ? "display:none" : ""}">← Zurück</button>
        <button class="btn primary" data-next style="${dd.step >= 3 ? "display:none" : ""}">Weiter →</button>
        <button class="btn primary" data-save style="${dd.step < 3 ? "display:none" : ""}">${I.check} Speichern</button>
      </div>`);
    overlay.addEventListener("click", (ev) => onDeviceDialogClick(overlay, ev));
    overlay.addEventListener("input", (ev) => {
      // Schieberegler im Dialog: Wert live anzeigen (nie raten, wo man steht)
      const num = ev.target.closest && ev.target.closest("[data-num]");
      if (num) {
        const key = num.getAttribute("data-num");
        const valEl = $(overlay, '[data-numval="' + key + '"]');
        if (valEl) valEl.textContent = fmtNum(parseFloat(num.value), numUnitOf(key));
      }
    });
  }

  function deviceSub(step) {
    return step === 1
      ? "Schritt 1 von 3 – Typ und Name festlegen"
      : step === 2
        ? "Schritt 2 von 3 – Steuerung anbinden (Schalter, Taster oder Leistung)"
        : "Schritt 3 von 3 – Sensoren & Ziele – alles optional, später änderbar.";
  }

  function deviceBody(step, d) {
    if (step === 1) {
      return `
        <div class="f"><label>Gerätetyp <span class="info" data-info-btn="role">i</span></label>
          <small>Was für ein Gerät möchtest du hinzufügen?</small></div>
        <div class="pick">
          ${["wallbox", "waermepumpe", "verbraucher", "fahrzeug"].map((r) => `
            <label class="${d.role === r ? "sel" : ""}" data-role="${r}">
              <span class="rb"></span>
              <span class="tt"><b>${esc(L.roles[r])}</b></span>
            </label>`).join("")}
        </div>
        <div class="infobox" data-info="role">
          <p class="sub" style="margin:6px 0 0;padding:10px 12px;background:var(--card2);border-radius:10px;border:1px solid var(--line)">
            ${["wallbox", "waermepumpe", "verbraucher", "fahrzeug"].map((r) => `<b>${esc(L.roles[r])}:</b> ${esc(L.roleHint[r])}<br>`).join("")}
          </p>
        </div>
        <div class="f"><label>Name</label>
          <input type="text" data-el="dd-name" value="${esc(d.name || "")}" placeholder="z. B. Wallbox Garage, Wärmepumpe, Pool …">
        </div>`;
    }
    if (step === 2) {
      if (d.role === "fahrzeug") {
        return `
          <div class="founditem" style="margin-top:0">
            <div class="grow">
              <h4>Reine Überwachung 🚗</h4>
              <p>Autos werden von PVM <b>nicht geschaltet</b> – PVM liest Akkustand und
                 Ladeleistung und erkennt, an welcher Wallbox das Auto gerade lädt
                 (oder ob es unterwegs ist).<br><span class="info" data-info-btn="car" style="margin:0">i</span>
                 <span class="infobox" data-info="car">Wie PVM das Auto einer Wallbox zuordnet,
                 stellst du unter <b>Einstellungen → Steuerung → Automatische Auto-Erkennung</b> ein
                 (Standard: aus – dann nutzt PVM die Heimat-Wallbox aus Schritt 3).</span></p>
            </div>
          </div>`;
      }
      const ctrlOptions = d.role === "waermepumpe"
        ? ["switch", "buttons", "wp_temp"]
        : ["switch", "buttons"];
      return `
        <div class="f"><label>Steuerung <span class="info" data-info-btn="ctrl">i</span></label>
          <small>Wie schaltet PVM dein Gerät? Wähle die passende Art.</small></div>
        <div class="pick">
          ${ctrlOptions.map((ct) => `
            <label class="${d.control.type === ct ? "sel" : ""}" data-ctrl="${ct}">
              <span class="rb"></span>
              <span class="tt"><b>${esc(L.control[ct] || ct)}</b></span>
            </label>`).join("")}
        </div>
        <div class="infobox" data-info="ctrl">
          <p class="sub" style="margin:6px 0 0;padding:10px 12px;background:var(--card2);border-radius:10px;border:1px solid var(--line)">
            ${ctrlOptions.map((ct) => `<b>${esc(L.control[ct] || ct)}:</b> ${esc(L.controlHint[ct] || "")}<br>`).join("")}
          </p>
        </div>
        <div data-el="ctrl-fields">${controlFields(d)}</div>`;
    }
    return roleFields(d);
  }

  function pickerDomainFor(field) {
    return {
      on_entity: ["button", "switch", "input_boolean"],
      off_entity: ["button", "switch", "input_boolean"],
      switch_entity: ["switch", "input_boolean"],
      number_entity: ["number", "input_number"],
      power: ["sensor", "number", "input_number"],
      soc: ["sensor", "number", "input_number"],
      temp: ["sensor", "number", "input_number"],
    }[field] || null;
  }
  function pickerTitleFor(field) {
    return {
      on_entity: "Start-Taster wählen", off_entity: "Stopp-Taster wählen",
      switch_entity: "Schalter wählen", number_entity: "Leistungs-Limit wählen",
      power: "Leistungs-Sensor wählen", soc: "SoC-Sensor wählen",
      temp: "Temperatur-Sensor wählen",
    }[field] || "Entität wählen";
  }

  function controlFields(d) {
    const c = d.control;
    let html = "";
    const row = (field, label, hint, placeholder) => `
      <div class="f">
        <label>${esc(label)}</label><small>${esc(hint)}</small>
        <div class="ent">
          <input type="text" data-field="${field}" value="${esc(c[field] || "")}" placeholder="${esc(placeholder || "Entitäts-ID tippen oder wählen")}" spellcheck="false">
          <button class="btn ghost" data-pick-field="${field}" type="button">${I.search} Wählen</button>
        </div>
      </div>`;
    if (c.type === "wp_temp") {
      // Wärmepumpe: nur Ziel-Temperatur einstellbar – keine Taster/Schalter.
      html += row("temp_entity", "Ziel-Temperatur (einstellbar)", "Die Nummern-Entität, über die deine Wärmepumpe die gewünschte Speichertemperatur bekommt.", "z. B. „Soll-Temperatur“ wählen");
      html += `<div class="row" style="margin-top:4px">
        <span class="lbl grow">Mindest-Überschuss zum Anheben<small>Ab dieser Leistung hebt PVM die Temperatur an.</small></span>
        <input type="range" data-num="min_on_power" min="100" max="11000" step="100" value="${Number(d.limits.min_on_power_w) || 1400}" style="flex:1.2;min-width:150px">
        <b class="numval" data-numval="min_on_power">${esc(fmtNum(Number(d.limits.min_on_power_w) || 1400, "W"))}</b>
      </div>`;
      return html;
    }
    if (c.type === "buttons") {
      html += row("on_entity", "Start-Knopf", "Mit diesem Knopf startet das Laden (falls dein Gerät zwei getrennte Taster hat).", "z. B. Knopf „Laden starten“ wählen");
      html += row("off_entity", "Stopp-Knopf", "Mit diesem Knopf stoppt das Laden wieder.", "z. B. Knopf „Laden stoppen“ wählen");
    } else {
      html += row("switch_entity", "Schalter (An/Aus)", "Dein Gerät muss sich über einen Schalter an- und ausschalten lassen.", "z. B. Schalter „Freigabe“ wählen");
    }
    // Leistungsbegrenzer: eigenes An-/Abwählfeld („hat mein Gerät einen?“)
    html += `
      <div class="row" style="border-top:1px solid var(--line);padding-top:12px">
        <span class="lbl grow">Leistungs-Begrenzer vorhanden<small>Kann dein Gerät seine Leistung begrenzen (z. B. Max. Strom in Ampere)? Dann kann PVM die Leistung passend steuern.</small></span>
        <span class="sw ${c.has_limiter ? "on" : ""}" data-field-toggle="has_limiter"><i></i></span>
      </div>`;
    if (c.has_limiter) {
      html += row("number_entity", "Leistungs-Einstellung", "Hier stellt dein Gerät ein, mit wie viel Leistung es läuft.", "z. B. „Max. Strom“ wählen");
      html += `
        <div class="row">
          <span class="lbl grow">Einheit der Leistungs-Einstellung<small>Wird die Leistung als Watt, Kilowatt, Ampere oder Milliampere angegeben?</small></span>
          <select data-field="number_unit" style="max-width:170px">
            ${["W", "kW", "A", "mA"].map((u) => `<option ${c.number_unit === u ? "selected" : ""}>${u}</option>`).join("")}
          </select>
        </div>
        <div class="row">
          <span class="lbl grow">Anzahl Phasen<small>Wie viele Phasen nutzt dein Gerät? (Für die Umrechnung Ampere → Watt)</small></span>
          <select data-field="phases" style="max-width:170px">
            <option value="3" ${c.phases === 3 ? "selected" : ""}>3 Phasen (Standard)</option>
            <option value="1" ${c.phases === 1 ? "selected" : ""}>1 Phase</option>
          </select>
        </div>`;
    }
    return html;
  }

  function numberField(key, label, value, min, max, step, unit) {
    const v = value == null ? min : Number(value);
    return `
      <div class="f">
        <label>${esc(label)}</label>
        <div class="ent" style="align-items:center">
          <input type="range" data-num="${key}" min="${min}" max="${max}" step="${step}" value="${v}" style="flex:1">
          <b class="numval" data-numval="${key}">${esc(fmtNum(v, unit))}</b>
          <span style="color:var(--mut);width:44px;font-size:12.5px">${esc(unit)}</span>
        </div>
      </div>`;
  }
  function numUnitOf(key) {
    return {
      capacity: "kWh", min_soc: "%", max_soc: "%", deadline_soc: "%",
      est_power: "W", comfort: "°C", safety: "°C", boost: "°C",
      power_limit: "W", min_on_power: "W", nominal: "W",
    }[key] || "";
  }

  /* Temperatur-Regler mit Zonen-Skala: rot = zu kalt (Bakterien/Legionellen),
   * grün = gesunder Bereich, rot = unnötig heiß für die Heizung. */
  const TEMP_COLD_C = 55.0;
  const TEMP_HOT_C = 70.0;
  function tempField(key, label, value, lo, hi, step, hint) {
    const v = value == null ? lo : Number(value);
    const pct = (x) => Math.max(0, Math.min(100, ((Number(x) - lo) / (hi - lo)) * 100));
    const coldP = pct(TEMP_COLD_C);
    const hotP = pct(TEMP_HOT_C);
    const midP = Math.max(coldP + 2, Math.min(hotP - 2, pct(62)));
    const ticks = [
      [lo, lo + "°"],
      [TEMP_COLD_C, TEMP_COLD_C + "° ⚠"],
      [TEMP_HOT_C, TEMP_HOT_C + "° ⚠"],
      [hi, hi + "°"],
    ].filter(([x]) => x > lo && x < hi);
    return `
      <div class="f">
        <label>${esc(label)}</label><small>${esc(hint || "")}</small>
        <div class="ent" style="align-items:center">
          <div class="zrng" style="--coldP:${coldP}%;--midP:${midP}%;--hotP:${hotP}%">
            <input type="range" data-num="${key}" min="${lo}" max="${hi}" step="${step}" value="${v}" style="width:100%">
            <div class="zscale"><i class="cold"></i><i class="hot"></i></div>
          </div>
          <b class="numval" data-numval="${key}">${esc(fmtNum(v, "°C"))}</b>
        </div>
        <div class="ztick" style="padding:0 ${100 - (pct(hi) - pct(lo)) / 2}%">
          ${ticks.map(([x, t]) => `<span style="position:relative;flex:1;text-align:${x < (lo + hi) / 2 ? "left" : "right"}">${t}</span>`).join("")}
        </div>
        <div class="zlegend">
          <span><i style="background:#e0454b"></i>unter ${TEMP_COLD_C} °C: Bakterien-/Legionellen-Gefahr</span>
          <span><i style="background:#4caf6d"></i>${TEMP_COLD_C}–${TEMP_HOT_C} °C: gesund</span>
          <span><i style="background:#e0454b"></i>über ${TEMP_HOT_C} °C: unnötig heiß für die Heizung</span>
        </div>
      </div>`;
  }

  function roleFields(d) {
    const out = [];
    const sensorRow = (field, label, hint) => `
      <div class="f">
        <label>${esc(label)}</label><small>${esc(hint)}</small>
        <div class="ent">
          <input type="text" data-field="${field}" value="${esc(d.sensors[field] || "")}" placeholder="Entitäts-ID tippen oder wählen" spellcheck="false">
          <button class="btn ghost" data-pick-field="${field}" type="button">${I.search} Wählen</button>
        </div>
      </div>`;
    // „Erweiterte Einstellungen“ klappt auf – so wirkt der Dialog nicht
    // überladen, obwohl alle Optionen vorhanden und änderbar bleiben.
    const adv = (inner) => `
      <details class="dlg-adv">
        <summary>Erweiterte Einstellungen</summary>
        <div class="dlg-adv-inner">${inner}</div>
      </details>`;
    if (d.role === "fahrzeug") {
      // Auto: Hier gehören ALLE Lade-Wünsche hin – nicht an die Wallbox.
      const car = d.car;
      out.push(sensorRow("soc", "Akku-Stand (SoC)", "Ladezustand des Autos in % – z. B. vom Auto-Hersteller. Ohne Sensor zeigt PVM keinen Akku an."));
      out.push(sensorRow("power", "Aktuelle Ladeleistung", "Was das Auto gerade zieht – PVM vergleicht das mit den Wallboxen und erkennt so, wo es hängt."));
      out.push(numberField("capacity", "Batteriegröße", car.capacity_kwh, 1, 300, 1, "kWh"));
      out.push(numberField("min_soc", "Mindest-Akku (Untergrenze)", car.min_soc, 0, 100, 1, "%"));
      out.push(numberField("max_soc", "Ziel-Akku (Obergrenze)", car.max_soc, 10, 100, 1, "%"));
      // Heimat-Wallbox: vom Nutzer gesetzt (manuell) bzw. von der Auto-
      // Erkennung gelernt (Einstellung „Automatische Auto-Erkennung“).
      const wallboxes = devicesOf().filter((x) => x.role === "wallbox");
      const autoOn = !!configSettings().auto_pairing;
      out.push(`<div class="f">
        <label>Wo ist dieses Auto zu Hause?</label>
        <small>${autoOn ? "PVM erkennt die Zuordnung automatisch und lernt sie – du kannst sie hier jederzeit selbst festlegen." : "PVM nutzt diese Zuordnung, um das Auto der richtigen Wallbox zuzuordnen. (Automatische Erkennung: aus – siehe Einstellungen → Steuerung.)"}</small>
        <select data-field="home_wallbox" style="margin-top:6px">
          <option value="" ${!car.home_wallbox ? "selected" : ""}>${autoOn ? "Automatisch (PVM lernt es selbst)" : "Keine (Auto ist unterwegs)"}</option>
          ${wallboxes.map((w) => `<option value="${esc(w.id)}" ${car.home_wallbox === w.id ? "selected" : ""}>${esc(w.name || "Wallbox")}</option>`).join("")}
          ${!wallboxes.length ? "<option disabled>Noch keine Wallbox konfiguriert</option>" : ""}
        </select>
      </div>`);
      out.push(adv(`
        <div class="f">
          <label>Fertig-Ziel (bis wann laden?)</label><small>Optional: Akku-Ziel und Uhrzeit – PVM lädt bis dahin (nötigenfalls mit Netz). 0 % = aus.</small>
          <div class="ent" style="margin-top:4px">
            <input type="range" data-num="deadline_soc" min="0" max="100" step="1" value="${Number(car.deadline_soc || 0)}" style="flex:1">
            <b class="numval" data-numval="deadline_soc">${esc(fmtNum(Number(car.deadline_soc || 0), "%"))}</b>
            <span style="color:var(--mut);width:44px;font-size:12.5px">%</span>
          </div>
          <div class="ent" style="margin-top:6px">
            <input type="time" data-field="deadline_time" value="${esc(car.deadline_time || "")}" style="flex:1">
          </div>
        </div>
        ${toggleRow("manual_force", "Sofort voll laden (Power Charge)", !!car.manual_force, "Lädt jetzt mit voller Leistung bis zur Obergrenze – auch ohne Überschuss.")}
        ${toggleRow("grid_min", "Netzstrom für den Mindest-Akku", car.grid_min_allowed, "Erlaubt PVM, bei fast leerem Akku kurz Strom aus dem Netz zu nutzen.")}
        ${toggleRow("grid_deadline", "Netzstrom für das Fertig-Ziel", car.grid_deadline_allowed, "Damit dein Auto bis zur Abfahrtszeit sein Ziel erreicht.")}
      `));
    } else if (d.role === "wallbox") {
      // Wallbox: NUR die Hardware – Leistungs-Sensor + zwei Schieberegler.
      // Akku-Grenzen, Ziele & Power Charge stellst du am Auto ein.
      out.push(sensorRow("power", "Leistung (lädt gerade)", "Zeigt live, wie viel die Wallbox zieht."));
      out.push(numberField("power_limit", "Maximale Ladeleistung der Wallbox", d.limits.power_limit_w, 500, 22000, 100, "W"));
      out.push(numberField("min_on_power", "Mindest-Überschuss zum Laden", d.limits.min_on_power_w, 100, 11000, 100, "W"));
    } else if (d.role === "waermepumpe") {
      const wp = d.wp;
      const tempMode = (d.control.type === "wp_temp");
      out.push(sensorRow("temp", "Temperatur-Sensor", "Vorlauf-/Speichertemperatur in °C."));
      out.push(sensorRow("power", "Leistung (im Betrieb)", "Optional – zeigt den Verbrauch live an."));
      if (tempMode) {
        // „Nur Ziel-Temperatur“: zwei Zonen-Schieberegler – normal & Boost.
        out.push(tempField("comfort", "Normale Soll-Temperatur", wp.comfort_c, 40, 80, 0.5, "Diese Temperatur hält deine Wärmepumpe, solange kein Überschuss da ist."));
        out.push(tempField("boost", "Ziel bei Überschuss", wp.boost_c, 40, 80, 0.5, "Bei genügend PV-Überschuss hebt PVM die Temperatur bis hierhin an."));
      } else {
        out.push(tempField("comfort", "Soll-Temperatur", wp.comfort_c, 40, 80, 0.5, "Temperatur, auf die deine Wärmepumpe heizt."));
      }
      out.push(adv(`
        ${numberField("est_power", "Geschätzte Heizleistung", wp.est_power_w, 500, 22000, 100, "W")}
        ${tempField("safety", "Notfall-Minimum", wp.safety_min_c, 60, 80, 1, "Fällt der Speicher unter diesen Wert, heizt PVM zur Not auch mit Netz – nie darunter, damit keine Bakterien entstehen (Legionellen-Schutz).")}
        ${toggleRow("grid_fallback", "Netz im Notfall", wp.grid_fallback_allowed, "Unter dem Notfall-Minimum darf PVM kurz Netzstrom nutzen.")}
      `));
    } else {
      out.push(sensorRow("power", "Leistung (im Betrieb)", "Optional – zeigt den Verbrauch live an."));
      out.push(numberField("nominal", "Leistung im Betrieb", d.limits.nominal_power_w, 50, 22000, 100, "W"));
      out.push(numberField("min_on_power", "Mindest-Überschuss zum Einschalten", d.limits.min_on_power_w, 100, 11000, 100, "W"));
    }
    out.push(`
      <div class="row" style="border-top:1px solid var(--line);padding-top:12px">
        <span class="lbl grow">Automatik aktiv<small>Wenn aus, lässt PVM das Gerät komplett in Ruhe.</small></span>
        <span class="sw ${d.enabled !== false ? "on" : ""}" data-field-toggle="enabled"><i></i></span>
      </div>`);
    return out.join("");
  }
  function toggleRow(key, label, value, hint) {
    return `
      <div class="row">
        <span class="lbl grow">${esc(label)}<small>${esc(hint)}</small></span>
        <span class="sw ${value ? "on" : ""}" data-field-toggle="${key}"><i></i></span>
      </div>`;
  }
  /* Abbildung der Schalter-Schlüssel im Dialog auf die echten
   * Konfigurations-Schlüssel (sonst gehen Änderungen verloren). */
  const CAR_TOGGLE = { grid_min: "grid_min_allowed", grid_deadline: "grid_deadline_allowed", manual_force: "manual_force" };
  const WP_TOGGLE = { grid_fallback: "grid_fallback_allowed" };
  function applyDeviceToggle(d, key, on) {
    if (key === "enabled") d.enabled = on;
    else if (key === "has_limiter") d.control.has_limiter = on;
    else if (d.car && CAR_TOGGLE[key]) d.car[CAR_TOGGLE[key]] = on;
    else if (d.wp && WP_TOGGLE[key]) d.wp[WP_TOGGLE[key]] = on;
  }

  function onDeviceDialogClick(overlay, ev) {
    const dd = state.deviceDialog;
    if (!dd) return;
    const d = dd.device;
    const body = $(overlay, "[data-el=dlg-body]");
    const sub = $(overlay, "[data-el=dlg-sub]");
    const backBtn = $(overlay, "[data-back]");
    const nextBtn = $(overlay, "[data-next]");
    const saveBtn = $(overlay, "[data-save]");
    const navTo = (step) => {
      dd.step = step;
      sub.textContent = deviceSub(step);
      body.innerHTML = deviceBody(step, d);
      backBtn.style.display = step === 1 ? "none" : "";
      nextBtn.style.display = step >= 3 ? "none" : "";
      saveBtn.style.display = step < 3 ? "none" : "";
    };
    const infoBtn = ev.target.closest("[data-info-btn]");
    if (infoBtn) {
      const key = infoBtn.getAttribute("data-info-btn");
      const box = $(overlay, '[data-info="' + key + '"]');
      if (box) box.classList.toggle("open");
      return;
    }
    const roleEl = ev.target.closest("[data-role]");
    if (roleEl) {
      d.role = roleEl.getAttribute("data-role");
      const fresh = defaultDevice(d.role);
      if (d.role === "wallbox") { d.car = d.car || fresh.car; d.wp = null; }
      else if (d.role === "fahrzeug") { d.car = d.car || fresh.car; d.wp = null; }
      else if (d.role === "waermepumpe") { d.wp = d.wp || fresh.wp; d.car = null; }
      else { d.car = null; d.wp = null; }
      $$(overlay, "[data-role]").forEach((x) => x.classList.toggle("sel", x === roleEl));
      return;
    }
    const ctrlEl = ev.target.closest("[data-ctrl]");
    if (ctrlEl) {
      d.control.type = ctrlEl.getAttribute("data-ctrl");
      const fieldsEl = $(overlay, "[data-el=ctrl-fields]");
      if (fieldsEl) fieldsEl.innerHTML = controlFields(d);
      $$(overlay, "[data-ctrl]").forEach((x) => x.classList.toggle("sel", x === ctrlEl));
      return;
    }
    const pickBtn = ev.target.closest("[data-pick-field]");
    if (pickBtn) {
      const field = pickBtn.getAttribute("data-pick-field");
      openEntityPicker({ title: pickerTitleFor(field), domains: pickerDomainFor(field) }, (entityId) => {
        const inp = $(overlay, '[data-field="' + field + '"]');
        if (inp) inp.value = entityId;
        if (field in d.control) d.control[field] = entityId;
        else if (field in d.sensors) d.sensors[field] = entityId;
      });
      return;
    }
    const fieldToggle = ev.target.closest("[data-field-toggle]");
    if (fieldToggle) {
      const key = fieldToggle.getAttribute("data-field-toggle");
      const on = fieldToggle.classList.toggle("on");
      applyDeviceToggle(d, key, on);
      // Leistungsbegrenzer ein/aus: passende Felder sofort zeigen/ausblenden
      if (key === "has_limiter") {
        const fieldsEl = $(overlay, "[data-el=ctrl-fields]");
        if (fieldsEl) fieldsEl.innerHTML = controlFields(d);
      }
      return;
    }
    if (ev.target.closest("[data-close]")) { closeModal(); return; }
    if (ev.target.closest("[data-back]")) {
      // Aktuelle Schritt-Felder sichern, bevor der Schritt neu aufgebaut wird
      // (sonst gehen getippte Entitäts-IDs beim Zurückgehen verloren).
      collectDialogFields(overlay, d);
      navTo(dd.step - 1);
      return;
    }
    if (ev.target.closest("[data-next]")) {
      const name = $(overlay, "[data-el=dd-name]");
      if (name) d.name = name.value.trim();
      if (!d.name) { toast("Bitte vergib einen Namen für das Gerät.", "bad"); return; }
      // Felder des aktuellen Schritts vor dem Umbau in die Konfiguration
      // übernehmen – so bleiben auch frei getippte Entitäts-IDs erhalten.
      collectDialogFields(overlay, d);
      navTo(dd.step + 1);
      return;
    }
    if (ev.target.closest("[data-save]")) {
      collectDialogFields(overlay, d);
      if (!validateDevice(d)) return;
      const devs = devicesOf();
      const sigBefore = deviceSig();
      const idx = devs.findIndex((x) => x.id === d.id);
      if (idx >= 0) devs[idx] = d;
      else {
        d.id = d.id || ("dev" + Math.random().toString(36).slice(2, 8));
        devs.push(d);
      }
      const structureChanged = deviceSig() !== sigBefore;
      toast("Speichere …");
      closeModal();
      // Nur wenn wirklich ein neues Gerät/Rolle dazukam, werden Entitäten neu
      // geladen – reine Wertänderungen sind sofort wirksam (kein Reload).
      saveAndRefresh(structureChanged ? "Gerät übernommen – wird eingerichtet …" : "Gerät gespeichert.", { reload: structureChanged });
    }
  }

  function collectDialogFields(overlay, d) {
    const name = $(overlay, "[data-el=dd-name]");
    if (name) d.name = name.value.trim();
    $$(overlay, "[data-field]").forEach((el) => {
      const key = el.getAttribute("data-field");
      const v = el.value;
      if (key in d.control) d.control[key] = v || null;
      else if (key in d.sensors) d.sensors[key] = v || null;
      else if (key === "deadline_time" && d.car) d.car.deadline_time = v || null;
      else if (key === "home_wallbox" && d.car) d.car.home_wallbox = v || null;
    });
    // Steuerungsart wechseln (z. B. auf „Nur Ziel-Temperatur“) erzwingt
    // passende Standardwerte, damit alte Felder nicht übrig bleiben.
    if (d.control.type === "wp_temp") {
      d.control.switch_entity = null;
      d.control.on_entity = null;
      d.control.off_entity = null;
      d.control.number_entity = null;
      d.control.has_limiter = false;
    } else if (d.control.type === "buttons") {
      d.control.switch_entity = null;
      d.control.temp_entity = null;
    } else {
      d.control.temp_entity = null;
    }
    $$(overlay, "[data-field-toggle]").forEach((el) => {
      const key = el.getAttribute("data-field-toggle");
      const on = el.classList.contains("on");
      applyDeviceToggle(d, key, on);
    });
    $$(overlay, "[data-num]").forEach((r) => {
      const key = r.getAttribute("data-num");
      const v = parseFloat(r.value);
      if (isNaN(v)) return;
      const map = {
        capacity: ["car", "capacity_kwh"], min_soc: ["car", "min_soc"], max_soc: ["car", "max_soc"],
        deadline_soc: ["car", "deadline_soc"],
        est_power: ["wp", "est_power_w"], comfort: ["wp", "comfort_c"],
        safety: ["wp", "safety_min_c"], boost: ["wp", "boost_c"],
      };
      const where = map[key];
      if (key === "power_limit") d.limits.power_limit_w = v;
      else if (key === "min_on_power") d.limits.min_on_power_w = v;
      else if (key === "nominal") d.limits.nominal_power_w = v;
      else if (where && d[where[0]]) d[where[0]][where[1]] = v;
    });
    // select-Felder (number_unit / phases)
    $$(overlay, 'select[data-field]').forEach((el) => {
      const key = el.getAttribute("data-field");
      if (key === "number_unit") d.control.number_unit = el.value;
      if (key === "phases") d.control.phases = Number(el.value);
    });
  }

  function validateDevice(d) {
    if (d.role === "fahrzeug") {
      // Autos sind reine Überwachung – nur die SOC-Plausibilität prüfen
      if (d.car && Number(d.car.min_soc) >= Number(d.car.max_soc)) {
        toast("Die Untergrenze muss kleiner als die Obergrenze sein.", "bad");
        return false;
      }
      return true;
    }
    const c = d.control;
    if (c.type === "wp_temp") {
      if (!c.temp_entity) {
        toast("Bitte wähle die Ziel-Temperatur-Entität deiner Wärmepumpe.", "bad");
        return false;
      }
      if (Number(d.wp && d.wp.comfort_c) >= Number(d.wp && d.wp.boost_c)) {
        toast("Die Ziel-Temperatur bei Überschuss muss höher sein als die normale Soll-Temperatur.", "bad");
        return false;
      }
      return true;
    }
    if (c.type === "buttons") {
      if (!c.on_entity || !c.off_entity) {
        toast("Bei zwei Tastern brauchst du einen Start- UND einen Stopp-Knopf.", "bad");
        return false;
      }
      if (!d.sensors.power) {
        toast("Bei zwei Tastern braucht PVM einen Leistungs-Sensor, um zu erkennen, ob das Gerät läuft.", "bad");
        return false;
      }
    } else if (c.has_limiter) {
      if (!c.switch_entity || !c.number_entity) {
        toast("Bitte wähle Schalter und Leistungs-Einstellung.", "bad");
        return false;
      }
    } else if (!c.switch_entity) {
      toast("Bitte wähle einen Schalter für dieses Gerät.", "bad");
      return false;
    }
    if (d.role === "wallbox" && d.car) {
      if (Number(d.car.min_soc) >= Number(d.car.max_soc)) {
        toast("Die Untergrenze muss kleiner als die Obergrenze sein.", "bad");
        return false;
      }
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Klick-Delegation
   * ------------------------------------------------------------------ */
  function onRootClick(root, ev) {
    const navBtn = ev.target.closest("nav button[data-view]");
    if (navBtn) {
      state.panel._nav(navBtn.getAttribute("data-view"));
      return;
    }
    const accBtn = ev.target.closest(".acc > button.h");
    if (accBtn) {
      const id = accBtn.parentElement.getAttribute("data-acc");
      const open = accBtn.parentElement.classList.toggle("open");
      if (id) state.accOpen[id] = open;
      return;
    }
    const settingsToggle = ev.target.closest("[data-settings-toggle]");
    if (settingsToggle) {
      const key = settingsToggle.getAttribute("data-settings-toggle");
      const on = settingsToggle.classList.toggle("on");
      configSettings()[key] = on;
      const labels = {
        manual_mode: on ? "Manuell – PVM steuert nichts mehr" : "Automatik – PVM verteilt wieder Überschuss",
        auto_pairing: on ? "Automatische Auto-Erkennung an" : "Automatische Auto-Erkennung aus",
        forecast_enabled: on ? "PV-Prognose an" : "PV-Prognose aus",
        pre_charge: on ? "Vorausschauendes Laden an" : "Vorausschauendes Laden aus",
      };
      saveAndRefresh(labels[key] || (on ? "An" : "Aus"), { forecast: key === "forecast_enabled" && on });
      return;
    }
    // Nur die Modus-Auswahl in den Einstellungen (label[data-mode]) – die
    // Auto/Manuell-Knöpfe der Gerätekarten nutzen data-automode und landen
    // über [data-action] im eigenen Handler (kein versehentliches setMode).
    const modeEl = ev.target.closest("label[data-mode]");
    if (modeEl) {
      $$(root, "label[data-mode]").forEach((x) => x.classList.toggle("sel", x === modeEl));
      setMode(modeEl.getAttribute("data-mode"));
      return;
    }
    const themeEl = ev.target.closest("[data-theme-pick]");
    if (themeEl) {
      $$(root, "[data-theme-pick]").forEach((x) => x.classList.toggle("sel", x === themeEl));
      setTheme(themeEl.getAttribute("data-theme-pick"));
      return;
    }
    const accentEl = ev.target.closest("[data-accent-pick]");
    if (accentEl) {
      const key = accentEl.getAttribute("data-accent-pick");
      $$(root, "[data-accent-pick]").forEach((x) => x.classList.toggle("sel", x === accentEl));
      configSettings().accent = key;
      applyTheme();
      // Klick kam direkt vom Farbfeld → spart nur, wenn wirklich eine Farbe
      // gewählt wurde (onRootChange übernimmt das Speichern dann mit Hex).
      if (!ev.target.closest("[data-accent-color]")) {
        saveAndRefresh("Farbe: „" + (L.accents[key] || key) + "“");
      }
      return;
    }
    const gridModeEl = ev.target.closest("[data-grid-mode]");
    if (gridModeEl) {
      const mode = gridModeEl.getAttribute("data-grid-mode");
      if (mode === "combined" || mode === "separate") {
        // Auswahl wird im Konfig-Modell gespeichert (nicht aus den Sensoren
        // abgeleitet) – so bleibt der Modus auch nach Reload/Neustart erhalten
        // und es gehen keine bereits gewählten Sensoren verloren.
        configEnergy().grid_mode = mode;
        if (mode === "separate") {
          // Beim Wechsel auf getrennte Zähler den alten kombinierten Wert
          // nicht stillschweigend weiterverwenden.
          saveAndRefresh("Umgestellt: Netzbezug & Einspeisung getrennt – jetzt die Sensoren wählen.");
        } else {
          saveAndRefresh("Umgestellt: ein kombinierter Sensor – jetzt den Sensor wählen.");
        }
      }
      return;
    }
    const actionEl = ev.target.closest("[data-action]");
    if (actionEl) {
      handleAction(root, actionEl);
      return;
    }
    const ecard = ev.target.closest(".energycard[data-energy-card]");
    if (ecard) {
      // Nur eine Karte gleichzeitig offen – Details sind aufgeräumt
      $$(root, ".energycard.open").forEach((c) => {
        if (c !== ecard) c.classList.remove("open");
      });
      ecard.classList.toggle("open");
      return;
    }
    const jumpEl = ev.target.closest("[data-jump]");
    if (jumpEl) {
      jumpTo(jumpEl.getAttribute("data-jump"));
    }
  }

  function jumpTo(to) {
    if (to === "devices") { state.panel._nav("devices"); return; }
    if (to === "order") { state.panel._nav("order"); return; }
    if (to === "found") { state.panel._nav("found"); return; }
    const idx = { energy: 0, steuerung: 1, wp: 2, design: 3, system: 4 }[to];
    state.panel._nav("settings");
    setTimeout(() => {
      const accs = $$(state.root, ".acc");
      accs.forEach((a, i) => a.classList.toggle("open", i === idx));
      const acc = accs[idx];
      if (acc) acc.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function handleAction(root, el) {
    const action = el.getAttribute("data-action");
    const devId = el.getAttribute("data-device");
    switch (action) {
      case "jump": {
        jumpTo(el.getAttribute("data-to"));
        break;
      }
      case "go-home": goHome(); break;
      case "add-device": openDeviceDialog(null); break;
      case "edit-device":
      case "open-device": {
        const d = deviceById(devId);
        if (d) openDeviceDialog(d);
        break;
      }
      case "intro-finish":
      case "intro-skip": {
        configSettings().intro_done = true;
        saveAndRefresh("Einführung ausgeblendet – dein Dashboard ist jetzt aufgeräumt.");
        break;
      }
      case "intro-restart": {
        configSettings().intro_done = false;
        saveAndRefresh("Einführung wieder aktiviert.");
        break;
      }
      case "del-device": {
        const d = deviceById(devId);
        if (!d) return;
        confirmModal("Gerät entfernen", "„" + (d.name || "") + "“ wird aus PVM entfernt. Das Gerät selbst bleibt in Home Assistant unverändert erhalten.", "Entfernen", () => {
          state.config.devices = devicesOf().filter((x) => x.id !== devId);
          saveAndRefresh("Gerät entfernt.", { reload: true });
        });
        break;
      }
      case "toggle-auto":
      case "set-dev-mode": {
        const wantAuto = action === "toggle-auto"
          ? !isOn(entOf(devId).auto)
          : el.getAttribute("data-automode") !== "man";
        // Robust über den Manager: setzt device.enabled + Schalter-Entität
        // (kein direkter switch-Aufruf – der schlug bei fehlender Entität
        // fehl und die Karte zeigte weiter den alten Zustand).
        wsTimeout("pvm/control", { device_id: devId, kind: "dev_mode", auto: wantAuto }, 10000)
          .then((res) => {
            toast((res && res.msg) || (wantAuto ? "Automatik an" : "Manuell"), res && res.ok === false ? "bad" : "ok");
            if (res && res.ok !== false) {
              updateDeviceLives();
              liveNow();
            }
          })
          .catch(() => toast("Umschalten fehlgeschlagen", "bad"));
        break;
      }
      case "manual-open": {
        const d = deviceById(devId);
        if (!d) return;
        const box = $(root, '.devctl[data-device="' + cssEsc(devId) + '"]');
        if (!box) return;
        const show = box.style.display !== "block";
        box.style.display = show ? "block" : "none";
        if (show) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
        break;
      }
      case "dev-cmd": {
        const d = deviceById(devId);
        if (!d) return;
        const cmd = el.getAttribute("data-cmd");
        // Über den Manager: kennt Taster- und Schalter-Geräte und antwortet
        // immer mit einer verständlichen Meldung (auch bei Fehlern).
        wsTimeout("pvm/control", { device_id: devId, kind: cmd === "start" || cmd === "on" ? (cmd === "start" ? "start" : "on") : (cmd === "stop" ? "stop" : "off") }, 10000)
          .then((res) => {
            toast((res && res.msg) || "Gesendet.", res && res.ok === false ? "bad" : "ok");
            if (res && res.ok !== false) {
              updateDeviceLives();
              liveNow();
            }
          })
          .catch(() => toast("Konnte nicht gesendet werden", "bad"));
        break;
      }
      case "move-dev": {
        // Autos (reine Überwachung) belegen keinen Platz in der Reihenfolge –
        // die Pfeile verschieben nur steuerbare Geräte (überspringen Autos).
        const dir = Number(el.getAttribute("data-dir"));
        const devs = devicesOf();
        const order = devs.filter((d) => d.role !== "fahrzeug");
        const k = order.findIndex((x) => x.id === devId);
        const m = k + dir;
        if (k < 0 || m < 0 || m >= order.length) return;
        const i = devs.indexOf(order[k]);
        const j = devs.indexOf(order[m]);
        [devs[i], devs[j]] = [devs[j], devs[i]];
        saveAndRefresh("Reihenfolge gespeichert.");
        break;
      }
      case "run-scan": {
        if (el.dataset.scanning === "1") return; // kein Doppel-Start
        el.dataset.scanning = "1";
        el.disabled = true;
        toast("Suche läuft – bei vielen Geräten kann das etwas dauern …");
        wsTimeout("pvm/scan", {}, 60000)
          .then((res) => {
            state.scan = res || {};
            const n = ((state.scan.sets) || []).length;
            toast("Suche abgeschlossen" + (n ? " – " + n + " Vorschläge gefunden." : " – nichts Neues gefunden."), "ok");
            if (state.view === "found") state.panel._nav("found");
          })
          .catch((err) => toast("Suche fehlgeschlagen: " + errText(err), "bad"))
          .finally(() => { delete el.dataset.scanning; el.disabled = false; });
        break;
      }
      case "adopt": {
        const idx = Number(el.getAttribute("data-idx"));
        const sets = (state.scan && state.scan.sets) || [];
        const found = sets[idx];
        if (!found) return;
        const fields = found.fields || {};
        // Den übernommenen Vorschlag SOFORT aus der „Gefunden“-Liste nehmen,
        // damit es nicht aussieht, als hätte sich nichts getan (die Seite
        // würde sonst nur neu rendern und der Eintrag bliebe stehen).
        // Nach Rolle + Entität filtern (nicht nach Objekt-Identität – der
        // Scan kann zwischenzeitlich neu aufgebaut worden sein).
        const removeFromScan = () => {
          const adoptedRole = found.role;
          const adoptedEntity = fields.entity || fields.power_sensor || fields.temp_sensor || "";
          state.scan.sets = (state.scan.sets || []).filter((s) => {
            if (s.role !== adoptedRole) return true;
            const f = s.fields || {};
            return (f.entity || f.power_sensor || f.temp_sensor || "") !== adoptedEntity;
          });
          if (state.view === "found") state.panel._nav("found");
        };
        if (["pv", "grid", "grid_import", "grid_export", "house"].includes(found.role)) {
          const eid = fields.entity;
          if (!eid) { toast("Keine passende Entität im Vorschlag.", "bad"); return; }
          const e = state.config.energy;
          const slot = found.role + "_sensor";
          if (e[slot] && e[slot] !== eid) {
            // Eine Messung ist bereits verbunden – niemals stillschweigend
            // überschreiben (das machte die PV-Anzeige kaputt).
            toast("Dieser Sensor ist schon verbunden – Details findest du unter Einstellungen → Energie-Sensoren.", "bad");
            removeFromScan();
            return;
          }
          // Anschluss-Konflikt: kombiniert vs. getrennt – nie stillschweigend
          // die andere Messung entfernen (sonst brechen die Anzeigen weg).
          if (found.role === "grid" && (e.grid_import_sensor || e.grid_export_sensor)) {
            toast("Du nutzt getrennte Zähler (Netzbezug + Einspeisung). Für den kombinierten Sensor erst unter Einstellungen → Energie-Sensoren umstellen.", "bad");
            removeFromScan();
            return;
          }
          if ((found.role === "grid_import" || found.role === "grid_export") && e.grid_sensor) {
            toast("Du nutzt einen kombinierten Netz-Sensor. Für getrennte Zähler erst unter Einstellungen → Energie-Sensoren umstellen.", "bad");
            removeFromScan();
            return;
          }
          // Nur echte Leistungs-Sensoren übernehmen – ein Zählerstand (kWh)
          // oder nicht-numerischer Sensor würde die Anzeige sonst zerstören.
          const stEnt = st(eid);
          const attrs = (stEnt && stEnt.attributes) || {};
          const unit = attrs.unit_of_measurement || "";
          const stVal = stEnt && stEnt.state;
          const numeric = stVal != null && stVal !== "" && !isNaN(parseFloat(stVal)) && !["unknown", "unavailable"].includes(String(stVal));
          if (unit && !_isPowerUnitJs(unit)) {
            toast("„" + esc(eid) + "“ ist kein Leistungs-Sensor (Einheit: " + esc(unit) + "). PVM braucht W, kW oder mW.", "bad");
            removeFromScan();
            return;
          }
          if (!numeric) {
            toast("„" + esc(eid) + "“ liefert gerade keinen Leistungswert – bitte prüfen, ob der Sensor aktiv ist.", "bad");
            removeFromScan();
            return;
          }
          e[slot] = eid;
          if (found.role === "grid") e.grid_mode = "combined";
          if (found.role === "grid_import" || found.role === "grid_export") e.grid_mode = "separate";
          saveAndRefresh("Sensor übernommen ✓ – er ist jetzt in den Energie-Sensoren verbunden.").then(removeFromScan);
        } else if (found.role === "fahrzeug") {
          const d = defaultDevice("fahrzeug");
          d.name = found.title || "Auto";
          if (fields.soc_sensor) d.sensors.soc = fields.soc_sensor;
          if (fields.power_sensor) d.sensors.power = fields.power_sensor;
          openDeviceDialog(d);
        } else {
          const role = found.role === "wp" ? "waermepumpe" : found.role;
          const d = defaultDevice(role);
          d.name = found.title || L.roles[role];
          if (fields.switch_entity) d.control.switch_entity = fields.switch_entity;
          if (fields.on_entity && fields.off_entity) {
            d.control.type = "buttons";
            d.control.on_entity = fields.on_entity;
            d.control.off_entity = fields.off_entity;
          }
          if (fields.number_entity) {
            // Leistungs-Begrenzer vorhanden (neues Modell: Schalter + Flag)
            d.control.has_limiter = true;
            d.control.number_entity = fields.number_entity;
            if (!fields.on_entity && fields.switch_entity) d.control.switch_entity = fields.switch_entity;
          }
          if (fields.temp_entity && !fields.switch_entity) {
            // Wärmepumpe ohne Schalter: nur Ziel-Temperatur einstellbar
            d.control.type = "wp_temp";
            d.control.temp_entity = fields.temp_entity;
          }
          if (fields.power_sensor) d.sensors.power = fields.power_sensor;
          // SoC gehört NUR zum Auto – nie an Wallbox/WP/Verbraucher anhängen
          // (sonst „weiß“ z. B. die Wallbox den Akkustand des Autos).
          if (fields.soc_sensor && role === "fahrzeug") d.sensors.soc = fields.soc_sensor;
          if (fields.temp_sensor) d.sensors.temp = fields.temp_sensor;
          openDeviceDialog(d);
        }
        break;
      }
      case "clear-energy": {
        const key = el.getAttribute("data-energy");
        state.config.energy[key + "_sensor"] = null;
        const e = state.config.energy;
        if (key === "grid_import" && !e.grid_export_sensor) e.grid_mode = e.grid_mode || "combined";
        if (key === "grid_export" && !e.grid_import_sensor) e.grid_mode = e.grid_mode || "combined";
        saveAndRefresh("Sensor entfernt.");
        break;
      }
      case "pick-energy": {
        const key = el.getAttribute("data-energy");
        openEntityPicker({
          title: "Sensor für " + ({ pv: "PV-Leistung", grid: "Netz (kombiniert)", grid_import: "Netzbezug", grid_export: "Einspeisung", house: "Hausverbrauch", battery_power: "Speicher-Leistung", battery_soc: "Speicher-SoC" }[key] || key),
          domains: ["sensor", "number", "input_number"],
        }, (entityId) => {
          const e = state.config.energy;
          e[key + "_sensor"] = entityId;
          // Sensor passt zur gewählten Anschluss-Variante – Modus mitführen,
          // damit die Seite die richtigen Kacheln/den richtigen Fluss zeigt.
          if (key === "grid") e.grid_mode = "combined";
          if (key === "grid_import" || key === "grid_export") e.grid_mode = "separate";
          saveAndRefresh("Sensor gespeichert.");
        });
        break;
      }
      case "setup-location": {
        // Einrichtungs-Frage: Steht die PV am Standort der HA-Installation?
        // Ja → Prognose sofort aktivieren (kostenlos über Open-Meteo, nutzt
        // automatisch die HA-Koordinaten). Nein → Anleitung in Einstellungen.
        const overlay = openModal(`
          <h3>${I.cloud} Steht deine PV-Anlage hier?</h3>
          <div class="msub">Am Standort deiner Home-Assistant-Installation? Dann nutzt PVM automatisch deren Koordinaten und berechnet die Prognose ab sofort kostenlos – ein API-Schlüssel ist dafür <b>nicht</b> nötig.</div>
          <div class="mfoot">
            <button class="btn ghost" data-no>Nein, sie steht woanders</button>
            <button class="btn primary" data-yes>Ja – Prognose starten</button>
          </div>`);
        overlay.addEventListener("click", (ev) => {
          if (ev.target.closest("[data-yes]")) {
            closeModal();
            const s = configSettings();
            s.pv_at_hass_location = true;
            s.forecast_enabled = true;
            saveAndRefresh("Prognose aktiviert – nutzt den Standort deiner HA-Installation.", { forecast: true });
          } else if (ev.target.closest("[data-no]")) {
            closeModal();
            toast("Kein Problem – unter Einstellungen → PV-Prognose kannst du Koordinaten oder einen API-Schlüssel hinterlegen.");
            jumpTo("energy");
          }
        });
        break;
      }
      case "energy-suggest": {
        toast("PVM sucht nach passenden Sensoren …");
        wsTimeout("pvm/energy_suggest", {}, 20000)
          .then((res) => {
            if (!res) { toast("Suche fehlgeschlagen", "bad"); return; }
            const sugg = (res.suggestions) || {};
            const warns = (res.warn) || [];
            const auto = (res.auto) || {};
            const e = configEnergy();
            // Nur Slots, die noch frei sind, vorschlagen
            const candidates = Object.keys(sugg).filter((k) => {
              const slot = k + "_sensor";
              return sugg[k] && !e[slot];
            });
            if (!candidates.length) {
              toast("Keine neuen Sensoren gefunden – alle Plätze sind schon belegt oder es passt nichts.", "bad");
              return;
            }
            const roleName = { pv: "PV-Leistung", grid: "Netz (kombiniert)", grid_import: "Netzbezug", grid_export: "Einspeisung", house: "Hausverbrauch" };
            const free = candidates.map((k) => `<label class="suggrow" data-sugg="${k}" data-checked="1">
              <input type="checkbox" checked> <b>${esc(roleName[k] || k)}</b>
              <small>${esc(sugg[k])} – ${esc(friendlyOf(sugg[k]) || sugg[k])}</small>
            </label>`).join("");
            const warnHtml = warns.length
              ? `<div class="msub" style="color:var(--warn,#e39a00);margin-top:10px">⚠️ ${warns.map(esc).join("<br>")}</div>`
              : "";
            const overlay = openModal(`
              <h3>${I.radar} Sensoren automatisch finden</h3>
              <div class="msub">PVM hat diese Sensoren gefunden. Bitte prüfe kurz, ob es wirklich die richtigen sind, und bestätige mit „Übernehmen“.</div>
              <div style="display:flex;flex-direction:column;gap:8px;margin:10px 0;max-height:280px;overflow:auto">${free}</div>
              ${warnHtml}
              <div class="mfoot">
                <button class="btn ghost" data-close>Abbrechen</button>
                <button class="btn primary" data-ok>Übernehmen</button>
              </div>`);
            overlay.addEventListener("click", (ev) => {
              if (ev.target.closest("[data-close]")) { closeModal(); return; }
              const okBtn = ev.target.closest("[data-ok]");
              if (okBtn) {
                closeModal();
                let applied = 0;
                $$(overlay, ".suggrow[data-checked=\"1\"]").forEach((row) => {
                  const k = row.getAttribute("data-sugg");
                  const cb = $(row, "input[type=checkbox]");
                  if (cb && cb.checked) {
                    e[k + "_sensor"] = sugg[k];
                    if (k === "grid") e.grid_mode = "combined";
                    if (k === "grid_import" || k === "grid_export") e.grid_mode = "separate";
                    applied += 1;
                  }
                });
                if (applied) saveAndRefresh(applied + " Sensor" + (applied > 1 ? "en" : "") + " übernommen – bitte einmal prüfen.");
                else toast("Nichts ausgewählt.", "bad");
              }
            });
          })
          .catch(() => toast("Suche fehlgeschlagen", "bad"));
        break;
      }
      case "self-test":
        callSvc("pvm", "run_self_test", {})
          .then(() => toast("Selbsttest gestartet – Ergebnis erscheint als Benachrichtigung.", "ok"))
          .catch(() => toast("Selbsttest fehlgeschlagen", "bad"));
        break;
      case "stat-mode": {
        const m = el.getAttribute("data-stat-mode");
        statState.mode = m;
        Object.assign(statState.on, statModeSets(m));
        refreshStatsView();
        break;
      }
      case "stat-series": {
        const k = el.getAttribute("data-stat-series");
        if (statState.on[k] != null) statState.on[k] = !statState.on[k];
        refreshStatsView();
        break;
      }
      case "stat-range": {
        statState.rangeH = Number(el.getAttribute("data-stat-range")) || 24;
        loadStats();
        break;
      }
      case "stat-type": {
        statState.type = el.getAttribute("data-stat-type") === "line" ? "line" : "area";
        drawStatChart();
        break;
      }
      case "forecast-refresh": {
        toast("Prognose wird neu berechnet …");
        wsTimeout("pvm/forecast_refresh", {}, 20000)
          .then((res) => {
            if (!res) { toast("Keine Prognose verfügbar (offline / keine Koordinaten).", "bad"); return; }
            statState.forecast = res;
            drawForecastPanel();
            updateForecastBadge();
            toast("Prognose aktualisiert.", "ok");
          })
          .catch(() => toast("Prognose konnte nicht geladen werden", "bad"));
        break;
      }
      case "stat-refresh": {
        loadStats();
        break;
      }
      case "reload": window.location.reload(); break;
      default: break;
    }
  }

  /* input-/change-Delegation (Slider + Selects) */
  function onRootInput(root, ev) {
    const man = ev.target.closest("[data-manual-temp],[data-manual-limit]");
    if (man) {
      const valEl = man.closest(".ctlline") && $(man.closest(".ctlline"), ".numval");
      if (valEl) valEl.textContent = fmtNum(parseFloat(man.value), man.getAttribute("data-unit") || "");
      return;
    }
    const slider = ev.target.closest("[data-slider]");
    if (slider) {
      const key = slider.getAttribute("data-slider");
      const valEl = $(root, '[data-el="slider-' + key + '"]');
      if (valEl) valEl.textContent = fmtNum(parseFloat(slider.value), sliderUnit(key));
      return;
    }
    const num = ev.target.closest("[data-num]");
    if (num) {
      // Geräte-Dialog: Zahlenwert am Schieberegler live anzeigen
      const key = num.getAttribute("data-num");
      const valEl = $(root, '[data-numval="' + key + '"]');
      if (valEl) valEl.textContent = fmtNum(parseFloat(num.value), numUnitOf(key));
    }
  }
  function onRootChange(root, ev) {
    const man = ev.target.closest("[data-manual-temp],[data-manual-limit]");
    if (man) {
      const devId = man.getAttribute("data-device");
      const unit = man.getAttribute("data-unit") || "";
      const kind = man.hasAttribute("data-manual-temp") ? "temp_ziel" : "limit";
      const label = man.hasAttribute("data-manual-temp") ? "Temperatur" : "Leistung";
      if (!devId) { toast("Steuerelement nicht konfiguriert.", "bad"); return; }
      const value = parseFloat(man.value);
      // Über den Manager: passt den Wert an die echten Entitäten-Grenzen an
      // (nie out_of_range) und antwortet immer mit einer Meldung.
      wsTimeout("pvm/control", { device_id: devId, kind, value }, 10000)
        .then((res) => {
          toast((res && res.msg) || (label + " gesetzt: " + fmtNum(value, unit)), res && res.ok === false ? "bad" : "ok");
          if (res && res.ok !== false) {
            updateDeviceLives();
            liveNow();
          }
        })
        .catch(() => toast("Konnte nicht gespeichert werden", "bad"));
      return;
    }
    const slider = ev.target.closest("[data-slider]");
    if (slider) {
      const key = slider.getAttribute("data-slider");
      const value = parseFloat(slider.value);
      setGlobalSetting(key, value);
      return;
    }
    const kind = ev.target.closest('[data-setting="grid_kind"]');
    if (kind) {
      // Vorzeichen-Wahl sofort speichern – sonst ginge sie beim nächsten
      // Neuladen verloren (war ein echter Fehler: nur im Speicher geändert).
      state.config.energy.grid_kind = kind.value;
      saveAndRefresh("Vorzeichen gespeichert.");
      return;
    }
    const colorInp = ev.target.closest("[data-accent-color]");
    if (colorInp) {
      const hex = colorInp.value;
      configSettings().accent = "custom";
      configSettings().accent_custom = hex;
      applyTheme();
      saveAndRefresh("Farbe gespeichert: " + hex);
      return;
    }
    // Optionaler Prognose-API-Schlüssel (wird beim Verlassen des Feldes
    // gespeichert; leer = anonyme Abfrage weiter nutzen).
    const apiInp = ev.target.closest("[data-setting-input]");
    if (apiInp) {
      const key = apiInp.getAttribute("data-setting-input");
      configSettings()[key] = String(apiInp.value || "").trim();
      saveAndRefresh(
        configSettings()[key]
          ? "API-Schlüssel gespeichert – Prognose nutzt jetzt deinen Zugang."
          : "API-Schlüssel entfernt – zurück zur anonymen Abfrage.",
        { forecast: true }
      );
    }
  }

  const GLOBAL_ENTITY_KEYS = { reserve: "reserve", cycle: "cycle", min_on: "min_on", min_off: "min_off" };
  function setGlobalSetting(key, value) {
    const settings = state.config.settings;
    const cfgMap = {
      reserve: "reserve_w", cycle: "cycle_s", min_on: "min_on_s", min_off: "min_off_s",
    };
    const cfgKey = cfgMap[key];
    if (!cfgKey) return;
    settings[cfgKey] = value;
    const entKey = GLOBAL_ENTITY_KEYS[key];
    const entityId = entKey && state.entities[entKey];
    if (entityId) {
      // Live über die Entität speichern (kein Reload)
      callSvc("number", "set_value", { entity_id: entityId, value })
        .then(() => toast("Gespeichert.", "ok"))
        .catch(() => saveViaConfig());
    } else {
      saveViaConfig();
    }
  }
  function saveViaConfig() {
    toast("Speichere …");
    saveConfig()
      .then(() => toast("Einstellungen gespeichert.", "ok"))
      .catch(() => toast("Speichern fehlgeschlagen", "bad"));
  }

  function setMode(mode) {
    const id = state.entities.mode;
    if (!id) return;
    const s = st(id);
    const label = L.modes[mode];
    const option = matchOption(s, label);
    callSvc("select", "select_option", { entity_id: id, option: option || label })
      .then(() => {
        state.config.settings.mode = mode;
        toast("Modus: „" + label + "“", "ok");
      })
      .catch(() => toast("Modus konnte nicht gesetzt werden", "bad"));
  }
  function setTheme(key) {
    // Robust: Design wird sofort übernommen und über den Websocket-Speicherweg
    // persistiert – unabhängig davon, ob die select-Entität bereits existiert.
    // Das select-Entity liest die Wahl aus der Konfiguration und zieht automatisch nach.
    const label = L.themes[key] || key;
    state.config.settings.ui_theme = key;
    applyTheme();
    saveAndRefresh("Design: „" + label + "“");
  }
  function matchOption(entityState, label) {
    const opts = entityState && entityState.attributes && entityState.attributes.options;
    if (!opts) return null;
    return opts.find((o) => o === label || o.indexOf(label) >= 0 || label.indexOf(o) >= 0) || null;
  }

  /* ------------------------------------------------------------------ *
   * Design: „Home Assistant“-Theme übernimmt die Farben des HA-Themes.
   * ------------------------------------------------------------------ */
  function readHaVars() {
    const map = {};
    try {
      const topDoc = window.top.document;
      const app = topDoc.querySelector("home-assistant");
      const cs = app ? topDoc.defaultView.getComputedStyle(app) : null;
      if (cs) {
        [
          "--primary-color", "--accent-color", "--app-header-background-color",
          "--app-header-text-color", "--sidebar-background-color",
          "--sidebar-text-color", "--card-background-color", "--primary-text-color",
          "--secondary-text-color", "--divider-color", "--ha-card-border-radius",
          "--ha-card-box-shadow", "--primary-background-color",
          "--background-color", "--state-icon-color",
        ].forEach((prop) => {
          const value = cs.getPropertyValue(prop).trim();
          if (value) map[prop] = value;
        });
      }
    } catch (err) {
      /* Kein Zugriff auf das übergeordnete Dokument (z. B. Preview) */
    }
    return map;
  }

  function applyTheme() {
    const theme = (state.config && state.config.settings && state.config.settings.ui_theme) || "ha";
    const host = state.root && state.root.host;
    if (!host) return;
    host.setAttribute("theme", theme);
    if (theme === "ha") {
      const vars = readHaVars();
      Object.keys(vars).forEach((k) => host.style.setProperty(k, vars[k]));
      try {
        const scheme = window.top.getComputedStyle(window.top.document.documentElement).colorScheme;
        if (scheme) host.style.colorScheme = scheme;
      } catch (err) {
        /* Standard behalten */
      }
    }
    // Deine Farbe des Nutzers – ersetzt das HA-Blau (--acc), die zweite
    // Verlaufsfarbe (--acc2) und die Knopffarbe (--btn). „auto“ = Design-Standard.
    const accentKey = (state.config && state.config.settings && state.config.settings.accent) || "auto";
    const color = accentColorOf(accentKey);
    if (color) {
      host.style.setProperty("--acc", color);
      host.style.setProperty("--acc2", color);
      host.style.setProperty("--btn", color);
    } else {
      host.style.removeProperty("--acc");
      host.style.removeProperty("--acc2");
      host.style.removeProperty("--btn");
    }
  }

  /* ------------------------------------------------------------------ *
   * Zurück zu Home Assistant: Seitenleiste öffnen + zur HA-Startseite.
   * ------------------------------------------------------------------ */
  function goHome() {
    try {
      const topDoc = window.top.document;
      const drawer = topDoc.querySelector("ha-drawer");
      if (drawer && typeof drawer.open === "boolean" && !drawer.open) drawer.open = true;
    } catch (err) {
      /* Seitenleiste nicht erreichbar – Navigation funktioniert trotzdem */
    }
    const url =
      state.hass && typeof state.hass.hassUrl === "function"
        ? state.hass.hassUrl("/")
        : "/";
    try {
      if (window.top && window.top.location) {
        window.top.location.href = url;
        return;
      }
    } catch (err) {
      /* Same-Origin-Beschränkung – unten im eigenen Fenster navigieren */
    }
    window.location.href = url;
  }

  function updateHeaderChip() {
    const root = state.root;
    if (!root) return;
    const chip = $(root, '[data-el="statuschip"]');
    const dot = $(root, '[data-el="statusdot"]');
    if (!chip) return;
    const s = st(state.entities && state.entities.engine_status);
    const txt = s && s.state ? String(s.state) : "…";
    if (chip.textContent !== txt) chip.textContent = txt;
    const cls = /fehler/i.test(txt) ? "dot bad" : /^l\w+uft|^an\b/i.test(txt) ? "dot ok" : "dot warn";
    if (dot.className !== cls) dot.className = cls;
  }

  function renderLoading() {
    const root = state.root;
    if (!root) return;
    root.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);
    const w = document.createElement("div");
    w.className = "loadwrap";
    w.innerHTML = `<div class="spin"></div><div>${esc(L.app)} verbindet mit Home Assistant …</div>`;
    root.appendChild(w);
  }
  function renderError(err) {
    const root = state.root;
    if (!root) return;
    const w = document.createElement("div");
    w.className = "loadwrap";
    w.innerHTML = `<div style="text-align:center;max-width:430px">
      <div style="font-size:30px;margin-bottom:6px">⚠️</div>
      <b>Verbindung fehlgeschlagen</b>
      <p style="color:var(--mut);font-size:13px;margin:8px 0">${esc(err)}</p>
      <button class="btn primary" data-retry>Erneut versuchen</button>
    </div>`;
    const btn = $(w, "[data-retry]");
    if (btn) btn.addEventListener("click", () => window.location.reload());
    root.appendChild(w);
  }

  function defaultDevice(role) {
    const base = {
      id: "", name: "", role: role, enabled: true,
      control: { type: "switch", switch_entity: null, on_entity: null, off_entity: null, number_entity: null, temp_entity: null, has_limiter: false, number_unit: "W", phases: 3 },
      sensors: { power: null, soc: null, temp: null },
      limits: { power_limit_w: 11000, min_on_power_w: 1400, min_on_s: 120, min_off_s: 60 },
      car: null, wp: null,
    };
    if (role === "wallbox" || role === "fahrzeug") {
      base.car = { capacity_kwh: 60, min_soc: 50, max_soc: 80, min_charge_power_w: 4000, grid_min_allowed: true, grid_deadline_allowed: true, manual_force: false, deadline_time: null, deadline_soc: 0 };
    } else if (role === "waermepumpe") {
      base.wp = { comfort_c: 60, safety_min_c: 60, est_power_w: 2000, grid_fallback_allowed: true, boost_c: 65 };
    } else {
      base.limits.nominal_power_w = 2000;
    }
    return base;
  }
})();
