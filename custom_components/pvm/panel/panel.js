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
        "Heizt bei Überschuss auf Komfort-Temperatur, mit Notfall-Schutz und Testlauf.",
      verbraucher:
        "Schaltet Geräte wie Pool, Boiler oder Waschmaschine bei Überschuss ein.",
      fahrzeug:
        "Überwacht Akkustand und Ladeleistung deines Autos – PVM erkennt automatisch, an welcher Wallbox es lädt (oder ob es unterwegs ist).",
    },
    control: {
      switch: "Ein Schalter (An/Aus)",
      switch_number: "Schalter + Leistungs-Begrenzung",
      buttons: "Zwei Taster (Start/Stopp)",
    },
    controlHint: {
      switch: "Ein Schalter schaltet das Gerät komplett an und aus.",
      switch_number:
        "Zusätzlich zum Schalter begrenzt PVM die Leistung über einen Zahlenwert (z. B. Ampere oder kW).",
      buttons:
        "Zwei getrennte Taster: einer startet, einer stoppt. PVM erkennt den Zustand über die Leistung.",
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
      net: "Kombiniert (Bezug +, Einspeisung −)",
      export_only: "Nur Einspeisung (positiv = Einspeisung)",
    },
    themes: {
      ha: "Home Assistant",
      sonnenaufgang: "Sonnenaufgang",
      natur: "Natur-frisch",
      klar: "Kühl & klar",
    },
  };

  /* ------------------------------------------------------------------ *
   * Styles (eingebettet – die Seite ist komplett autark)
   * ------------------------------------------------------------------ */
  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
:host {
  /* Home-Assistant-Farben zuerst – werden beim Start aus dem HA-Theme
     gelesen (applyTheme). Fallback: die alten PVM-Paletten. */
  --acc: var(--primary-color, #ff9f1c); --acc2: var(--accent-color, #ff6b35);
  --ok: #2dd4a7; --warn: #ffb020; --bad: #ff5d6c; --net: #5b9cf0;
  --bg0: var(--primary-background-color, #071426);
  --bg1: var(--app-header-background-color, #0b1d33);
  --bg2: var(--card-background-color, #10243f);
  --card: var(--card-background-color, rgba(255,255,255,.045));
  --card2: var(--card-background-color, rgba(255,255,255,.09));
  --line: var(--divider-color, rgba(255,255,255,.12));
  --txt: var(--primary-text-color, #eaf2fb);
  --mut: var(--secondary-text-color, #9db2c9);
  --r: var(--ha-card-border-radius, 14px);
  --sh: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,.12));
  color-scheme: dark;
  font-family: Roboto, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  color: var(--txt);
  background: var(--primary-background-color, linear-gradient(180deg, var(--bg1), var(--bg0)));
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
:host([theme="ha"]) {
  /* alles über die HA-Variablen – wird in applyTheme gesetzt */
}
.wrap { max-width: 1060px; margin: 0 auto; padding: 16px 16px 90px; }

header { display:flex; align-items:center; gap:14px; flex-wrap:wrap; padding: 6px 2px 16px; }
.logo { width:46px;height:46px;border-radius:14px;flex:0 0 auto; display:grid;place-items:center;color:#fff;
  background:linear-gradient(135deg,var(--acc),var(--acc2)); box-shadow:0 6px 18px rgba(0,0,0,.35); }
.logo svg{width:26px;height:26px}
.titles { flex:1 1 auto; min-width:170px; }
.titles h1 { margin:0; font-size:20px; }
.titles p { margin:2px 0 0; color:var(--mut); font-size:12.5px; }
.chips { display:flex; gap:8px; flex-wrap:wrap; }
.chip { background:var(--card2); border:1px solid var(--line); padding:7px 12px; border-radius:999px;
  font-size:13px; display:flex; gap:7px; align-items:center; white-space:nowrap; }
.chip b { font-weight:700 }
.dot { width:8px;height:8px;border-radius:50%; background:var(--mut); display:inline-block; flex:0 0 auto; }
.dot.ok { background:var(--ok); box-shadow:0 0 8px var(--ok); animation:pulse 1.6s infinite; }
.dot.bad { background:var(--bad); box-shadow:0 0 8px var(--bad); }
.dot.warn { background:var(--warn); box-shadow:0 0 8px var(--warn); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }

nav { display:flex; gap:6px; flex-wrap:wrap; background:var(--card); border:1px solid var(--line);
  border-radius:14px; padding:6px; position:sticky; top:10px; z-index:30; backdrop-filter:blur(8px); }
nav button { border:0; background:transparent; color:var(--mut); font:inherit; font-size:13.5px;
  padding:9px 13px; border-radius:10px; cursor:pointer; transition:.18s; display:flex; gap:7px; align-items:center; }
nav button svg{width:16px;height:16px}
nav button:hover { color:var(--txt); background:var(--card2); }
nav button.on { background:linear-gradient(135deg,var(--acc),var(--acc2)); color:#fff; font-weight:600; }

section.view { animation:fade .22s ease; }
@keyframes fade { from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:none} }
.hidden { display:none !important; }
h2.sec { font-size:17px; margin:20px 0 4px; }
p.sub { color:var(--mut); margin:2px 0 14px; font-size:13.5px; line-height:1.5; }

.hero { border-radius:var(--r); padding:26px 24px; margin-top:16px; position:relative; overflow:hidden;
  border:1px solid var(--line); background:var(--card2); box-shadow:var(--sh); }
.hero h2 { margin:0 0 8px; font-size:22px; }
.hero p { margin:0 0 18px; color:var(--mut); max-width:600px; line-height:1.6; }
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

button.btn { border:0; cursor:pointer; font:inherit; font-size:13.5px; font-weight:500; padding:10px 16px;
  border-radius:4px; transition:.18s; display:inline-flex; align-items:center; gap:8px; }
button.btn svg{width:16px;height:16px}
.btn.primary { background:var(--acc); color:#fff; font-weight:500;
  box-shadow:0 2px 6px rgba(0,0,0,.18); }
.btn.primary:hover { filter:brightness(1.08); }
.btn.ghost { background:var(--card2); color:var(--txt); border:1px solid var(--line); }
.btn.ghost:hover { border-color: var(--acc); }
.btn.danger { background:rgba(255,93,108,.14); color:var(--bad); border:1px solid rgba(255,93,108,.4); }
.btn.danger:hover { background:rgba(255,93,108,.26); }
.btn:disabled { opacity:.45; cursor:not-allowed; transform:none !important; }
button.ico { background:var(--card2); border:1px solid var(--line); border-radius:9px; cursor:pointer;
  width:32px;height:32px; display:grid;place-items:center; color:var(--mut); transition:.15s; padding:0; }
button.ico:hover { color:var(--txt); border-color:var(--acc); }
button.ico svg{width:15px;height:15px}

.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-top:10px; }
.stat { background:var(--card); border:1px solid var(--line); border-radius:var(--r); padding:14px 15px; box-shadow:var(--sh); }
.stat .k { color:var(--mut); font-size:11px; text-transform:uppercase; letter-spacing:.8px; display:flex; align-items:center; gap:6px; }
.stat .k svg{width:14px;height:14px}
.stat .v { font-size:25px; font-weight:800; margin-top:8px; font-variant-numeric: tabular-nums; }
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

.devices { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; margin-top:12px; }
.dev { background:var(--card); border:1px solid var(--line); border-radius:var(--r); padding:13px 14px;
  transition:.2s; position:relative; box-shadow:var(--sh); }
.dev:hover { border-color: rgba(255,159,28,.5); transform:translateY(-2px); }
.dev .head { display:flex; align-items:center; gap:10px; }
.dev .ic { width:38px;height:38px;border-radius:11px; display:grid;place-items:center; flex:0 0 auto;
  background:linear-gradient(140deg, rgba(255,159,28,.22), transparent); border:1px solid rgba(255,159,28,.35); }
.dev .ic svg { width:21px; height:21px; color: var(--acc); }
.dev h3 { margin:0; font-size:14.5px; flex:1; }
.dev .pill { font-size:10px; padding:3px 9px; border-radius:999px; border:1px solid var(--line);
  color:var(--mut); text-transform:uppercase; letter-spacing:.5px; white-space:nowrap; }
.dev .pill.on { color:#04231a; background:var(--ok); border-color:var(--ok); font-weight:800; }
.dev .pill.warn { color:#3d2400; background:var(--warn); border-color:var(--warn); font-weight:800; }
.dev .mid { display:flex; gap:12px; align-items:center; margin-top:12px; flex-wrap:wrap; }
.dev .bigw { font-size:22px; font-weight:800; font-variant-numeric:tabular-nums; min-width:70px; }
.dev .bigw small { font-size:11px; color:var(--mut); font-weight:600; }
.dev .soc { flex:1; min-width:120px; margin-top:10px; }
.dev .soc .row { display:flex; justify-content:space-between; font-size:11px; color:var(--mut); margin-bottom:4px; }
.socbar { height:9px; border-radius:6px; background:var(--card2); overflow:hidden; }
.socbar i { display:block; height:100%; border-radius:6px; transition:width .5s ease; background:linear-gradient(90deg,var(--ok),var(--acc)); }
.dev .goal { margin-top:7px; font-size:11px; color:var(--mut); }
.dev .tags { margin-top:10px; display:flex; flex-wrap:wrap; gap:6px; }
.tag { font-size:11px; background:var(--card2); border:1px solid var(--line); border-radius:999px; padding:3px 9px; color:var(--mut); }
.tag.role { text-transform:uppercase; letter-spacing:.5px; font-size:9.5px; }
.dev .ops { display:flex; gap:8px; justify-content:flex-end; margin-top:11px; border-top:1px solid var(--line); padding-top:10px; align-items:center; }
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
  background:var(--card); display:flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow:var(--sh); }
.founditem .grow { flex:1; min-width:200px; }
.founditem h4 { margin:0 0 3px; font-size:14.5px; }
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
  };
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
    modal: null,
    deviceDialog: null,
    lastLive: 0,
    liveStates: {},   // Live-Zustände über WS-Subscription (state_changed)
    liveSubscribed: false,
    liveTimer: null,
    flowSig: null,
  };

  const $ = (root, sel) => root.querySelector(sel);
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

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
  function rankOf(deviceId) { return devicesOf().findIndex((d) => d.id === deviceId) + 1; }

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
    return data;
  }
  async function saveConfig() {
    const res = await ws("pvm/save_config", { config: state.config });
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

  function reloadAfterChange() {
    const expected = configSignature(state.config);
    const keepView = state.view;
    let attempts = 0;
    const tryFetch = () => {
      fetchConfig()
        .then((data) => {
          if (configSignature(data.config) === expected || attempts >= 15) {
            state.panel._renderApp();
            if (keepView) state.panel._nav(keepView);
          } else {
            attempts += 1;
            setTimeout(tryFetch, 800);
          }
        })
        .catch(() => {
          attempts += 1;
          if (attempts >= 15) return;
          setTimeout(tryFetch, 1000);
        });
    };
    setTimeout(tryFetch, 1400);
  }

  /* ------------------------------------------------------------------ *
   * Haupt-Element
   * ------------------------------------------------------------------ */
  class PvmPanel extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" });
      state.panel = this;
      state.root = this.shadowRoot;
      renderLoading();
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
      if (!state.hass || state.config) return;
      try {
        await fetchConfig();
        this._renderApp();
      } catch (err) {
        renderError(String((err && err.message) || err));
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
      else if (view === "settings") html = htmlSettings();
      section.innerHTML = html;
      liveNow();
      updateHeaderChip();
      updateDeviceLives();
    }
  }
  customElements.define("pvm-panel", PvmPanel);

  function buildShell() {
    const root = document.createElement("div");
    root.className = "wrap";
    root.innerHTML = `
      <header>
        <div class="logo">${I.sun}</div>
        <div class="titles">
          <h1>${esc(L.app)}</h1>
          <p>${esc(L.tagline)}</p>
        </div>
        <div class="chips">
          <span class="chip"><span class="dot" data-el="statusdot"></span><span data-el="statuschip">…</span></span>
          <span class="chip">Überschuss <b data-live="surplus">–</b></span>
        </div>
        <button class="btn ghost" data-action="go-home" title="Zurück zu Home Assistant">${I.back} Home Assistant</button>
      </header>
      <nav>
        <button data-view="start">${I.sun} ${esc(L.nav.start)}</button>
        <button data-view="overview">${I.eye} ${esc(L.nav.overview)}</button>
        <button data-view="devices">${I.plug} ${esc(L.nav.devices)}</button>
        <button data-view="order">${I.list} ${esc(L.nav.order)}</button>
        <button data-view="found">${I.radar} ${esc(L.nav.found)}</button>
        <button data-view="settings">${I.gear} ${esc(L.nav.settings)}</button>
      </nav>
      <div id="view"></div>
    `;
    root.addEventListener("click", (ev) => onRootClick(root, ev));
    root.addEventListener("input", (ev) => onRootInput(root, ev));
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
    if (e.grid_sensor) labels.push("Netz");
    if (e.grid_import_sensor) labels.push("Netzbezug");
    if (e.grid_export_sensor) labels.push("Einspeisung");
    if (e.house_sensor) labels.push("Hausverbrauch");
    if (e.battery_power_sensor) labels.push("Speicher");
    const any = labels.length > 0;
    return { any, labels, text: labels.length ? labels.join(", ") : "keine Sensoren verbunden" };
  }

  function htmlStart() {
    const e = energyStatus();
    const devs = devicesOf();
    const allSteps = ["energy", "devices", "order", "design"];
    const stepState = {
      energy: e.any,
      devices: devs.length > 0,
      order: devs.length > 1,
      design: true,
    };
    const stepText = {
      energy: e.any
        ? "Verbunden: " + e.text
        : "PV-/Netz-Sensor verbinden – erst dann kennt PVM deinen Überschuss.",
      devices: devs.length
        ? devs.length + " Gerät" + (devs.length > 1 ? "e" : "") + " konfiguriert"
        : "Wallbox, Wärmepumpe oder Verbraucher hinzufügen – Schritt für Schritt gefragt.",
      order: devs.length > 1
        ? "Prioritäten gesetzt – wer zuerst Überschuss bekommt."
        : "Bei mehreren Geräten legst du fest, wer zuerst bekommt.",
      design: "Design anpassen – dein Dashboard, deine Farben.",
    };
    const firstOpen = allSteps.find((s) => !stepState[s]) || allSteps[allSteps.length - 1];
    const quick = `
      <div class="cards">
        ${statCard("pv", "PV-Erzeugung", liveSurplusText("pv"))}
        ${statCard("surplus", "Überschuss", liveSurplusText("surplus"))}
        ${statCard("grid", "Netz", liveSurplusText("grid"))}
      </div>`;
    return `
      <div class="hero">
        <div class="sun"></div>
        <h2>${(devs.length === 0 && !e.any) ? "Willkommen bei PV Manager ☀️" : "Dein PV-Manager"}</h2>
        <p>PV Manager verteilt deinen PV-Überschuss automatisch an Wallbox, Wärmepumpe und Verbraucher –
           sparsam und zuverlässig. In vier Schritten bist du fertig – alles direkt hier auf dieser Seite.</p>
        <div class="steps">
          ${allSteps.map((s, i) => `
            <div class="step ${stepState[s] ? "done" : ""} ${s === firstOpen && !stepState[s] ? "active" : ""}"
                 data-jump="${s}">
              <div class="n">${stepState[s] ? I.check : i + 1}</div>
              <b>${esc(stepLabel(s))}</b>
              <span>${esc(stepText[s])}</span>
            </div>`).join("")}
        </div>
        <div class="btnrow">
          <button class="btn primary" data-action="jump" data-to="energy">${I.grid} Energie-Sensoren</button>
          <button class="btn ghost" data-action="add-device">${I.plus} Gerät hinzufügen</button>
          <button class="btn ghost" data-action="run-scan">${I.radar} Automatisch suchen</button>
        </div>
      </div>
      ${(devs.length || e.any) ? `<h2 class="sec">Aktueller Stand</h2><p class="sub">${esc(e.text)} · ${devs.length} Gerät${devs.length === 1 ? "" : "e"}</p>` + quick + (devs.length ? `<div class="devices">${devs.map(htmlDeviceCard).join("")}</div>` : "") : ""}
    `;
  }

  function stepLabel(s) {
    return { energy: "Energie-Sensoren", devices: "Geräte hinzufügen", order: "Reihenfolge", design: "Design" }[s] || s;
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
    const imp = numW(e.grid_import_sensor);
    const exp = numW(e.grid_export_sensor);
    if (e.grid_import_sensor || e.grid_export_sensor) {
      if (exp != null) return Math.max(0, exp);
      return null;
    }
    const grid = numW(e.grid_sensor);
    const pv = numW(e.pv_sensor);
    const house = numW(e.house_sensor);
    const kind = e.grid_kind || "net";
    if (e.grid_sensor && grid != null) return kind === "net" ? Math.max(0, -grid) : Math.max(0, grid);
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
      const id = ent.surplus;
      const v = num(id);
      if (v != null) return { text: fmtNum(v, unitOf(id) || "W"), raw: v };
      const ex = calcExport();
      if (ex == null) return { text: "–", raw: 0 };
      const val = Math.max(0, ex - Number(configSettings().reserve_w || 0));
      return { text: fmtW(val), raw: val };
    }
    if (key === "pv") return { text: energyText("pv_sensor"), raw: 0 };
    if (key === "house") return { text: energyText("house_sensor"), raw: 0 };
    if (key === "grid") return { text: energyText("grid_sensor"), raw: 0 };
    if (key === "grid_import") return { text: energyText("grid_import_sensor"), raw: 0 };
    if (key === "grid_export") return { text: energyText("grid_export_sensor"), raw: 0 };
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
    if (key === "grid_sensor" && (e.grid_kind || "net") === "net" && !unitOf(id)) {
      return v < 0 ? "↦ " + fmtW(-v) : "↤ " + fmtW(v);
    }
    if (key === "grid_import_sensor")
      return "↓ " + fmtNum(v, unitOf(id) || "W");
    if (key === "grid_export_sensor")
      return "↑ " + fmtNum(v, unitOf(id) || "W");
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
    if (imp != null || exp != null) {
      importOn = imp != null && imp > 40;
      exportOn = exp != null && exp > 40;
    } else if (grid != null) {
      if (kind === "net") {
        importOn = grid > 40;
        exportOn = -grid > 40;
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
        ${statCard("grid", "Netz", "–")}
        ${e.battery_power_sensor ? statCard("batt", "Speicher", "–") : ""}
        ${statCard("surplus", "Überschuss für PVM", "–")}
      </div>
      <div class="flowbox">
        <div class="flowtitle">Dein Energiefluss
          <small data-el="flowsmall">…</small>
        </div>
        <div data-flow-svg>${flowSvg(flowParams())}</div>
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
    const mode = configSettings().mode || "auto";
    const reserve = configSettings().reserve_w || 0;
    const devs = devicesOf();
    return "Modus „" + L.modes[mode] + "“ · Reserve " + fmtW(reserve) +
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
    const devY = 214;
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
    // --- Knoten ---
    parts.push(node(px, rowY, boxW, boxH, "PV", fmtW(o.pvRaw || 0), col.pv));
    parts.push(node(hx, rowY, boxW, boxH, "Haus", fmtW(o.houseV || 0), col.haus));
    parts.push(node(gx, rowY, boxW, boxH, "Netz", netValue(o), col.netz));
    if (o.batt != null)
      parts.push(node(batX, batY, boxW, boxH - 6, "Speicher", fmtW(Math.abs(o.batt)), "#3ecf8e"));
    parts.push(node(hubX, hubY, 220, 54, "PVM-Überschuss", liveSurplusText("surplus"), col.surplus));

    // --- Verbindungen (obere Reihe) ---
    // PV -> Haus
    if (o.pvRaw != null && o.pvRaw > 40)
      parts.push(arrow(px + boxW, centerY, hx - 8, centerY, col.pv, "slow", "Eigenverbrauch", px + boxW + 60, centerY - 8));
    // Haus <-> Netz: Import (rot, rückwärts) oder Export (grün)
    if (o.importOn)
      parts.push(arrow(gx, centerY, hx + boxW + 8, centerY, col.netz, "", "Netzbezug", gx - 60, centerY - 8));
    else if (o.exportOn)
      parts.push(arrow(hx + boxW, centerY, gx - 8, centerY, col.green, "slow", "Einspeisung", gx - 60, centerY - 8));
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
    // --- Hub -> Geräte ---
    if (o.surplusOn && o.devNames.length)
      parts.push(arrow(hubX + 110, hubY + 54, hubX + 110, devY - 10, col.surplus, ""));
    // --- Geräte-Streifen ---
    if (o.devNames.length) {
      const text = o.devNames.slice(0, 3).join("  ·  ") + (o.devNames.length > 3 ? "  ·  +" + (o.devNames.length - 3) : "");
      parts.push(`
        <g class="nbox">
          <rect x="${hubX}" y="${devY}" width="220" height="30" rx="15" fill="rgba(255,255,255,.06)" stroke="var(--acc)" stroke-width="1.2"/>
          <text x="${hubX + 110}" y="${devY + 20}" text-anchor="middle" fill="var(--txt)" font-size="11" font-weight="600">${esc(text)}</text>
        </g>`);
    }
    return `<svg class="flow" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
  }
  function netValue(o) {
    // Netz-Knoten: getrennte Bezug-/Einspeisung-Sensoren -> beide anzeigen
    if (o.imp != null || o.exp != null) {
      const imp = o.imp != null ? o.imp : 0;
      const exp = o.exp != null ? o.exp : 0;
      return `↓ ${fmtW(imp)}  ↑ ${fmtW(exp)}`;
    }
    const g = o.gridV;
    if (g == null) return "–";
    if (g > 0) return "↓ " + fmtW(g);
    return "↑ " + fmtW(-g);
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
    return `
      <h2 class="sec">Geräte & Verbraucher</h2>
      <p class="sub">Jedes Gerät steuert PVM automatisch. Mit „Bearbeiten“ passt du Steuerung, Sensoren und Ziele an.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        <button class="btn primary" data-action="add-device">${I.plus} Gerät hinzufügen</button>
        <button class="btn ghost" data-action="run-scan">${I.radar} Automatisch suchen</button>
      </div>
      ${others.length ? `<div class="devices" style="margin-top:14px">${others.map(htmlDeviceCard).join("")}</div>` : (devs.length ? "" : empty)}
      ${cars.length ? `
        <h2 class="sec" style="margin-top:22px">🚗 E-Autos
          <span style="font-weight:400;color:var(--mut);font-size:12.5px"> – PVM erkennt automatisch, an welcher Wallbox jedes Auto lädt.</span>
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
    const sid = device.sensors && device.sensors.soc;
    const socV = num(sid);
    const tags = [
      { t: "Prio " + (rankOf(device.id) || "–"), cls: "tag" },
      { t: L.roles[role] || role, cls: "tag role" },
    ];
    const ctrl = device.control || {};
    if (ctrl.type === "buttons") tags.push({ t: "2 Taster", cls: "tag" });
    else if (ctrl.type === "switch_number") tags.push({ t: "Leistungs-Limit", cls: "tag" });
    const car = device.car;
    let goalTxt = "";
    if (role === "wallbox" && car) {
      goalTxt = "Ziel " + Math.round(car.min_soc || 0) + "–" + Math.round(car.max_soc || 100) + " %";
      if (Number(car.deadline_soc || 0) > 0 && car.deadline_time)
        goalTxt += " · bis " + car.deadline_time + " → " + Math.round(car.deadline_soc) + " %";
      if (car.manual_force) goalTxt += " · Power Charge an";
    }
    return `
      <div class="dev" data-device="${esc(device.id)}">
        <div class="head">
          <div class="ic">${ROLE_ICON[role] || I.plug}</div>
          <h3>${esc(device.name || "Gerät")}</h3>
          <span class="pill" data-el="pill">…</span>
        </div>
        <div class="mid">
          ${pid ? `<div class="bigw" data-live="devpwr:${esc(device.id)}">–</div>` : ""}
        </div>
        ${role === "wallbox" && sid ? `
          <div class="soc">
            <div class="row"><span>Akku</span><span data-live="devsoc:${esc(device.id)}">–</span></div>
            <div class="socbar"><i id="socbar-${esc(device.id)}" style="width:${socV == null ? 0 : Math.max(0, Math.min(100, socV))}%"></i></div>
          </div>` : ""}
        ${role === "wallbox" ? `<div class="goal" data-el="assigned-car"></div>` : ""}
        ${goalTxt ? `<div class="goal">${esc(goalTxt)}</div>` : ""}
        <div class="statusline" data-el="statusline">…</div>
        <div class="tags">${tags.map((t) => `<span class="${t.cls}">${esc(t.t)}</span>`).join("")}</div>
        <div class="ops">
          <span class="lbl" style="flex:1;font-size:12px">Automatik</span>
          <span class="sw ${autoOn ? "on" : ""}" data-action="toggle-auto" data-device="${esc(device.id)}"><i></i></span>
          <button class="ico" data-action="edit-device" data-device="${esc(device.id)}" title="Bearbeiten">${I.edit}</button>
          <button class="ico" data-action="del-device" data-device="${esc(device.id)}" title="Entfernen">${I.del}</button>
        </div>
      </div>`;
  }

  function htmlCarCard(device) {
    const sid = device.sensors && device.sensors.soc;
    const pid = device.sensors && device.sensors.power;
    const socV = num(sid);
    const car = device.car || {};
    const goalTxt = "Ziel " + Math.round(car.min_soc || 0) + "–" + Math.round(car.max_soc || 100) + " %";
    return `
      <div class="dev" data-device="${esc(device.id)}">
        <div class="head">
          <div class="ic">${I.car}</div>
          <h3>${esc(device.name || "Auto")}</h3>
          <span class="pill" data-el="pill">…</span>
        </div>
        <div class="mid">
          ${pid ? `<div class="bigw" data-live="devpwr:${esc(device.id)}">–</div>` : ""}
        </div>
        ${sid ? `
          <div class="soc">
            <div class="row"><span>Akku</span><span data-live="devsoc:${esc(device.id)}">–</span></div>
            <div class="socbar"><i id="socbar-${esc(device.id)}" style="width:${socV == null ? 0 : Math.max(0, Math.min(100, socV))}%"></i></div>
          </div>` : ""}
        <div class="goal">${esc(goalTxt)}</div>
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
    const txt = deviceStateText(device);
    if (device.role === "fahrzeug") {
      if (/^lädt\b/.test(txt)) return `<span class="pill on">LÄDT</span>`;
      return `<span class="pill">unterwegs</span>`;
    }
    const autoOn = isOn(entOf(device.id).auto);
    if (!autoOn) return `<span class="pill">Automatik aus</span>`;
    if (/^an\b|^läuft/i.test(txt)) return `<span class="pill on">AN</span>`;
    if (/fehler/i.test(txt)) return `<span class="pill warn">Fehler</span>`;
    if (/^aus\b/i.test(txt)) return `<span class="pill">aus</span>`;
    return `<span class="pill">bereit</span>`;
  }

  function updateDeviceLives() {
    const root = state.root;
    if (!root || !state.config) return;
    devicesOf().forEach((d) => {
      const card = $(root, '[data-device="' + CSS.escape(d.id) + '"]');
      if (!card) return;
      const pill = $(card, '[data-el="pill"]');
      if (pill) pill.outerHTML = statusPillFor(d);
      const line = $(card, '[data-el="statusline"]');
      if (line) line.textContent = deviceStateText(d);
      const sid = d.sensors && d.sensors.soc;
      const bar = $(card, "#socbar-" + CSS.escape(d.id));
      if (bar) {
        const v = num(sid);
        bar.style.width = (v == null ? 0 : Math.max(0, Math.min(100, v))) + "%";
      }
      const autoSw = $(card, '[data-action="toggle-auto"]');
      if (autoSw) autoSw.classList.toggle("on", isOn(entOf(d.id).auto));
      // Wallbox: zeigt das automatisch zugeordnete Auto an
      const assigned = $(card, '[data-el="assigned-car"]');
      if (assigned) {
        const names = devicesOf()
          .filter((c) => c.role === "fahrzeug")
          .filter((c) => {
            const s = st(entOf(c.id).car_status);
            return s && s.attributes && s.attributes.wallbox_id === d.id;
          })
          .map((c) => c.name || "Auto");
        const txt = names.length ? "🚗 " + names.join(", ") : "";
        if (assigned.textContent !== txt) assigned.textContent = txt;
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
      <p class="sub">Oben = höchste Priorität. Wer zuerst da ist, bekommt zuerst Überschuss.</p>
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
   * Einstellungen
   * ------------------------------------------------------------------ */
  function htmlSettings() {
    const s = configSettings();
    const e = configEnergy();
    const theme = s.ui_theme || "sonnenaufgang";
    return `
      <h2 class="sec">Einstellungen</h2>
      <p class="sub">Jede Gruppe klappt sich auf – Änderungen speichert PVM direkt.</p>
      ${accordion("energy", I.grid, "Energie-Sensoren", `
        ${energyRow("pv", "PV-Leistung", "Dein Wechselrichter (W oder kW)", e.pv_sensor)}
        ${energyRow("grid", "Netz (kombiniert)", "Ein Sensor mit Bezug + und Einspeisung −", e.grid_sensor)}
        ${energyRow("grid_import", "Netzbezug (separat)", "Getrennter Zähler für Strom aus dem Netz", e.grid_import_sensor)}
        ${energyRow("grid_export", "Einspeisung (separat)", "Getrennter Zähler für deine Netzeinspeisung", e.grid_export_sensor)}
        ${energyRow("house", "Hausverbrauch (optional)", "Gesamtverbrauch des Hauses", e.house_sensor)}
        ${energyRow("battery_power", "Speicher-Leistung (optional)", "Lade-/Entladeleistung deines Batteriespeichers", e.battery_power_sensor)}
        ${energyRow("battery_soc", "Speicher-SoC (optional)", "Ladezustand des Speichers in %", e.battery_soc_sensor)}
        <div class="row">
          <span class="lbl grow">Art des kombinierten Netz-Sensors<small>Wie dein Zähler misst – wichtig für die Richtung.</small></span>
          <select data-setting="grid_kind" style="max-width:300px">
            ${Object.keys(L.gridKinds).map((k) => `<option value="${k}" ${(e.grid_kind || "net") === k ? "selected" : ""}>${esc(L.gridKinds[k])}</option>`).join("")}
          </select>
        </div>
        <div><button class="btn primary" data-action="save-energy">${I.check} Speichern</button></div>
      `, true)}
      ${accordion("steuerung", I.gear, "Steuerung", `
        <span class="lbl">Betriebsmodus<small>Wie PVM deine Geräte steuert.</small></span>
        <div class="pick">
          ${Object.keys(L.modes).map((m) => `
            <label class="${(s.mode || "auto") === m ? "sel" : ""}" data-mode="${m}">
              <span class="rb"></span>
              <span class="tt"><b>${esc(L.modes[m])}</b><span>${esc(L.modeHint[m])}</span></span>
            </label>`).join("")}
        </div>
        ${slider("reserve", "Einspeise-Reserve", s.reserve_w, 0, 2000, 10, "W", "Leistung, die als Puffer für Wolken zurückbleibt.")}
        ${slider("cycle", "Zykluszeit", s.cycle_s, 10, 300, 5, "s", "Wie oft PVM neu entscheidet (empfohlen: 30 s).")}
        ${slider("min_on", "Mindest-Einschaltdauer", s.min_on_s, 30, 600, 10, "s", "So lange bleibt ein Gerät nach dem Einschalten mindestens an (kein Flackern).")}
        ${slider("min_off", "Mindest-Ausschaltdauer", s.min_off_s, 10, 300, 5, "s", "So lange bleibt ein Gerät nach dem Ausschalten mindestens aus.")}
      `)}
      ${accordion("wp", I.pump, "Wärmepumpe", `
        ${slider("wp_test_target", "Test-Zieltemperatur", s.wp_test_target_c, 50, 80, 1, "°C", "Bis zu dieser Temperatur misst der Testlauf die Leistung deiner Wärmepumpe.")}
        ${slider("wp_test_max", "Test: maximale Dauer", s.wp_test_max_duration_min, 10, 600, 10, "min", "Erreicht der Test das Ziel nicht rechtzeitig, bricht PVM ihn ab.")}
      `)}
      ${accordion("design", I.eye, "Design & Darstellung", `
        <span class="lbl">Dein Look<small>„Home Assistant“ folgt deinem HA-Theme (hell/dunkel); die anderen Designs sind feste Stimmungen.</small></span>
        <div class="pick">
          ${Object.keys(L.themes).map((t) => `
            <label class="${theme === t ? "sel" : ""}" data-theme-pick="${t}">
              <span class="rb"></span>
              <span class="tt"><b>${esc(L.themes[t])}</b><span>${themeDots(t)}</span></span>
            </label>`).join("")}
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
    return `
      <div class="acc ${open ? "open" : ""}" data-acc="${id}">
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
    return `
      <div class="row" data-energy-row="${key}">
        <span class="sw ${has ? "on" : ""}" data-action="toggle-energy" data-energy="${key}" title="Sensor aktiv?"><i></i></span>
        <span class="lbl grow">${esc(label)}<small>${esc(hint)}</small>
          ${has ? `<span class="entv" data-el="ent-${key}">${esc(friendlyOf(entityId))} (${esc(entityId)})</span>` : ""}
        </span>
        <button class="btn ghost" data-action="pick-energy" data-energy="${key}" ${has ? "" : "disabled"} style="padding:7px 12px">${I.search} Wählen</button>
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
  const sliderUnit = (key) => ({ reserve: "W", cycle: "s", min_on: "s", min_off: "s", wp_test_target: "°C", wp_test_max: "min" }[key] || "");

  /* ------------------------------------------------------------------ *
   * Dialoge (vollständig selbst gebaut)
   * ------------------------------------------------------------------ */
  function openModal(html) {
    closeModal();
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    overlay.addEventListener("mousedown", (ev) => {
      if (ev.target === overlay) closeModal();
    });
    state.root.appendChild(overlay);
    state.modal = overlay;
    return overlay;
  }
  function closeModal() {
    if (state.modal) state.modal.remove();
    state.modal = null;
    state.deviceDialog = null;
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
  }

  function deviceSub(step) {
    return step === 1
      ? "Schritt 1 von 3 – Was ist es, wie heißt es?"
      : step === 2
        ? "Schritt 2 von 3 – Wie wird es gesteuert bzw. überwacht?"
        : "Schritt 3 von 3 – Sensoren und Ziele (alles ist optional).";
  }

  function deviceBody(step, d) {
    if (step === 1) {
      return `
        <div class="f"><label>Gerätetyp</label><small>Bestimmt, welche Ziele und Felder PVM anbietet.</small></div>
        <div class="pick">
          ${["wallbox", "waermepumpe", "verbraucher", "fahrzeug"].map((r) => `
            <label class="${d.role === r ? "sel" : ""}" data-role="${r}">
              <span class="rb"></span>
              <span class="tt"><b>${esc(L.roles[r])}</b><span>${esc(L.roleHint[r])}</span></span>
            </label>`).join("")}
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
                 Ladeleistung und erkennt automatisch, an welcher Wallbox das Auto
                 gerade lädt (oder ob es unterwegs ist).</p>
            </div>
          </div>`;
      }
      return `
        <div class="f"><label>Steuerung</label><small>Wie schaltet PVM dein Gerät? Entweder/oder – PVM zeigt nur die passenden Felder.</small></div>
        <div class="pick">
          ${["switch", "switch_number", "buttons"].map((ct) => `
            <label class="${d.control.type === ct ? "sel" : ""}" data-ctrl="${ct}">
              <span class="rb"></span>
              <span class="tt"><b>${esc(L.control[ct])}</b><span>${esc(L.controlHint[ct])}</span></span>
            </label>`).join("")}
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
    const row = (field, label, hint) => `
      <div class="f">
        <label>${esc(label)}</label><small>${esc(hint)}</small>
        <div class="ent">
          <input type="text" data-field="${field}" value="${esc(c[field] || "")}" readonly placeholder="Tippen zum Wählen" style="cursor:pointer">
          <button class="btn ghost" data-pick-field="${field}" type="button">${I.search} Wählen</button>
        </div>
      </div>`;
    if (c.type === "buttons") {
      html += row("on_entity", "Start-Taster", "Beispiel: button.wallbox_laden_starten");
      html += row("off_entity", "Stopp-Taster", "Beispiel: button.wallbox_laden_stoppen");
    } else {
      html += row("switch_entity", "Schalter (An/Aus)", "Beispiel: switch.wallbox_freigabe");
    }
    if (c.type === "switch_number") {
      html += row("number_entity", "Leistungs-/Strom-Limit", "Beispiel: number.wallbox_max_strom");
      html += `
        <div class="row">
          <span class="lbl grow">Einheit des Limit-Werts<small>In welcher Einheit gibt deine Wallbox das Limit an?</small></span>
          <select data-field="number_unit" style="max-width:160px">
            ${["W", "kW", "A", "mA"].map((u) => `<option ${c.number_unit === u ? "selected" : ""}>${u}</option>`).join("")}
          </select>
        </div>
        <div class="row">
          <span class="lbl grow">Phasen<small>Wird für die Umrechnung von Ampere in Watt genutzt.</small></span>
          <select data-field="phases" style="max-width:160px">
            <option value="3" ${c.phases === 3 ? "selected" : ""}>3 Phasen</option>
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
        <div class="ent">
          <input type="range" data-num="${key}" min="${min}" max="${max}" step="${step}" value="${v}" style="flex:1">
          <span style="color:var(--mut);width:54px;font-size:13px">${esc(unit)}</span>
        </div>
      </div>`;
  }

  function roleFields(d) {
    const out = [];
    const sensorRow = (field, label, hint) => `
      <div class="f">
        <label>${esc(label)}</label><small>${esc(hint)}</small>
        <div class="ent">
          <input type="text" data-field="${field}" value="${esc(d.sensors[field] || "")}" readonly placeholder="Tippen zum Wählen" style="cursor:pointer">
          <button class="btn ghost" data-pick-field="${field}" type="button">${I.search} Wählen</button>
        </div>
      </div>`;
    if (d.role === "fahrzeug") {
      const car = d.car;
      out.push(sensorRow("soc", "Akku (SoC)", "Ladezustand des Autos in % – z. B. von der Auto-Integration."));
      out.push(sensorRow("power", "Aktuelle Ladeleistung", "Was das Auto gerade zieht – zum Vergleich mit den Wallboxen."));
      out.push(numberField("capacity", "Batteriekapazität", car.capacity_kwh, 1, 300, 1, "kWh"));
      out.push(numberField("min_soc", "Mindest-SOC", car.min_soc, 0, 100, 1, "%"));
      out.push(numberField("max_soc", "Max-SOC", car.max_soc, 10, 100, 1, "%"));
    } else if (d.role === "wallbox") {
      const car = d.car;
      out.push(sensorRow("power", "Leistung (lädt gerade)", "Zeigt live, wie viel die Wallbox zieht."));
      out.push(sensorRow("soc", "SoC des Autos (Ladezustand)", "Beispiel: sensor.auto_ladezustand – in Prozent."));
      out.push(numberField("capacity", "Batteriekapazität", car.capacity_kwh, 1, 300, 1, "kWh"));
      out.push(numberField("min_soc", "Mindest-SOC (Sicherheit)", car.min_soc, 0, 100, 1, "%"));
      out.push(numberField("max_soc", "Max-SOC (Ladestopp)", car.max_soc, 10, 100, 1, "%"));
      out.push(numberField("power_limit", "Max. Ladeleistung", d.limits.power_limit_w, 500, 22000, 100, "W"));
      out.push(numberField("min_on_power", "Mindest-Überschuss zum Laden", d.limits.min_on_power_w, 100, 11000, 100, "W"));
      out.push(toggleRow("grid_min", "Netz für Mindest-SOC", car.grid_min_allowed, "Erlaubt PVM, bei fast leerem Akku kurz Netzstrom zu nutzen."));
      out.push(toggleRow("grid_deadline", "Netz für Zeit-Ziele", car.grid_deadline_allowed, "Damit dein Auto bis zur Abfahrtszeit das Ziel schafft."));
    } else if (d.role === "waermepumpe") {
      const wp = d.wp;
      out.push(sensorRow("temp", "Temperatur-Sensor", "Vorlauf-/Speichertemperatur in °C."));
      out.push(sensorRow("power", "Leistung (im Betrieb)", "Für die Kalibrierung deiner Wärmepumpe."));
      out.push(numberField("est_power", "Geschätzte Heizleistung", wp.est_power_w, 500, 22000, 100, "W"));
      out.push(numberField("comfort", "Soll-Temperatur", wp.comfort_c, 40, 70, 0.5, "°C"));
      out.push(numberField("safety", "Notfall-Minimum", wp.safety_min_c, 20, 50, 1, "°C"));
      out.push(toggleRow("grid_fallback", "Netz im Notfall", wp.grid_fallback_allowed, "Unter dem Notfall-Minimum darf PVM kurz Netzstrom nutzen."));
    } else {
      out.push(sensorRow("power", "Leistung (im Betrieb)", "Optional – zeigt den Verbrauch live an."));
      out.push(numberField("nominal", "Leistung im Betrieb", d.limits.nominal_power_w, 50, 22000, 100, "W"));
    }
    out.push(`
      <div class="row" style="border-top:1px solid var(--line);padding-top:12px">
        <span class="lbl grow">Gerät aktiv (Automatik)<small>Ausgeschaltet lässt PVM das Gerät in Ruhe.</small></span>
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
      if (key === "enabled") d.enabled = on;
      else if (d.car) d.car[key] = on;
      else if (d.wp) d.wp[key] = on;
      return;
    }
    if (ev.target.closest("[data-close]")) { closeModal(); return; }
    if (ev.target.closest("[data-back]")) { navTo(dd.step - 1); return; }
    if (ev.target.closest("[data-next]")) {
      const name = $(overlay, "[data-el=dd-name]");
      if (name) d.name = name.value.trim();
      if (!d.name) { toast("Bitte vergib einen Namen für das Gerät.", "bad"); return; }
      navTo(dd.step + 1);
      return;
    }
    if (ev.target.closest("[data-save]")) {
      collectDialogFields(overlay, d);
      if (!validateDevice(d)) return;
      const devs = devicesOf();
      const idx = devs.findIndex((x) => x.id === d.id);
      if (idx >= 0) devs[idx] = d;
      else {
        d.id = d.id || ("dev" + Math.random().toString(36).slice(2, 8));
        devs.push(d);
      }
      toast("Speichere …");
      saveConfig()
        .then(() => {
          closeModal();
          toast("Gerät gespeichert – wird übernommen …", "ok");
          reloadAfterChange();
        })
        .catch((err) => toast("Speichern fehlgeschlagen: " + err, "bad"));
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
      else if (d.car && key === "grid_min") d.car.grid_min_allowed = v === "on";
      else if (d.wp && key === "grid_fallback") d.wp.grid_fallback_allowed = v === "on";
    });
    $$(overlay, "[data-field-toggle]").forEach((el) => {
      const key = el.getAttribute("data-field-toggle");
      const on = el.classList.contains("on");
      if (key === "enabled") d.enabled = on;
      else if (d.car && key in d.car) d.car[key] = on;
      else if (d.wp && key in d.wp) d.wp[key] = on;
    });
    $$(overlay, "[data-num]").forEach((r) => {
      const key = r.getAttribute("data-num");
      const v = parseFloat(r.value);
      if (isNaN(v)) return;
      const map = {
        capacity: ["car", "capacity_kwh"], min_soc: ["car", "min_soc"], max_soc: ["car", "max_soc"],
        est_power: ["wp", "est_power_w"], comfort: ["wp", "comfort_c"], safety: ["wp", "safety_min_c"],
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
        toast("Mindest-SOC muss kleiner als Max-SOC sein.", "bad");
        return false;
      }
      return true;
    }
    const c = d.control;
    if (c.type === "buttons") {
      if (!c.on_entity || !c.off_entity) {
        toast("Bei „Zwei Taster“ brauchst du einen Start- UND einen Stopp-Taster.", "bad");
        return false;
      }
      if (!d.sensors.power) {
        toast("Bei „Zwei Taster“ braucht PVM einen Leistungs-Sensor, um zu erkennen, ob das Gerät läuft.", "bad");
        return false;
      }
    } else if (c.type === "switch_number") {
      if (!c.switch_entity || !c.number_entity) {
        toast("Bitte wähle Schalter und Limit-Wert.", "bad");
        return false;
      }
    } else if (!c.switch_entity) {
      toast("Bitte wähle einen Schalter für dieses Gerät.", "bad");
      return false;
    }
    if (d.role === "wallbox" && d.car) {
      if (Number(d.car.min_soc) >= Number(d.car.max_soc)) {
        toast("Mindest-SOC muss kleiner als Max-SOC sein.", "bad");
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
      accBtn.parentElement.classList.toggle("open");
      return;
    }
    const modeEl = ev.target.closest("[data-mode]");
    if (modeEl) {
      $$(root, "[data-mode]").forEach((x) => x.classList.toggle("sel", x === modeEl));
      setMode(modeEl.getAttribute("data-mode"));
      return;
    }
    const themeEl = ev.target.closest("[data-theme-pick]");
    if (themeEl) {
      $$(root, "[data-theme-pick]").forEach((x) => x.classList.toggle("sel", x === themeEl));
      setTheme(themeEl.getAttribute("data-theme-pick"));
      return;
    }
    const actionEl = ev.target.closest("[data-action]");
    if (actionEl) {
      handleAction(root, actionEl);
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
      case "edit-device": {
        const d = deviceById(devId);
        if (d) openDeviceDialog(d);
        break;
      }
      case "del-device": {
        const d = deviceById(devId);
        if (!d) return;
        confirmModal("Gerät entfernen", "„" + (d.name || "") + "“ wird aus PVM entfernt. Das Gerät selbst bleibt in Home Assistant unverändert erhalten.", "Entfernen", () => {
          state.config.devices = devicesOf().filter((x) => x.id !== devId);
          saveConfig()
            .then(() => { toast("Gerät entfernt.", "ok"); reloadAfterChange(); })
            .catch((err) => toast("Fehler: " + err, "bad"));
        });
        break;
      }
      case "toggle-auto": {
        const d = deviceById(devId);
        const id = d && entOf(d.id).auto;
        if (!id) { toast("Automatik-Schalter nicht gefunden.", "bad"); return; }
        const next = !isOn(id);
        callSvc("switch", next ? "turn_on" : "turn_off", { entity_id: id })
          .then(() => { toast(next ? "Automatik an" : "Automatik aus", "ok"); })
          .catch(() => toast("Umschalten fehlgeschlagen", "bad"));
        break;
      }
      case "move-dev": {
        const dir = Number(el.getAttribute("data-dir"));
        const devs = devicesOf();
        const i = devs.findIndex((x) => x.id === devId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= devs.length) return;
        [devs[i], devs[j]] = [devs[j], devs[i]];
        saveConfig()
          .then(() => reloadAfterChange())
          .catch(() => toast("Speichern fehlgeschlagen", "bad"));
        break;
      }
      case "run-scan": {
        toast("Suche läuft …");
        const original = el.innerHTML;
        el.disabled = true;
        ws("pvm/scan")
          .then((res) => {
            state.scan = res || {};
            toast("Suche abgeschlossen.", "ok");
            if (state.view === "found") state.panel._nav("found");
          })
          .catch(() => toast("Suche fehlgeschlagen", "bad"))
          .finally(() => { el.disabled = false; el.innerHTML = original; });
        break;
      }
      case "adopt": {
        const idx = Number(el.getAttribute("data-idx"));
        const sets = (state.scan && state.scan.sets) || [];
        const found = sets[idx];
        if (!found) return;
        const fields = found.fields || {};
        if (["pv", "grid", "grid_import", "grid_export", "house"].includes(found.role)) {
          const eid = fields.entity;
          if (!eid) { toast("Keine passende Entität im Vorschlag.", "bad"); return; }
          state.config.energy[found.role + "_sensor"] = eid;
          saveConfig()
            .then(() => { toast("Sensor übernommen.", "ok"); reloadAfterChange(); })
            .catch((err) => toast("Fehler: " + err, "bad"));
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
            d.control.type = "switch_number";
            d.control.number_entity = fields.number_entity;
            if (!fields.on_entity && fields.switch_entity) d.control.switch_entity = fields.switch_entity;
          }
          if (fields.power_sensor) d.sensors.power = fields.power_sensor;
          if (fields.soc_sensor) d.sensors.soc = fields.soc_sensor;
          if (fields.temp_sensor) d.sensors.temp = fields.temp_sensor;
          openDeviceDialog(d);
        }
        break;
      }
      case "toggle-energy": {
        const key = el.getAttribute("data-energy");
        const row = $(root, '[data-energy-row="' + key + '"]');
        const on = el.classList.toggle("on");
        if (!on) state.config.energy[key + "_sensor"] = null;
        const pick = row && $(row, '[data-action="pick-energy"]');
        if (pick) pick.disabled = !on;
        break;
      }
      case "pick-energy": {
        const key = el.getAttribute("data-energy");
        openEntityPicker({
          title: "Sensor für " + ({ pv: "PV-Leistung", grid: "Netz (kombiniert)", grid_import: "Netzbezug", grid_export: "Einspeisung", house: "Hausverbrauch", battery_power: "Speicher-Leistung", battery_soc: "Speicher-SoC" }[key] || key),
          domains: ["sensor", "number", "input_number"],
        }, (entityId) => {
          state.config.energy[key + "_sensor"] = entityId;
          const lbl = $(root, '[data-el="ent-' + key + '"]');
          if (lbl) lbl.textContent = friendlyOf(entityId) + " (" + entityId + ")";
          toast("Sensor gewählt – jetzt unten speichern.", "ok");
        });
        break;
      }
      case "save-energy": {
        toast("Speichere …");
        saveConfig()
          .then(() => { toast("Energie-Sensoren gespeichert.", "ok"); reloadAfterChange(); })
          .catch((err) => toast("Fehler: " + err, "bad"));
        break;
      }
      case "self-test":
        callSvc("pvm", "run_self_test", {})
          .then(() => toast("Selbsttest gestartet – Ergebnis erscheint als Benachrichtigung.", "ok"))
          .catch(() => toast("Selbsttest fehlgeschlagen", "bad"));
        break;
      case "reload": window.location.reload(); break;
      default: break;
    }
  }

  /* input-/change-Delegation (Slider + Selects) */
  function onRootInput(root, ev) {
    const slider = ev.target.closest("[data-slider]");
    if (!slider) return;
    const key = slider.getAttribute("data-slider");
    const valEl = $(root, '[data-el="slider-' + key + '"]');
    if (valEl) valEl.textContent = fmtNum(parseFloat(slider.value), sliderUnit(key));
  }
  function onRootChange(root, ev) {
    const slider = ev.target.closest("[data-slider]");
    if (slider) {
      const key = slider.getAttribute("data-slider");
      const value = parseFloat(slider.value);
      setGlobalSetting(key, value);
      return;
    }
    const kind = ev.target.closest('[data-setting="grid_kind"]');
    if (kind) state.config.energy.grid_kind = kind.value;
  }

  const GLOBAL_ENTITY_KEYS = { reserve: "reserve", cycle: "cycle", min_on: "min_on", min_off: "min_off" };
  function setGlobalSetting(key, value) {
    const settings = state.config.settings;
    const cfgMap = {
      reserve: "reserve_w", cycle: "cycle_s", min_on: "min_on_s", min_off: "min_off_s",
      wp_test_target: "wp_test_target_c", wp_test_max: "wp_test_max_duration_min",
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
    const id = state.entities.theme;
    const label = L.themes[key];
    if (!id) return;
    const s = st(id);
    const option = matchOption(s, label);
    callSvc("select", "select_option", { entity_id: id, option: option || label })
      .then(() => {
        state.config.settings.ui_theme = key;
        applyTheme();
        toast("Design: „" + label + "“", "ok");
      })
      .catch(() => toast("Design konnte nicht gesetzt werden", "bad"));
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
      control: { type: "switch", switch_entity: null, on_entity: null, off_entity: null, number_entity: null, number_unit: "W", phases: 3 },
      sensors: { power: null, soc: null, temp: null },
      limits: { power_limit_w: 11000, min_on_power_w: 1400, min_on_s: 120, min_off_s: 60 },
      car: null, wp: null,
    };
    if (role === "wallbox" || role === "fahrzeug") {
      base.car = { capacity_kwh: 60, min_soc: 50, max_soc: 80, min_charge_power_w: 4000, grid_min_allowed: true, grid_deadline_allowed: true, manual_force: false, deadline_time: null, deadline_soc: 0 };
    } else if (role === "waermepumpe") {
      base.wp = { comfort_c: 60, safety_min_c: 40, est_power_w: 2000, grid_fallback_allowed: true, test_active: false };
    } else {
      base.limits.nominal_power_w = 2000;
    }
    return base;
  }
})();
