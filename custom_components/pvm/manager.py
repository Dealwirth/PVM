"""Zentrale Laufzeitverwaltung für PVM.

Der Manager hält die (normalisierte) Konfiguration im Speicher, führt den
Steuerzyklus aus (Engine + Ausführung der Service-Aufrufe) und versorgt die
Entitäten mit aktuellen Werten. Er überlebt einzelne Fehler und fährt nach
einer Fehlerserie automatisch in einen sicheren Zustand.
"""

from __future__ import annotations

import asyncio
import logging
import time as _time
import uuid
from collections import deque
from datetime import datetime
from typing import Any, Callable

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    EVENT_HOMEASSISTANT_STARTED,
    STATE_ON,
    STATE_UNAVAILABLE,
    STATE_UNKNOWN,
)
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from . import engine as eng
from . import forecast as fc
from .config_model import (
    compute_energy_flow,
    deadline_next_ts,
    energy_configured,
    find_device,
    normalize_config,
    setup_stage,
)
from .const import (
    CONTROL_BUTTONS,
    CONTROL_WP_TEMP,
    DOMAIN,
    GRID_KIND_NET,
    GRID_MODE_SEPARATE,
    MODE_AUTO,
    MODE_OFF,
    PHASE_VOLTAGE_V,
    REASON_LABELS,
    REASON_OFF_NO_SURPLUS,
    REASON_ON_SURPLUS,
    ROLE_FAHRZEUG,
    ROLE_VERBRAUCHER,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
    SETUP_LABELS,
    STALE_CONTROL_AFTER_S,
    STALE_SENSOR_AFTER_S,
    STALE_SOC_AFTER_S,
    STALE_TEMP_AFTER_S,
    WP_TEMP_MAX_C,
)
from .detector import (
    assign_cars_to_wallboxes,
    car_for_wallbox,
    match_power_soc,
    pair_by_plug_time,
    suggest_sets,
)
from .store import PvmStore

_LOGGER = logging.getLogger(__name__)

# Maximale Länge der Verlaufs-Puffer für die Korrelationsprüfung
BUFFER_MAX = 60
# Abstand zwischen zwei manuell angestoßenen Zyklen (Entprellung)
MIN_CYCLE_GAP_S = 3.0
# Ab Leistung über dieser Schwelle gilt eine Wallbox/Verbraucher als „an“
# (wichtig bei der Steuerung über zwei Taster ohne Schalterzustand)
CHARGE_ON_W = 60.0
# Nach einem Stopp-Befehl wird nicht sofort erneut gestoppt
MIN_STOP_GAP_S = 30.0


class PvmManager:
    """Verwaltet Konfiguration, Zyklus und Geräte einer PVM-Instanz."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        # Einzigartige Instanz-Kennung: Nach einem Reload (z. B. wenn neue
        # Geräte Entitäten bekommen) entsteht eine neue Instanz – die Seite
        # erkennt daran zuverlässig, dass der Reload abgeschlossen ist.
        self.instance_id = uuid.uuid4().hex[:10]
        self._store = PvmStore(hass)
        self.config: dict[str, Any] = {}
        self._loop_task: asyncio.Task | None = None
        self._save_task: asyncio.Task | None = None
        self._extra_cycle: asyncio.Task | None = None
        self._scan_lock = False
        # PV-Prognose (Open-Meteo + lokales Modell)
        self._forecast_task: asyncio.Task | None = None
        self._forecast_lock = False
        self.forecast_data: dict[str, Any] | None = None
        self.forecast_recovery_min: int | None = None
        self._last_forecast_refresh = 0.0
        self._hist_pv: deque = deque(maxlen=2000)   # (ts, pv_w) für lokales Modell
        self._hist_house: deque = deque(maxlen=1000)  # (ts, w)
        self._pv_derate: float | None = None
        self._closing = False
        self._last_extra_cycle = 0.0

        # Entitäten, die über Zyklus-Updates benachrichtigt werden
        self._listeners: list[Callable[[], None]] = []

        # Laufzeit-Zustand
        self.surplus_w = 0.0
        self.surplus_valid = False
        self.export_raw_w = 0.0
        self.grid_w = 0.0
        self.pv_w: float | None = None
        self.house_w: float | None = None
        self.battery_w: float | None = None
        self.battery_soc: float | None = None
        self.last_cycle_ts: float | None = None
        self.last_error: str | None = None
        self.consecutive_errors = 0
        self.engine_notes: list[str] = []
        self.device_state: dict[str, dict[str, Any]] = {}
        self.last_scan: dict[str, Any] = {}

        # Automatische Zuordnung Auto -> Wallbox (jeder Zyklus neu)
        self.car_assignments: dict[str, str] = {}  # car_id -> wallbox_id
        self.car_status: dict[str, str] = {}       # car_id -> Status-Text
        # Einsteck-Erkennung: Leistung pro Gerät + Zeitpunkt des Ladestarts.
        # Daraus lernt PVM, welches Auto an welcher Wallbox hängt, und
        # speichert die Zuordnung dauerhaft (car.home_wallbox).
        self._last_charge: dict[str, float] = {}   # dev_id -> letzte Leistung
        self._plug_ts: dict[str, float] = {}       # dev_id -> Einsteck-Zeitpunkt
        self._plug_pairs: dict[str, str] = {}      # car_id -> wallbox_id (frisch)

        # Zuletzt angewandte Aktionen (verhindert doppelte Service-Aufrufe)
        self._applied: dict[str, dict[str, Any]] = {}
        self._on_timers: dict[str, float] = {}
        self._off_timers: dict[str, float] = {}
        self._last_stop_press: dict[str, float] = {}

        # Zuletzt gesetzte Ziel-Temperatur pro WP-Temperatur-Gerät (Hysterese)
        self._temp_targets: dict[str, float] = {}

        # Verlaufs-Puffer für Korrelation (power/soc)
        self._power_buf: dict[str, deque] = {}
        self._soc_buf: dict[str, deque] = {}

        self._started_event_bound = False
        self._auto_scan_done = False

    @property
    def closing(self) -> bool:
        """Wird PVM gerade heruntergefahren?"""
        return self._closing

    # ------------------------------------------------------------------
    # Lebenszyklus
    # ------------------------------------------------------------------
    @classmethod
    async def async_create(cls, hass: HomeAssistant, entry: ConfigEntry) -> PvmManager:
        """Erstellt einen Manager und lädt die Konfiguration."""
        manager = cls(hass, entry)
        manager.config = await manager._store.async_load()
        return manager

    async def async_start(self) -> None:
        """Startet den Steuerzyklus (nach HA-Start, sonst wartet er)."""
        if self.hass.is_running:
            self._loop_task = self.hass.async_create_task(
                self._run_loop(), name=f"{DOMAIN}_cycle_{self.entry.entry_id}"
            )
            self._listen_once_started()
            self._schedule_initial_scan()
        else:
            self._listen_once_started()

    def _schedule_initial_scan(self) -> None:
        """Scannt beim Start einmal automatisch (nur bei frischer Installation).

        Sobald Geräte konfiguriert sind, gibt es keine automatischen Scans
        mehr (keine störenden Benachrichtigungen nach Reloads/Neustarts).
        """
        if self._auto_scan_done:
            return
        self._auto_scan_done = True
        if self.config.get("devices"):
            return

        async def _scan_later() -> None:
            await asyncio.sleep(5.0)
            if self._closing:
                return
            try:
                await self.scan_devices(notify=False)
            except Exception:  # noqa: BLE001
                _LOGGER.debug("PVM: automatischer Scan fehlgeschlagen", exc_info=True)

        self.hass.async_create_task(_scan_later(), name=f"{DOMAIN}_initial_scan")

    def _listen_once_started(self) -> None:
        """Startet den Zyklus, sobald HA vollständig läuft."""
        if self._started_event_bound:
            return
        self._started_event_bound = True

        async def _on_started(_event) -> None:
            if self._loop_task is None and not self._closing:
                self._loop_task = self.hass.async_create_task(
                    self._run_loop(), name=f"{DOMAIN}_cycle_{self.entry.entry_id}"
                )
                await self.run_cycle()
            if not self._auto_scan_done:
                self._schedule_initial_scan()

        self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _on_started)

    async def async_delete_storage(self) -> None:
        """Löscht die gespeicherte Konfiguration dauerhaft (beim Entfernen)."""
        await self._store.async_delete()

    async def async_stop(self) -> None:
        """Stoppt alle Tasks und speichert den Zustand."""
        self._closing = True
        for task in (
            self._loop_task,
            self._extra_cycle,
            self._save_task,
            self._forecast_task,
        ):
            if task and not task.done():
                task.cancel()
        self._forecast_task = None
        await self._store.async_save(self.config)

    def subscribe(self, callback: Callable[[], None]) -> Callable[[], None]:
        """Registriert einen Update-Listener (Entität) und liefert Abmelden."""
        self._listeners.append(callback)

        def unsubscribe() -> None:
            if callback in self._listeners:
                self._listeners.remove(callback)

        return unsubscribe

    def _broadcast(self) -> None:
        for listener in list(self._listeners):
            try:
                listener()
            except Exception:  # noqa: BLE001 - einzelne Listener dürfen nie stören
                _LOGGER.exception("Listener-Fehler in PVM")

    # ------------------------------------------------------------------
    # Steuerzyklus
    # ------------------------------------------------------------------
    async def _run_loop(self) -> None:
        interval = float(self.config["settings"].get("cycle_s", 30))
        while not self._closing:
            try:
                await asyncio.wait_for(self.run_cycle(), timeout=25)
            except TimeoutError:
                _LOGGER.error("PVM-Zyklus hat das Zeitlimit überschritten")
            except asyncio.CancelledError:
                break
            except Exception:  # noqa: BLE001
                self.consecutive_errors += 1
                _LOGGER.exception(
                    "PVM-Zyklusfehler (%d. in Folge)", self.consecutive_errors
                )
                if self.consecutive_errors >= 3:
                    _LOGGER.error("PVM: Mehrere Fehler – Pause zur Stabilisierung")
                    await asyncio.sleep(60)
                    self.consecutive_errors = 0
            interval = float(self.config["settings"].get("cycle_s", 30))
            await asyncio.sleep(max(5.0, interval) + self._jitter())

    @staticmethod
    def _jitter() -> float:
        """Kleine zufällige Streuung, damit nicht alle HA-Instanzen takten."""
        import random

        return random.uniform(-2.0, 2.0)

    def request_cycle(self) -> None:
        """Stößt einen zusätzlichen Zyklus an (nach Benutzeränderungen)."""
        now = _time.monotonic()
        if now - self._last_extra_cycle < MIN_CYCLE_GAP_S:
            return
        self._last_extra_cycle = now
        if self._extra_cycle and not self._extra_cycle.done():
            return
        self._extra_cycle = self.hass.async_create_task(
            self.run_cycle(), name=f"{DOMAIN}_extra_cycle"
        )

    async def run_cycle(self) -> None:
        """Führt einen vollständigen Steuerzyklus aus (Engine + Ausführung)."""
        if self._closing:
            return
        try:
            await self._run_cycle_inner()
            self.consecutive_errors = 0
        except Exception as err:  # noqa: BLE001
            self.consecutive_errors += 1
            self.last_error = f"{type(err).__name__}: {err}"
            _LOGGER.exception("PVM-Zyklusfehler: %s", err)
        finally:
            self.last_cycle_ts = _time.time()
            self._update_car_state()
            self._broadcast()

    async def _run_cycle_inner(self) -> None:
        # Nur im "Auto/…"-Modus sinnvoll; Status immer aktualisieren.
        mode = self.config["settings"].get("mode", MODE_AUTO)
        if mode == MODE_OFF:
            return

        inp = await self._build_cycle_input()
        # Manueller Modus: PVM misst weiter (Überschuss bleibt aktuell), steuert
        # aber nichts – weder Schalter noch Temperatur-Ziele.
        if bool(self.config["settings"].get("manual_mode")):
            return

        plan = eng.compute_plan(inp)
        await self._apply_plan(plan)
        await self._apply_temp_controls()
        self._store_samples()

    # ------------------------------------------------------------------
    # Eingaben für die Engine
    # ------------------------------------------------------------------
    async def _build_cycle_input(self) -> eng.CycleInput:
        mode = self.config["settings"].get("mode", MODE_AUTO)
        export, export_valid, grid_w, pv, house = self._read_energy()
        self.export_raw_w = export
        self.surplus_valid = export_valid
        reserve = float(self.config["settings"].get("reserve_w", 0))
        self.surplus_w = max(0.0, export - reserve) if export_valid else 0.0
        self.grid_w = grid_w
        self.pv_w = pv
        self.house_w = house

        devices = await self._build_engine_devices()
        recovery = None
        if self.forecast_data is not None:
            recovery = self.forecast_data.get("recovery_min")
            if recovery is not None:
                self.forecast_recovery_min = int(recovery)
            else:
                self.forecast_recovery_min = None
        return eng.CycleInput(
            now=_time.time(),
            mode=mode,
            surplus_w=self.surplus_w,
            surplus_valid=export_valid,
            devices=devices,
            forecast_recovery_min=self.forecast_recovery_min,
        )

    def _read_energy(self) -> tuple[float, bool, float, float | None, float | None]:
        """Liest die Energie-Sensoren und berechnet den Export.

        Unterstützt: getrennte Bezug-/Einspeisung-Sensoren, kombinierten
        Netz-Sensor sowie PV minus Hausverbrauch; dazu optionale
        Speicher-Werte. Liefert (export_w, gültig, netz_w, pv_w, haus_w).
        """
        energy = self.config.get("energy", {})
        pv, pv_valid = self.read_power(energy.get("pv_sensor"))
        house, house_valid = self.read_power(energy.get("house_sensor"))
        grid, grid_valid = self.read_power(energy.get("grid_sensor"))
        grid_import, import_valid = self.read_power(energy.get("grid_import_sensor"))
        grid_export, export_valid = self.read_power(energy.get("grid_export_sensor"))

        # Speicher (optional) – nur für Anzeige/Diagnose
        self.battery_w, _bvalid = self.read_power(energy.get("battery_power_sensor"))
        self.battery_soc, _bsvalid = self.read_number(
            energy.get("battery_soc_sensor"), stale_s=STALE_SOC_AFTER_S
        )

        export, valid, net = compute_energy_flow(
            pv=pv,
            pv_valid=pv_valid,
            grid=grid,
            grid_valid=grid_valid,
            grid_import=grid_import,
            import_valid=import_valid,
            grid_export=grid_export,
            export_valid=export_valid,
            house=house,
            house_valid=house_valid,
            grid_mode=energy.get("grid_mode"),
            grid_kind=energy.get("grid_kind", GRID_KIND_NET),
        )
        return export, valid, net, pv, house

    async def _build_engine_devices(self) -> list[eng.Device]:
        devices = []
        mode = self.config["settings"].get("mode", MODE_AUTO)
        now_local = dt_util.as_local(dt_util.utcnow())
        priority = 1
        for device in self.config.get("devices", []):
            if device.get("role") == ROLE_FAHRZEUG:
                # Autos sind reine Überwachung – keine Steuerung durch die
                # Engine und keine Prioritäts-Position (Pfeile im Dashboard
                # verschieben nur steuerbare Geräte).
                continue
            if (device.get("control") or {}).get("type") == CONTROL_WP_TEMP:
                # Temperatur-Ziel-Wärmepumpe: kein Ein/Aus-Schalten – die
                # Ziel-Temperatur wird separat gesetzt (_apply_temp_controls).
                continue
            try:
                devices.append(
                    self._device_to_engine(device, priority, mode, now_local)
                )
                priority += 1
            except Exception:  # noqa: BLE001
                _LOGGER.exception(
                    "PVM: Gerät %s kann nicht ausgewertet werden", device.get("name")
                )
        return devices

    def _device_to_engine(
        self, device: dict, priority: int, mode: str, now_local: datetime
    ) -> eng.Device:
        device_id = device["id"]
        control = device.get("control", {})
        sensors = device.get("sensors", {})
        limits = device.get("limits", {})

        settings = self.config.get("settings", {})
        measured, _valid = self.read_power(sensors.get("power"))
        on = self._control_is_on(device_id, device.get("control", {}), measured)
        # Leistungs-Begrenzung: eigenes „hat eine Begrenzung“-Flag (neues
        # Modell) bzw. die alte Schalter+Limit-Steuerung (Legacy).
        has_setpoint = bool(control.get("has_limiter")) or control.get("type") == "switch_number"

        engine_device = eng.Device(
            id=device_id,
            role=device.get("role", ROLE_VERBRAUCHER),
            priority=priority,
            state_on=on,
            has_power_setpoint=has_setpoint,
            power_limit_w=float(limits.get("power_limit_w", 11000)),
            min_on_power_w=float(limits.get("min_on_power_w", 1400)),
            nominal_power_w=float(
                limits.get("nominal_power_w")
                or limits.get("power_limit_w")
                or 0
            ),
            measured_power_w=measured,
            min_on_s=float(settings.get("min_on_s") or limits.get("min_on_s", 120)),
            min_off_s=float(settings.get("min_off_s") or limits.get("min_off_s", 60)),
            last_on_ts=self._on_timers.get(device_id),
            last_off_ts=self._off_timers.get(device_id),
            enabled=bool(device.get("enabled", True)),
        )
        # Kalender-Zeitfenster für Verbraucher („nur in diesem Zeitraum laufen“)
        if device.get("role") == ROLE_VERBRAUCHER:
            has, active, grid = self._schedule_window_state(device)
            engine_device.scheduled_window = has
            engine_device.schedule_on = active
            engine_device.schedule_grid = grid
            engine_device.schedule_power_w = float(
                limits.get("nominal_power_w") or limits.get("power_limit_w") or 0
            )

        role = device.get("role")
        if role == ROLE_WALLBOX:
            # Auto & Wallbox sind getrennt bedienbar, koppeln sich aber
            # automatisch: Für die Lade-Entscheidung zählen die Ziele des
            # zugeordneten Autos (SoC-Grenzen, Zeit-Ziele, Power Charge) –
            # nicht die der Wallbox. Fallback für Alt-Konfigurationen ohne
            # Auto-Gerät: die bisherigen Wallbox-Werte.
            assigned = car_for_wallbox(
                self.config,
                device_id,
                self.car_assignments,
                wallbox_charging=bool(measured is not None and measured >= CHARGE_ON_W),
            )
            car_source = assigned if assigned is not None else device
            if car_source.get("car"):
                # Nur mit SoC-Quelle an die Engine geben (Auto-Sensor oder
                # eigener SoC-Sensor der Wallbox): Ohne SoC-Signal wüsste die
                # Engine weder, ob geladen werden darf, noch wann das Ziel
                # erreicht ist – die Wallbox würde **nie** starten. In dem
                # Fall fällt sie auf reines Überschuss-Laden wie ein
                # Verbraucher zurück (bis die Wallbox selbst abschaltet).
                has_soc_source = bool(
                    (car_source.get("sensors") or {}).get("soc")
                    or sensors.get("soc")
                )
                if has_soc_source:
                    engine_device.car = self._car_to_engine(
                        car_source,
                        car_source["car"],
                        now_local,
                        soc_fallback_sensor=sensors.get("soc"),
                        # Power Charge an der Wallbox (Entität/Schalter) soll
                        # auch bei zugeordnetem Auto weiter funktionieren.
                        extra_manual_force=bool(
                            (device.get("car") or {}).get("manual_force")
                        ),
                    )
            # „Vorausschauendes Laden“ (Einstellung): Hat das zugeordnete Auto
            # heute eine Frist (Ziel bis Uhrzeit), hält die Engine die Wallbox
            # über kurze Wolkenphasen, statt abzuschalten – die Sonne kommt
            # laut Prognose gleich wieder. Ohne aktive Frist fahren Wallboxen
            # live herunter (kein unnötiger Netzbezug durch Halten).
            car_cfg = car_source.get("car") if car_source is not None else None
            if (
                engine_device.car is not None
                and car_cfg
                and bool(settings.get("pre_charge", True))
                and float(car_cfg.get("deadline_soc") or 0) > 0
                and bool(car_cfg.get("deadline_time"))
            ):
                engine_device.hold_short_dip = True
        if role == ROLE_WAERMEPUMPE and device.get("wp"):
            engine_device.wp = self._wp_to_engine(device, device["wp"])
        return engine_device

    def _local_ts(self, raw: Any) -> float | None:
        """Wandelt eine lokale Zeitangabe (ISO, ohne tz) in epoch um."""
        if not raw:
            return None
        try:
            dt = dt_util.parse_datetime(str(raw))
            if dt is None:
                dt = datetime.fromisoformat(str(raw))
        except (TypeError, ValueError):
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=dt_util.DEFAULT_TIME_ZONE)
        return dt.timestamp()

    def _schedule_window_state(self, device: dict) -> tuple[bool, bool, bool]:
        """Liefert (hat-Fenster, gerade-aktiv, netz-erlaubt) für Verbraucher."""
        entries = device.get("schedule") or []
        has = False
        active = False
        grid = False
        now = _time.time()
        for entry in entries:
            start = self._local_ts(entry.get("start"))
            end = self._local_ts(entry.get("end"))
            if start is None and end is None:
                continue
            has = True
            start_ok = start is None or now >= start
            end_ok = end is None or now < end
            if start_ok and end_ok:
                active = True
                if bool(entry.get("grid")):
                    grid = True
        return has, active, grid

    def _next_calendar_deadline(
        self, device: dict, now_local: datetime, soc_pct: float | None
    ) -> tuple[float | None, float | None, bool | None]:
        """Nächster Kalender-Termin mit Ziel-SoC (Autos)."""
        best: tuple[float, float, bool] | None = None
        for entry in device.get("schedule") or []:
            end = self._local_ts(entry.get("end") or entry.get("start"))
            target = entry.get("target")
            if end is None or not target:
                continue
            try:
                target = float(target)
            except (TypeError, ValueError):
                continue
            if target <= 0 or target > 100:
                continue
            if end <= _time.time():
                continue  # Termin in der Vergangenheit
            if soc_pct is not None and target <= soc_pct + 0.5:
                continue  # Ziel bereits erreicht
            grid_allowed = bool(entry.get("grid", True))
            if best is None or end < best[0]:
                best = (end, target, grid_allowed)
        if best is None:
            return None, None, None
        return best[0], best[1], best[2]

    def _car_to_engine(
        self,
        device: dict,
        car: dict,
        now_local: datetime,
        soc_fallback_sensor: str | None = None,
        extra_manual_force: bool = False,
    ) -> eng.CarInfo:
        sensors = device.get("sensors", {})
        soc, soc_valid = self.read_number(
            sensors.get("soc"), stale_s=STALE_SOC_AFTER_S
        )
        # Fallback: hat das Auto keinen eigenen SoC-Sensor (Alt-Konfiguration),
        # wird der SoC-Sensor der Wallbox mitverwendet.
        if (soc is None or not soc_valid) and soc_fallback_sensor:
            soc, soc_valid = self.read_number(
                soc_fallback_sensor, stale_s=STALE_SOC_AFTER_S
            )
        deadline_ts = None
        deadline_soc = None
        grid_deadline = bool(car.get("grid_deadline_allowed", True))
        if car.get("deadline_soc") and car.get("deadline_time"):
            if car["deadline_soc"] > 0:
                deadline_ts = deadline_next_ts(now_local, car.get("deadline_time"))
                deadline_soc = float(car["deadline_soc"])
        # Kalender-Termin (einmalig, mit Datum): nimmt dem Tages-Ziel den
        # Vortritt, wenn er näher liegt und noch nicht erreicht ist.
        cal_ts, cal_soc, cal_grid = self._next_calendar_deadline(
            device, now_local, soc
        )
        if cal_ts is not None:
            if deadline_ts is None or cal_ts < deadline_ts:
                deadline_ts = cal_ts
                deadline_soc = cal_soc
                grid_deadline = bool(cal_grid)
        return eng.CarInfo(
            soc_pct=soc,
            soc_valid=soc_valid,
            capacity_kwh=float(car.get("capacity_kwh", 60)),
            min_soc=float(car.get("min_soc", 50)),
            max_soc=float(car.get("max_soc", 80)),
            min_charge_power_w=float(car.get("min_charge_power_w", 4000)),
            grid_min_allowed=bool(car.get("grid_min_allowed", True)),
            grid_deadline_allowed=grid_deadline,
            manual_force=bool(car.get("manual_force", False)) or extra_manual_force,
            deadline_ts=deadline_ts,
            deadline_soc=deadline_soc,
        )

    def _wp_to_engine(self, device: dict, wp: dict) -> eng.WpInfo:
        sensors = device.get("sensors", {})
        temp, temp_valid = self.read_number(
            sensors.get("temp"), stale_s=STALE_TEMP_AFTER_S
        )
        return eng.WpInfo(
            temp_c=temp,
            temp_valid=temp_valid,
            comfort_c=float(wp.get("comfort_c", 60)),
            safety_min_c=float(wp.get("safety_min_c", 60)),
            est_power_w=float(wp.get("est_power_w", 2000)),
            grid_fallback_allowed=bool(wp.get("grid_fallback_allowed", True)),
        )

    # ------------------------------------------------------------------
    # Ausführung der Engine-Entscheidungen
    # ------------------------------------------------------------------
    async def _apply_plan(self, plan: eng.CyclePlan) -> None:
        changed_anything = False
        for device in self.config.get("devices", []):
            device_id = device["id"]
            action = next((a for a in plan.actions if a.id == device_id), None)
            if action is None:
                continue
            status = self._describe_action(device, action)
            self.device_state[device_id] = status
            executed = await self._execute_action(device, action)
            changed_anything = changed_anything or executed
            if action.clear_manual and device.get("car"):
                car = device["car"]
                if car.get("manual_force"):
                    car["manual_force"] = False
                    self.schedule_save()
            self._update_timer(device, action)
        self.engine_notes = plan.notes
        if changed_anything:
            self.schedule_save()

    # ------------------------------------------------------------------
    # Temperatur-Ziel-Wärmepumpe („Nur Ziel-Temperatur, kein Ein/Aus“)
    # ------------------------------------------------------------------
    async def _apply_temp_controls(self) -> None:
        """Hebt die Ziel-Temperatur von Wärmepumpen bei Überschuss an.

        Geräte mit Steuerungsart „wp_temp“ lassen sich nicht an-/ausschalten –
        PVM stellt stattdessen die gewünschte Speichertemperatur ein:
        bei genügend Überschuss die Boost-Temperatur, sonst die normale
        Soll-Temperatur. Mit Hysterese, damit es nicht hin- und herspringt.
        """
        hysteresis_w = 250.0
        for device in self.config.get("devices", []):
            control = device.get("control", {})
            if control.get("type") != CONTROL_WP_TEMP:
                continue
            if not device.get("enabled", True):
                continue
            device_id = device["id"]
            wp = device.get("wp") or {}
            temp_entity = control.get("temp_entity")
            if not temp_entity:
                continue
            min_on_w = float(device.get("limits", {}).get("min_on_power_w", 1400))
            boost_c = float(wp.get("boost_c", wp.get("comfort_c", 60) + 5))
            normal_c = float(wp.get("comfort_c", 60))

            surplus_ok = self.surplus_valid and self.surplus_w >= min_on_w
            last = self._temp_targets.get(device_id)
            if surplus_ok:
                target = boost_c
            elif last is not None and last > normal_c and self.surplus_w >= min_on_w - hysteresis_w:
                # Wird mit knappem Überschuss gehalten, statt zu pendeln.
                target = last
            else:
                target = normal_c

            # Kalender-Termin (z. B. „Sonntag 12 Uhr 65 °C für den Badetag“):
            # solange das Zeitfenster läuft, wird die Ziel-Temperatur angehoben
            # (mit Netz-Freigabe auch ohne Überschuss).
            now = _time.time()
            for entry in device.get("schedule") or []:
                entry_target = entry.get("target")
                if not entry_target:
                    continue
                try:
                    entry_target = float(entry_target)
                except (TypeError, ValueError):
                    continue
                start = self._local_ts(entry.get("start") or entry.get("end"))
                end = self._local_ts(entry.get("end"))
                if start is None or end is None or start > now or now >= end:
                    continue
                if entry_target <= 45.0:
                    continue
                if bool(entry.get("grid")) or surplus_ok:
                    target = max(target, min(entry_target, WP_TEMP_MAX_C))

            current, valid = self.read_number(temp_entity, stale_s=STALE_CONTROL_AFTER_S)
            if (current is None or not valid) and target == normal_c and last is None:
                # Noch nie gesetzt und gerade kein Überschuss – nicht antasten.
                self._temp_targets[device_id] = target
                self._set_temp_status(device_id, device, False, normal_c)
                continue
            if current is None or abs(current - target) > 0.4:
                await self._call_service(
                    "number", "set_value", temp_entity, value=round(target, 1)
                )
            self._temp_targets[device_id] = target
            self._set_temp_status(
                device_id,
                device,
                surplus_ok and target >= boost_c - 0.1,
                target,
            )

    def _set_temp_status(
        self, device_id: str, device: dict, boosted: bool, target: float
    ) -> None:
        """Status-Sensor einer Temperatur-WP beschreiben (an/aus + Ziel)."""
        reason = REASON_ON_SURPLUS if boosted else REASON_OFF_NO_SURPLUS
        self.device_state[device_id] = {
            "name": device.get("name", ""),
            "target": "an" if boosted else "aus",
            "reason": reason,
            "reason_label": REASON_LABELS.get(reason, reason),
            "power_w": None,
            "temp_target": target,
            "ts": _time.time(),
        }

    def _describe_action(self, device: dict, action: eng.DeviceAction) -> dict[str, Any]:
        reason = action.reason
        target = (
            "an"
            if action.set_on is True
            else "aus" if action.set_on is False else "halten"
        )
        return {
            "name": device.get("name", ""),
            "target": target,
            "reason": reason,
            "reason_label": REASON_LABELS.get(reason, reason),
            "power_w": action.set_power_w,
            "ts": _time.time(),
        }

    async def _execute_action(self, device: dict, action: eng.DeviceAction) -> bool:
        """Führt eine Aktion aus und meldet, ob sich etwas geändert hat.

        Reihenfolge: Beim Einschalten zuerst den Sollwert setzen (damit nicht
        kurz mit voller Leistung gestartet wird), dann den Schalter bedienen.
        Beim Ausschalten reicht der Schalter.
        """
        control = device.get("control", {})
        switch_entity = control.get("switch_entity")
        number_entity = control.get("number_entity")
        device_id = device["id"]
        applied = self._applied.get(device_id, {})
        now = _time.time()

        if action.set_on is None:
            return False  # „Halten“ – nichts tun

        # --- Zwei Taster (Start/Stopp) -------------------------------------
        if control.get("type") == CONTROL_BUTTONS:
            return await self._execute_buttons(device, action, now)

        changed = False

        # 1) Sollwert zuerst, wenn eingeschaltet wird
        if (
            action.set_on is True
            and action.set_power_w is not None
            and number_entity
        ):
            target_value = self._power_to_entity_value(control, action.set_power_w)
            prev = applied.get("power_value")
            if prev is None or abs(prev - target_value) > self._value_tolerance(
                control
            ):
                await self._call_service(
                    "number", "set_value", number_entity, value=target_value
                )
                changed = True
            self._applied[device_id] = {
                **self._applied.get(device_id, {}),
                "on": True,
                "power_value": target_value,
                "ts": now,
            }

        # 2) Schalter bedienen
        if switch_entity:
            current_on = self._is_on(switch_entity, device_id)
            if action.set_on != current_on:
                service = "turn_on" if action.set_on else "turn_off"
                await self._call_service("switch", service, switch_entity)
                self._applied[device_id] = {"on": action.set_on, "ts": now}
                changed = True

        # Ohne Schalter-Entität: Ausschalten über Zustandsabbild
        if not switch_entity and action.set_on is False and applied.get("on"):
            self._applied[device_id] = {"on": False, "ts": now}
            changed = True

        return changed

    async def _execute_buttons(
        self, device: dict, action: eng.DeviceAction, now: float
    ) -> bool:
        """Start/Stopp-Taster bedienen – nur bei echtem Zustandswechsel."""
        control = device.get("control", {})
        device_id = device["id"]
        sensors = device.get("sensors", {})
        measured, _valid = self.read_power(sensors.get("power"))
        is_on = self._control_is_on(device_id, control, measured)
        changed = False

        if action.set_on is True:
            if not is_on:
                on_entity = control.get("on_entity")
                if on_entity:
                    await self._press_entity(on_entity, want_on=True)
                    changed = True
            self._applied[device_id] = {"on": True, "ts": now}
        elif action.set_on is False:
            # Nicht sofort erneut stoppen (Ladeleistung kann nachhängen)
            if (
                is_on
                and control.get("off_entity")
                and now - self._last_stop_press.get(device_id, 0.0) >= MIN_STOP_GAP_S
            ):
                await self._press_entity(control["off_entity"], want_on=False)
                self._last_stop_press[device_id] = now
                changed = True
            self._applied[device_id] = {"on": False, "ts": now}
        return changed

    async def _press_entity(self, entity_id: str, want_on: bool) -> None:
        """Drückt einen Taster: button.press bzw. switch.turn_on/turn_off."""
        if self.hass.states.get(entity_id) is None:
            _LOGGER.warning("PVM: Taster-Entität %s existiert nicht", entity_id)
            return
        domain = entity_id.split(".", 1)[0]
        if domain == "button":
            await self._call_service("button", "press", entity_id)
        elif want_on:
            await self._call_service(domain, "turn_on", entity_id)
        else:
            await self._call_service(domain, "turn_off", entity_id)

    def _is_on(self, switch_entity: str | None, device_id: str) -> bool:
        if not switch_entity:
            return bool(self._applied.get(device_id, {}).get("on"))
        state = self.hass.states.get(switch_entity)
        if state and state.state in (STATE_ON, "on"):
            return True
        applied = self._applied.get(device_id, {})
        if applied.get("on") and _time.time() - applied.get("ts", 0) < 30:
            return True
        return False

    def _applied_on_recent(self, device_id: str, window_s: float = 30.0) -> bool:
        """Hat PVM kürzlich selbst „an“ gesetzt? (HA-Zustand kann nachhinken)"""
        applied = self._applied.get(device_id, {})
        return bool(
            applied.get("on") and _time.time() - applied.get("ts", 0) < window_s
        )

    def _control_is_on(
        self,
        device_id: str,
        control: dict,
        measured_power: float | None = None,
    ) -> bool:
        """Ist das Gerät aus Sicht von PVM gerade eingeschaltet?

        - Ein-Schalter: Zustand der Schalter-Entität (mit Nachlauf-Gnade)
        - Zwei Taster: echte Ladeleistung (Schwelle) bzw. letzter Start-Befehl
        """
        if control.get("type") == CONTROL_BUTTONS:
            # Kurz nach eigenem Befehl gilt das Gerät als an (Nachlauf-Gnade),
            # danach zählt die echte Leistung.
            if self._applied_on_recent(device_id):
                return True
            if measured_power is not None:
                return measured_power >= CHARGE_ON_W
            return False
        switch_entity = control.get("switch_entity")
        if switch_entity:
            state = self.hass.states.get(switch_entity)
            if state and state.state == STATE_ON:
                return True
            if state and state.state not in (STATE_ON, STATE_UNKNOWN, STATE_UNAVAILABLE):
                return False
        return self._applied_on_recent(device_id)

    def _power_to_entity_value(self, control: dict, watts: float) -> float:
        """Rechnet Watt in den Wert der Nummern-Entität um."""
        unit = control.get("number_unit", "W")
        phases = int(control.get("phases", 3))
        if unit == "W":
            return round(float(watts))
        if unit == "kW":
            return round(float(watts) / 1000.0, 3)
        if unit == "A":
            return round(float(watts) / (PHASE_VOLTAGE_V * phases), 1)
        if unit == "mA":
            return round(float(watts) / (PHASE_VOLTAGE_V * phases) * 1000.0)
        return round(float(watts))

    def _value_tolerance(self, control: dict) -> float:
        unit = control.get("number_unit", "W")
        return {  # kleine Änderungen nicht sofort senden
            "W": 100.0,
            "kW": 0.1,
            "A": 0.2,
            "mA": 200.0,
        }.get(unit, 0.0)

    def _update_timer(self, device: dict, action: eng.DeviceAction) -> None:
        """Pflegt die Ein-/Aus-Zeitstempel für die Antiflacker-Logik."""
        device_id = device["id"]
        if action.set_on is True:
            self._on_timers[device_id] = _time.time()
        elif action.set_on is False:
            self._off_timers[device_id] = _time.time()
            self._applied.pop(device_id, None)

    async def _call_service(
        self, domain: str, service: str, entity_id: str, **data: Any
    ) -> None:
        """Führt einen Service-Aufruf aus – fehlertolerant und mit Timeout."""
        if self.hass.states.get(entity_id) is None:
            _LOGGER.warning(
                "PVM: Entität %s existiert nicht (Gerät übersprungen)", entity_id
            )
            return
        try:
            await asyncio.wait_for(
                self.hass.services.async_call(
                    domain,
                    service,
                    {"entity_id": entity_id, **data},
                    blocking=True,
                ),
                timeout=8,
            )
        except TimeoutError:
            _LOGGER.warning("PVM: Service %s.%s für %s dauerte zu lange", domain, service, entity_id)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning(
                "PVM: Service %s.%s für %s fehlgeschlagen: %s",
                domain,
                service,
                entity_id,
                err,
            )

    # ------------------------------------------------------------------
    # Persistenz
    # ------------------------------------------------------------------
    def schedule_save(self) -> None:
        """Speichert die Konfiguration zeitversetzt (entprellt)."""
        if self._save_task and not self._save_task.done():
            return
        self._save_task = self.hass.async_create_task(self._save_later())

    async def _save_later(self) -> None:
        await asyncio.sleep(1.0)
        if self._closing:
            return
        await self._store.async_save(self.config)

    def get_device(self, device_id: str) -> dict | None:
        """Liefert das aktuelle Geräte-Dict (immer aus der Live-Konfiguration)."""
        return find_device(self.config, device_id)

    # ------------------------------------------------------------------
    # Konfiguration ändern (Aufrufe aus den Entitäten/Services)
    # ------------------------------------------------------------------
    def set_setting(self, key: str, value: Any) -> None:
        """Ändert eine globale Einstellung und speichert sie."""
        settings = self.config.setdefault("settings", {})
        settings[key] = value
        self.schedule_save()
        self.request_cycle()

    def set_device_flag(self, device_id: str, path: str, value: Any) -> None:
        """Ändert ein Flag eines Geräts (z. B. enabled, car.min_soc)."""
        device = find_device(self.config, device_id)
        if device is None:
            return
        current = device
        parts = path.split(".")
        for part in parts[:-1]:
            current = current.setdefault(part, {})
        current[parts[-1]] = value
        self.schedule_save()
        self.request_cycle()

    def move_priority(self, device_id: str, direction: int) -> None:
        """Verschiebt ein Gerät in der Prioritätsliste (-1 = höher, +1 = tiefer).

        Autos (reine Überwachung) belegen keine Prioritäts-Position – die
        Verschiebung springt über sie hinweg zum nächsten steuerbaren Gerät.
        """
        devices = self.config.get("devices", [])
        controllable = [
            (i, d) for i, d in enumerate(devices)
            if d.get("role") != ROLE_FAHRZEUG
        ]
        index = next((i for i, d in controllable if d["id"] == device_id), None)
        if index is None:
            return
        position = next((p for p, (i, d) in enumerate(controllable) if i == index), 0)
        target_position = position + direction
        if target_position < 0 or target_position >= len(controllable):
            return
        target = controllable[target_position][0]
        devices[index], devices[target] = devices[target], devices[index]
        self.schedule_save()
        self.request_cycle()

    # ------------------------------------------------------------------
    # Einsteck-Zeitpunkt & gelernte Auto-Wallbox-Zuordnung
    # ------------------------------------------------------------------
    def _track_charge_plug(self, device_id: str, power_w: float, now: float) -> None:
        """Erkennt den Ladestart (Leistung steigt über die Schwelle)."""
        previous = self._last_charge.get(device_id, 0.0)
        self._last_charge[device_id] = power_w
        if previous < CHARGE_ON_W <= power_w:
            self._plug_ts[device_id] = now

    def _purge_plug_ts(self, now: float, keep_s: float = 900.0) -> None:
        """Verwirft veraltete Einsteck-Zeitpunkte."""
        for device_id in list(self._plug_ts):
            if now - self._plug_ts[device_id] > keep_s:
                self._plug_ts.pop(device_id, None)

    def _fresh_plug_pairs(
        self, wallbox_powers: dict[str, float], car_powers: dict[str, float], now: float
    ) -> dict[str, str]:
        """Paart Autos und Wallboxen über den (nahen) Einsteck-Zeitpunkt.

        Beide müssen gerade laden, damit das Signal frisch und belastbar ist
        (die Leistung kann nach dem Ladestart kurz „einpendeln“).
        """
        wallbox_events = [
            {"id": dev_id, "plug_ts": ts}
            for dev_id, ts in self._plug_ts.items()
            if dev_id in wallbox_powers
        ]
        car_events = [
            {"id": dev_id, "plug_ts": ts}
            for dev_id, ts in self._plug_ts.items()
            if dev_id in car_powers
        ]
        return pair_by_plug_time(wallbox_events, car_events)

    def _learn_pairing(self, car_id: str, wallbox_id: str) -> bool:
        """Speichert die gelernte Heimat-Wallbox eines Autos (einmalig)."""
        device = find_device(self.config, car_id)
        if device is None or device.get("role") != ROLE_FAHRZEUG:
            return False
        car = device.get("car")
        if not car:
            return False
        if car.get("home_wallbox") != wallbox_id:
            car["home_wallbox"] = wallbox_id
            self.schedule_save()
            _LOGGER.info(
                "PVM: Auto-Zuordnung gelernt – %s lädt an Wallbox %s",
                device.get("name", car_id),
                wallbox_id,
            )
        return True

    async def async_replace_config(self, config: dict) -> None:
        """Übernimmt die komplette Konfiguration aus dem Panel.

        Speichert sofort und aktualisiert die Live-Konfiguration – die
        Antwort an die Seite kommt also **ohne Wartezeit** (kein Hängen).
        Der Entitäten-Reload für neue/entfernte Geräte wird NICHT hier
        ausgelöst: Die Seite ruft ihn gezielt über ``pvm/reload`` auf und
        wartet darauf (deterministisch, ohne doppelte Reloads).
        """
        normalized = normalize_config(config)
        await self._store.async_save(normalized)
        self.config = normalized
        self.request_cycle()
        self._broadcast()

    # ------------------------------------------------------------------
    # Sensoren lesen
    # ------------------------------------------------------------------
    def read_number(
        self, entity_id: str | None, stale_s: float = STALE_SENSOR_AFTER_S
    ) -> tuple[float | None, bool]:
        """Liest einen Zahlenwert; (None, False) bei fehlender/frischer Messung."""
        if not entity_id:
            return None, False
        state = self.hass.states.get(entity_id)
        if state is None or state.state in (STATE_UNKNOWN, STATE_UNAVAILABLE, ""):
            return None, False
        try:
            value = float(state.state)
        except (TypeError, ValueError):
            return None, False
        updated = state.last_updated
        if updated is not None:
            age = (dt_util.utcnow() - updated).total_seconds()
            if age > stale_s:
                return value, False
        return value, True

    def unit_of(self, entity_id: str | None) -> str:
        """Einheit (unit_of_measurement) einer Entität ("" bei unbekannt)."""
        if not entity_id:
            return ""
        state = self.hass.states.get(entity_id)
        if state is not None and state.attributes:
            return str(state.attributes.get("unit_of_measurement", ""))
        return ""

    def read_power(
        self, entity_id: str | None, stale_s: float = STALE_SENSOR_AFTER_S
    ) -> tuple[float | None, bool]:
        """Liest einen Leistungswert in Watt (kW/mW werden umgerechnet)."""
        value, valid = self.read_number(entity_id, stale_s=stale_s)
        if value is None:
            return None, False
        unit = self.unit_of(entity_id)
        if unit in ("kW", "kw"):
            return value * 1000.0, valid
        if unit in ("mW",):
            return value / 1000.0, valid
        return value, valid

    def read_control_state(self, entity_id: str | None) -> bool | None:
        """Liefert den Bool-Zustand einer Schalter-Entität (None = unbekannt)."""
        if not entity_id:
            return None
        state = self.hass.states.get(entity_id)
        if state is None or state.state in (STATE_UNKNOWN, STATE_UNAVAILABLE):
            return None
        return state.state == STATE_ON

    # ------------------------------------------------------------------
    # Geräte-Scan + Korrelation
    # ------------------------------------------------------------------
    def collect_entities(self) -> list[dict[str, Any]]:
        """Liest alle relevanten Entitäten inkl. Geräte-/Hersteller-Infos."""
        from homeassistant.helpers import device_registry as device_dr
        from homeassistant.helpers import entity_registry as er

        registry = er.async_get(self.hass)
        devices = device_dr.async_get(self.hass)
        entities: list[dict[str, Any]] = []
        for entry in registry.entities.values():
            domain = entry.domain
            if domain not in {
                "sensor", "switch", "number", "binary_sensor", "button",
                "select", "input_boolean", "input_number", "input_select",
            }:
                continue
            if entry.disabled_by or entry.hidden_by:
                continue
            state = self.hass.states.get(entry.entity_id)
            device_class = entry.device_class or (
                state.attributes.get("device_class") if state else None
            )
            name = (state and state.name) or entry.original_name or entry.entity_id
            unit = state.attributes.get("unit_of_measurement", "") if state else ""
            device_id = entry.device_id or None
            manufacturer = ""
            model = ""
            device_name = ""
            if device_id and devices is not None:
                device = devices.async_get(device_id)
                if device:
                    manufacturer = str(device.manufacturer or "")
                    model = str(device.model or "")
                    device_name = str(device.name or "")
            entities.append(
                {
                    "entity_id": entry.entity_id,
                    "name": name,
                    "device_class": device_class,
                    "unit_of_measurement": unit,
                    "state_value": state.state if state else "",
                    "device_id": device_id,
                    "manufacturer": manufacturer,
                    "model": model,
                    "device_name": device_name,
                    "integration": str(entry.platform or ""),
                }
            )
        return entities

    async def scan_devices(self, notify: bool = True) -> dict[str, Any]:
        """Scannt alle Entitäten/Geräte und schlägt Kandidaten vor.

        Ein laufender Scan wird nicht doppelt gestartet (Sperre) – ein
        zweiter Aufruf liefert sofort das letzte Ergebnis. Mit
        ``notify=False`` (automatischer Start-Scan) wird keine
        Benachrichtigung erzeugt.
        """
        if self._scan_lock:
            return self.last_scan
        self._scan_lock = True
        try:
            return await self._scan_devices_inner(notify)
        finally:
            self._scan_lock = False

    async def _scan_devices_inner(self, notify: bool) -> dict[str, Any]:
        """Eigentliche Scan-Logik (unter der Sperre)."""
        entities = self.collect_entities()
        sets = suggest_sets(entities)
        configured_entities = {
            sensor
            for device in self.config.get("devices", [])
            for sensor in device.get("sensors", {}).values()
            if sensor
        }
        # Energie-Sensoren zählen mit: Ein bereits verbundener Sensor wird nicht
        # erneut als „Gefunden“ vorgeschlagen – sonst überschreibt das Übernehmen
        # eine funktionierende Messung versehentlich (PV-Werte fielen weg).
        energy = self.config.get("energy", {}) or {}
        for key in (
            "pv_sensor", "grid_sensor", "grid_import_sensor",
            "grid_export_sensor", "house_sensor",
        ):
            if energy.get(key):
                configured_entities.add(str(energy[key]))
        fresh = [
            found
            for found in sets
            if not any(
                found.get("fields", {}).get(field) in configured_entities
                for field in ("entity", "power_sensor", "soc_sensor", "temp_sensor")
                if found.get("fields", {}).get(field)
            )
        ]
        result = {
            "sets": fresh,
            "energy": {
                role: next(
                    (f["fields"]["entity"] for f in fresh if f["role"] == role),
                    None,
                )
                for role in ("pv", "grid", "house")
            },
            "devices": suggest_sets(entities),
            "new_candidates": {
                role: [f["fields"].get("entity") for f in fresh if f["role"] == role]
                for role in (
                    "pv", "grid", "grid_import", "grid_export", "house",
                    "wallbox", "wp", "verbraucher", "fahrzeug",
                )
            },
            "count": len(entities),
            "ts": _time.time(),
        }
        self.last_scan = result
        # Nur informieren, wenn es wirklich neue Vorschläge gibt
        if notify:
            if fresh:
                text = self._scan_text(fresh)
                await self.hass.services.async_call(
                    "persistent_notification",
                    "create",
                    {
                        "title": "PVM – Geräte & Sensoren gefunden",
                        "message": text,
                        "notification_id": f"{DOMAIN}_scan",
                    },
                )
            else:
                await self.hass.services.async_call(
                    "persistent_notification",
                    "dismiss",
                    {"notification_id": f"{DOMAIN}_scan"},
                )
        self._broadcast()
        return result

    def _scan_text(self, fresh: list[dict]) -> str:
        lines = [
            "In deinem Home Assistant wurde Folgendes gefunden:",
            "",
        ]
        for found in fresh:
            role = found.get("role")
            title = found.get("title", "")
            label = {
                "pv": "PV-Leistung",
                "grid": "Netzbezug/Einspeisung",
                "grid_import": "Netzbezug (separat)",
                "grid_export": "Einspeisung (separat)",
                "house": "Hausverbrauch",
                "wallbox": "Wallbox",
                "wp": "Wärmepumpe",
                "verbraucher": "Verbraucher",
                "fahrzeug": "E-Auto",
            }.get(role, role)
            lines.append(f"**{label}:** {title}")
        lines.append(
            "Öffne die **PV-Manager-Seite** in der Seitenleiste → **Gefunden**, "
            "um die Vorschläge zu übernehmen."
        )
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Setup-Fortschritt (für Tutorial & Status)
    # ------------------------------------------------------------------
    def setup_stage(self) -> str:
        """Aktuelle Einrichtungs-Stufe (start/messungen/bereit)."""
        return setup_stage(self.config)

    def setup_stage_label(self) -> str:
        return SETUP_LABELS.get(self.setup_stage(), self.setup_stage())

    def setup_missing(self) -> list[str]:
        """Fehlende Messungs-Rollen (deutsche Kurztexte für das Tutorial).

        Achtet auf die gewählte Anschluss-Variante: Bei „ein Sensor“ fehlt nur
        der kombinierte Netz-Sensor, bei „zwei Sensoren“ nur Bezug/Einspeisung.
        """
        missing: list[str] = []
        energy = self.config.get("energy", {})
        if not energy_configured(self.config):
            return ["PV-Leistung", "Netzbezug / Einspeisung"]
        if not energy.get("pv_sensor"):
            missing.append("PV-Leistung")
        if energy.get("grid_mode") == GRID_MODE_SEPARATE:
            if not energy.get("grid_import_sensor"):
                missing.append("Netzbezug (separat)")
            if not energy.get("grid_export_sensor"):
                missing.append("Einspeisung (separat)")
        elif not energy.get("grid_sensor"):
            missing.append("Netz (kombiniert)")
        if not energy.get("house_sensor"):
            missing.append("Hausverbrauch (optional)")
        return missing

    # ------------------------------------------------------------------
    # PV-Prognose (Open-Meteo + lokales Modell)
    # ------------------------------------------------------------------
    def _maybe_refresh_forecast(self) -> None:
        """Startet die Prognose-Aktualisierung, falls sie fällig ist.

        Läuft als Hintergrund-Task (nie blockierend) und darf nie crashen:
        bei Fehlern fällt PVM auf das lokale Modell bzw. auf „keine Prognose“
        zurück – die Steuerung funktioniert dann wie bisher.
        """
        if self._forecast_lock or self._closing:
            return
        settings = self.config.get("settings", {})
        if not settings.get("forecast_enabled", True):
            return
        energy = self.config.get("energy", {})
        if not (energy.get("pv_sensor") or energy.get("grid_export_sensor")):
            return  # ohne PV-Messung keine sinnvolle Prognose
        if _time.time() - self._last_forecast_refresh < 900.0:
            return
        self._last_forecast_refresh = _time.time()
        self._forecast_lock = True
        if self._forecast_task and not self._forecast_task.done():
            self._forecast_task.cancel()
        self._forecast_task = self.hass.async_create_task(
            self._refresh_forecast(), name=f"{DOMAIN}_forecast"
        )

    async def _refresh_forecast(self) -> None:
        """Holt die PV-Prognose (Open-Meteo, sonst lokales Modell)."""
        try:
            energy = self.config.get("energy", {})
            pv, _v = self.read_power(energy.get("pv_sensor"))
            lat = float(getattr(self.hass.config, "latitude", 0.0) or 0.0)
            lon = float(getattr(self.hass.config, "longitude", 0.0) or 0.0)
            now = _time.time()
            data: dict[str, Any] = {
                "source": "off",
                "ts": now,
                "series": [],
                "day_curve": [],
                "day_kwh": None,
                "recovery_min": None,
                "note": "Keine Prognose verfügbar (offline / keine Koordinaten).",
            }
            meteo = None
            if lat and lon and self.hass.helpers is not None:
                try:
                    session = self.hass.helpers.aiohttp_client.async_get_clientsession()
                    meteo = await fc.fetch_open_meteo(session, lat, lon)
                except Exception:  # noqa: BLE001
                    meteo = None
            if meteo:
                rad_now = fc.radiation_now(meteo, now)
                factor = fc._scale_to_now(rad_now, pv) or self._pv_derate
                if factor is None:
                    data["note"] = (
                        "Prognose kalibriert sich noch – bei Sonne wird die "
                        "PV-Leistung gelernt."
                    )
                else:
                    full = fc.build_open_meteo_series(
                        meteo["times"], meteo["radiation"], factor, now,
                        horizon_s=36 * 3600,
                    )
                    series = fc.split_series(full, now, horizon_s=3 * 3600)
                    dt_now = datetime.fromtimestamp(now)
                    midnight = now - (
                        dt_now.hour * 3600 + dt_now.minute * 60 + dt_now.second
                    )
                    day = fc.split_series(
                        full, now, end_ts=midnight + 24 * 3600 - 60
                    )
                    data = {
                        "source": "openmeteo",
                        "ts": now,
                        "series": series,
                        "day_curve": fc.hourly_day_curve(day),
                        "day_kwh": fc.energy_kwh(day),
                        "recovery_min": fc.recovery_minutes(series, pv),
                        "note": "Open-Meteo (anonym, ohne Schlüssel).",
                    }
                    self._pv_derate = fc._derate_from(pv, rad_now, self._pv_derate)
            else:
                local = fc.local_fallback_series(list(self._hist_pv), now)
                if local:
                    series = fc.split_series(local, now, horizon_s=3 * 3600)
                    data = {
                        "source": "local",
                        "ts": now,
                        "series": series,
                        "day_curve": fc.hourly_day_curve(local),
                        "day_kwh": fc.energy_kwh(
                            fc.split_series(local, now, end_ts=now + 24 * 3600)
                        ),
                        "recovery_min": fc.recovery_minutes(series, pv),
                        "note": (
                            "Lokales Modell (gleiche Tageszeit der letzten "
                            "Tage) – ohne Internet."
                        ),
                    }
            self.forecast_data = data
        except Exception:  # noqa: BLE001
            _LOGGER.exception("PVM: Prognose-Aktualisierung fehlgeschlagen")
        finally:
            self._forecast_lock = False

    # ------------------------------------------------------------------
    # Korrelations-Puffer (SoC-Anstieg ↔ Ladeleistung)
    # ------------------------------------------------------------------
    def _store_samples(self) -> None:
        for device in self.config.get("devices", []):
            device_id = device["id"]
            sensors = device.get("sensors", {})
            power_id = sensors.get("power")
            soc_id = sensors.get("soc")
            if not power_id and not soc_id:
                continue
            now = _time.time()
            if power_id:
                power, _v = self.read_power(power_id)
                if power is not None:
                    self._power_buf.setdefault(device_id, deque(maxlen=BUFFER_MAX)).append(
                        (now, power)
                    )
            if soc_id and device.get("role") == ROLE_WALLBOX:
                soc, _v = self.read_number(soc_id, stale_s=STALE_SOC_AFTER_S)
                if soc is not None:
                    self._soc_buf.setdefault(device_id, deque(maxlen=BUFFER_MAX)).append(
                        (now, soc)
                    )

    def correlation_ok(self, device_id: str) -> bool | None:
        """True, wenn Leistung und SoC plausibel zusammenhängen (Auto lädt)."""
        power = list(self._power_buf.get(device_id, []))
        soc = list(self._soc_buf.get(device_id, []))
        if len(power) < 4 or len(soc) < 4:
            return None
        return match_power_soc(power, soc)

    # ------------------------------------------------------------------
    # Status für Entitäten
    # ------------------------------------------------------------------
    def status_sensor_value(self) -> str:
        """Kurzer Status-Text für den globalen Status-Sensor."""
        if self.last_error and self.consecutive_errors:
            return "Fehler"
        if not self._energy_configured():
            return "Keine Energiesensoren"
        if self.config["settings"].get("mode") == MODE_OFF:
            return "Aus"
        if self.config["settings"].get("manual_mode"):
            return "Manuell"
        if not self.last_cycle_ts:
            return "Starte …"
        if not self.surplus_valid:
            return "Messung ungültig"
        return "Läuft"

    def _energy_configured(self) -> bool:
        energy = self.config.get("energy", {})
        return bool(
            energy.get("pv_sensor")
            or energy.get("grid_sensor")
            or energy.get("grid_import_sensor")
            or energy.get("grid_export_sensor")
        )

    def device_status_sensor_value(self, device: dict) -> str:
        """Status-Text eines Geräts (aus letztem Zyklus)."""
        device_id = device["id"]
        status = self.device_state.get(device_id)
        if status is None:
            return "wartet"
        target = status.get("target")
        reason_label = status.get("reason_label", "")
        if target == "an":
            return f"an ({reason_label})"
        if target == "aus":
            return f"aus ({reason_label})"
        return "wartet"

    def device_state_on(self, device: dict) -> bool:
        """Ist das Gerät aktuell (aus Sicht von PVM) eingeschaltet?"""
        device_id = device["id"]
        control = device.get("control", {})
        sensors = device.get("sensors", {})
        measured, _valid = self.read_power(sensors.get("power"))
        return self._control_is_on(device_id, control, measured)

    # ------------------------------------------------------------------
    # Auto-Erkennung: welches Auto hängt an welcher Wallbox?
    # ------------------------------------------------------------------
    def _update_car_state(self) -> None:
        """Ordnet Autos Wallboxen zu und aktualisiert ihre Status-Texte.

        Signal-Kombination (jeder Zyklus):
        1. **Einsteck-Zeitpunkt** – steigt die Ladeleistung von Wallbox und
           Auto im selben Moment an, gehören sie zusammen (gelernt &
           gespeichert als Heimat-Wallbox des Autos).
        2. **Ladeleistung** – bei mehreren ladenden Autos/Wallboxen wird nach
           der ähnlichsten Leistung gematcht (unterschiedliche Leistungen
           bleiben unterscheidbar).
        3. **Gelernte Heimat-Wallbox** – als Rückfall, wenn ein einziges Auto
           keine eigene Leistung meldet, aber seine Wallbox lädt.
        Nicht ladende Autos gelten als „unterwegs“.

        Die automatische Erkennung (Einsteck-Zeitpunkt, Leistungsvergleich,
        Lernen der Heimat-Wallbox) ist über die Einstellung ``auto_pairing``
        zuschaltbar – Standard ist AUS. Dann kommt die Zuordnung nur aus der
        manuell gewählten Heimat-Wallbox des Autos („Wo ist dieses Auto zu
        Hause?“) – nichts wird automatisch gelernt.
        """
        now = _time.time()
        auto = bool(self.config["settings"].get("auto_pairing"))
        car_devices = [
            d for d in self.config.get("devices", [])
            if d.get("role") == ROLE_FAHRZEUG
        ]
        wallbox_devices = [
            d for d in self.config.get("devices", [])
            if d.get("role") == ROLE_WALLBOX
        ]

        cars: list[dict] = []
        car_powers: dict[str, float] = {}
        for device in car_devices:
            power, valid = self.read_power(device.get("sensors", {}).get("power"))
            value = power if valid else None
            cars.append({"id": device["id"], "power_w": value})
            if valid and power is not None:
                car_powers[device["id"]] = power
                if auto:
                    self._track_charge_plug(device["id"], power, now)

        wallboxes: list[dict] = []
        wallbox_powers: dict[str, float] = {}
        for device in wallbox_devices:
            power, valid = self.read_power(device.get("sensors", {}).get("power"))
            value = power if valid else None
            wallboxes.append({"id": device["id"], "power_w": value})
            if valid and power is not None:
                wallbox_powers[device["id"]] = power
                if auto:
                    self._track_charge_plug(device["id"], power, now)
        self._purge_plug_ts(now)

        assignments: dict[str, str] = {}
        if auto:
            # 1) Einsteck-Zeitpunkt: nur Paare, die gerade beide laden
            self._plug_pairs = {}
            plug_pairs = self._fresh_plug_pairs(wallbox_powers, car_powers, now)
            for wallbox_id, car_id in plug_pairs.items():
                if (
                    wallbox_id in wallbox_powers
                    and wallbox_powers[wallbox_id] >= CHARGE_ON_W
                    and car_id in car_powers
                    and car_powers[car_id] >= CHARGE_ON_W
                ):
                    self._plug_pairs[car_id] = wallbox_id
                    self._learn_pairing(car_id, wallbox_id)

            # 2) Leistungs-Vergleich für den Rest
            assignments = dict(self._plug_pairs)
            rest_cars = [
                c for c in cars
                if c["id"] not in assignments and c["power_w"] is not None
                and c["power_w"] >= CHARGE_ON_W
            ]
            rest_wb = [
                w for w in wallboxes
                if w["id"] not in assignments.values()
                and w["power_w"] is not None and w["power_w"] >= CHARGE_ON_W
            ]
            for car_id, wallbox_id in assign_cars_to_wallboxes(
                rest_cars, rest_wb
            ).items():
                assignments[car_id] = wallbox_id
                self._learn_pairing(car_id, wallbox_id)

            # 3) Rückfall „nur ein Auto + gelernte Wallbox lädt“: das Auto
            #    meldet selbst keine Leistung, kann also nur an seiner
            #    Wallbox sein.
            active_wb = [
                w for w in wallboxes
                if w["power_w"] is not None and w["power_w"] >= CHARGE_ON_W
            ]
            if len(car_devices) == 1 and len(active_wb) == 1:
                car = cars[0]
                if (
                    car["power_w"] is None or car["power_w"] < CHARGE_ON_W
                ) and car["id"] not in assignments:
                    device = car_devices[0]
                    home = device.get("car", {}).get("home_wallbox")
                    if home and home == active_wb[0]["id"]:
                        assignments[car["id"]] = active_wb[0]["id"]

        # Immer: manuell gewählte Heimat-Wallbox berücksichtigen – ein Auto,
        # dessen Wallbox gerade lädt, hängt dort (auch ohne Auto-Erkennung).
        for car in cars:
            if car["id"] in assignments:
                continue
            device = next(
                (d for d in car_devices if d["id"] == car["id"]), None
            )
            home = (device or {}).get("car", {}).get("home_wallbox")
            if not home:
                continue
            if (
                home in wallbox_powers
                and wallbox_powers[home] >= CHARGE_ON_W
            ):
                assignments[car["id"]] = home

        self.car_assignments = assignments

        statuses: dict[str, str] = {}
        for car in cars:
            car_id = car["id"]
            charging = car["power_w"] is not None and car["power_w"] >= CHARGE_ON_W
            wallbox_id = assignments.get(car_id)
            if wallbox_id and (charging or self._learned_only(car["power_w"])):
                wallbox = find_device(self.config, wallbox_id)
                statuses[car_id] = "lädt an " + (
                    wallbox.get("name", "Wallbox") if wallbox else "Wallbox"
                )
            elif charging:
                statuses[car_id] = "lädt (nicht zugeordnet)"
            else:
                statuses[car_id] = "unterwegs"
        self.car_status = statuses

    @staticmethod
    def _learned_only(power_w: float | None) -> bool:
        """True, wenn die Zuordnung rein aus der gelernten Heimat stammt
        (Auto ohne eigene Leistungsmeldung, aber Wallbox lädt)."""
        return power_w is None or power_w < CHARGE_ON_W

    def rank_of(self, device_id: str) -> int:
        """Rang (1 = höchste Priorität) eines Geräts.

        Autos (reine Überwachung) belegen keinen Rang – gezählt werden nur
        steuerbare Geräte, damit Nummern und Pfeile im Dashboard stimmen.
        """
        rank = 0
        for device in self.config.get("devices", []):
            if device.get("role") == ROLE_FAHRZEUG:
                continue
            rank += 1
            if device["id"] == device_id:
                return rank
        return 0

