"""PVM-Steuer-Engine (reine Logik, keine Home-Assistant-Importe).

Die Engine entscheidet pro Zyklus, welche Geräte mit welcher Leistung laufen.
Sie bekommt fertige Messwerte und Konfiguration als Dataclasses übergeben und
liefert einen Plan zurück. Dadurch ist sie vollständig unit-testbar.

Konzept in Kürze:
1. Garantierte Läufe (Frist, Power Charge, Mindest-SOC, WP-Sicherheit/-Test)
   werden zuerst bedient – sie dürfen nötigenfalls Netzstrom ziehen.
2. Der verbleibende PV-Überschuss wird nach Priorität (1 = höchste) an
   alle weiteren Geräte verteilt – nur so lange echter Überschuss da ist.
3. Antiflackern über Mindest-Ein-/Ausschaltzeiten und Hysterese.
4. Ungültige Messwerte führen zum "Halten" des letzten Zustands statt zu
   hektischen Schaltaktionen.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .const import (
    MODE_AUTO,
    MODE_DEADLINE,
    MODE_OFF,
    MODE_SURPLUS,
    REASON_HOLD,
    REASON_HOLD_FORECAST,
    REASON_OFF_MANUAL,
    REASON_OFF_NO_SURPLUS,
    REASON_OFF_TARGET,
    REASON_ON_DEADLINE,
    REASON_ON_MANUAL,
    REASON_ON_MIN_SOC,
    REASON_ON_SCHEDULE,
    REASON_ON_SURPLUS,
    REASON_ON_WP_SAFETY,
    ROLE_VERBRAUCHER,
)

# Toleranz in Watt: Läuft ein schaltbares Gerät bereits mit Überschuss und der
# Überschuss sinkt nur leicht, bleibt es an. Erst bei größerem Einbruch wird
# abgeschaltet (verhindert Flackern).
SWITCH_KEEP_TOLERANCE_W = 250.0

# Relative Restzeit-Reserve für Frist-Berechnungen (5 % Puffer)
DEADLINE_TIME_BUFFER = 1.05

# SoC-Schwelle, ab der ein Auto als "Ziel erreicht" gilt (verhindert Trickle-Loops)
SOC_DONE_EPSILON_PCT = 0.5

# Solange eine PV-Prognose eine Wiedergenesung innerhalb dieser Minuten
# erwartet, wird ein laufendes Gerät NICHT abgeschaltet (kein Flackern bei
# vorüberziehenden Wolken). Wallboxen mit Leistungs-Begrenzung fahren in der
# Zeit einfach auf die kleinere Rest-Leistung herunter.
FORECAST_HOLD_MIN = 20


@dataclass
class CarInfo:
    """Zustand und Ziele eines E-Autos."""

    soc_pct: float | None
    soc_valid: bool
    capacity_kwh: float
    min_soc: float
    max_soc: float
    min_charge_power_w: float
    grid_min_allowed: bool = True
    grid_deadline_allowed: bool = True
    manual_force: bool = False
    deadline_ts: float | None = None
    deadline_soc: float | None = None


@dataclass
class WpInfo:
    """Zustand und Ziele einer Wärmepumpe."""

    temp_c: float | None
    temp_valid: bool
    comfort_c: float
    safety_min_c: float
    est_power_w: float
    grid_fallback_allowed: bool = True


@dataclass
class Device:
    """Statischer + dynamischer Zustand eines gesteuerten Geräts."""

    id: str
    role: str
    priority: int  # 1 = höchste Priorität
    state_on: bool
    has_power_setpoint: bool  # Leistung exakt einstellbar (Nummern-Entität)
    power_limit_w: float
    min_on_power_w: float
    nominal_power_w: float | None  # erwarteter Verbrauch im Betrieb
    measured_power_w: float | None
    min_on_s: float
    min_off_s: float
    last_on_ts: float | None
    last_off_ts: float | None
    enabled: bool = True
    car: CarInfo | None = None
    wp: WpInfo | None = None
    # Kalender-Zeitfenster (z. B. Verbraucher „Pool läuft 10–16 Uhr“)
    scheduled_window: bool = False   # hat ein Zeitfenster konfiguriert
    schedule_on: bool = False        # Fenster gerade aktiv
    schedule_grid: bool = False      # Netz im Fenster erlaubt
    schedule_power_w: float = 0.0

    def draw_power_w(self) -> float:
        """Geschätzte aktuelle Leistungsaufnahme bei laufendem Gerät."""
        if self.measured_power_w is not None and self.measured_power_w > 0:
            return self.measured_power_w
        return self.nominal_power_w or self.power_limit_w


@dataclass
class DeviceAction:
    """Einzelanweisung an die Ausführungsschicht."""

    id: str
    set_on: bool | None  # None = Zustand beibehalten
    set_power_w: float | None  # None = nicht ändern
    reason: str
    clear_manual: bool = False


@dataclass
class CycleInput:
    """Eingaben für einen Engine-Zyklus."""

    now: float
    mode: str
    surplus_w: float  # bereits um die Reserve reduzierter Überschuss (>= 0)
    surplus_valid: bool
    devices: list[Device] = field(default_factory=list)
    # Minuten, bis die PV-Leistung laut Prognose wieder steigt (None = keine
    # Prognose bzw. keine kurze Wolkenphase). Währenddessen hält die Engine
    # laufende Geräte, statt hektisch abzuschalten.
    forecast_recovery_min: int | None = None


@dataclass
class CyclePlan:
    """Ergebnis eines Engine-Zyklus."""

    actions: list[DeviceAction] = field(default_factory=list)
    surplus_used_w: float = 0.0
    grid_used_w: float = 0.0
    notes: list[str] = field(default_factory=list)


def _grid_allowed(mode: str) -> bool:
    """Darf in diesem Modus überhaupt Netzstrom gezogen werden?"""
    return mode in (MODE_AUTO, MODE_DEADLINE)


def _need_forced_on(
    device: Device, mode: str, now: float
) -> tuple[bool, float, str]:
    """Ermittelt garantierte Anforderungen (Frist, Power Charge, Mindest-SOC, WP).

    Liefert (aktiv, leistung_w, reason). ``aktiv=True`` mit ``leistung_w<=0``
    bedeutet: Ziel erreicht -> ausschalten.
    """
    car = device.car
    if car is not None:
        return _car_forced(device, car, mode, now)
    wp = device.wp
    if wp is not None:
        if (
            wp.temp_valid
            and wp.temp_c is not None
            and wp.temp_c <= wp.safety_min_c
            and wp.grid_fallback_allowed
        ):
            return True, wp.est_power_w, REASON_ON_WP_SAFETY
    return False, 0.0, ""


def _car_forced(
    device: Device, car: CarInfo, mode: str, now: float
) -> tuple[bool, float, str]:
    """Garantierte Ladeanforderungen eines E-Autos."""
    if not car.soc_valid or car.soc_pct is None:
        # Ohne gültigen SoC gibt es keine Ladegarantie (Überladungsschutz).
        return False, 0.0, ""

    grid_ok = _grid_allowed(mode)

    # --- Power Charge ---------------------------------------------------
    if car.manual_force:
        if car.soc_pct >= car.max_soc - SOC_DONE_EPSILON_PCT:
            return True, 0.0, REASON_OFF_TARGET
        if grid_ok and car.grid_deadline_allowed is False and car.deadline_soc is None:
            # (kein Sonderfall – manuell lädt immer mit Netz wenn erlaubt)
            pass
        if grid_ok:
            return True, device.power_limit_w, REASON_ON_MANUAL
        # Netz nicht erlaubt (Modus "Nur Überschuss"): Power Charge wirkt
        # dann wie normales Überschuss-Laden bis Max-SOC.
        return False, 0.0, ""

    # --- Zeitliches Ziel (Frist) ----------------------------------------
    if car.deadline_ts is not None and car.deadline_soc is not None:
        if car.soc_pct >= car.deadline_soc - SOC_DONE_EPSILON_PCT:
            return True, 0.0, REASON_OFF_TARGET
        needed_wh = (
            (car.deadline_soc - car.soc_pct) / 100.0 * car.capacity_kwh * 1000.0
        )
        if needed_wh <= 0:
            return True, 0.0, REASON_OFF_TARGET
        needed_s = (
            needed_wh / max(device.power_limit_w, 1.0)
            * 3600.0
            * DEADLINE_TIME_BUFFER
        )
        forced_from = car.deadline_ts - needed_s
        if now >= forced_from:
            if car.grid_deadline_allowed and grid_ok:
                return True, device.power_limit_w, REASON_ON_DEADLINE
            # Frist verfehlbar, aber Netz nicht erlaubt -> Best Effort aus
            # Überschuss weiter (kein Garantielauf).
            return False, 0.0, ""

    # --- Mindest-SOC ----------------------------------------------------
    if car.soc_pct < car.min_soc - SOC_DONE_EPSILON_PCT:
        if car.grid_min_allowed and grid_ok:
            want = min(car.min_charge_power_w, device.power_limit_w)
            return True, want, REASON_ON_MIN_SOC
        # Ohne Netzfreigabe wird der Mindest-SOC über den Überschuss bedient.
        return False, 0.0, ""

    return False, 0.0, ""


def _surplus_want(device: Device) -> float:
    """Wie viel Leistung möchte das Gerät aus dem Überschuss ziehen?"""
    if device.wp is not None:
        wp = device.wp
        if not wp.temp_valid or wp.temp_c is None:
            # Temperatur kurzzeitig ungültig (z. B. Sensor meldet nur alle
            # 15 min): einen bereits laufenden Heizvorgang mit Messwert
            # halten, sonst nichts Neues starten – nie hektisch abschalten.
            # (Analog zum Auto ohne gültigen SoC.)
            if device.state_on and device.measured_power_w:
                return device.measured_power_w
            return 0.0
        if wp.temp_c >= wp.comfort_c - 0.1:
            return 0.0  # Zieltemperatur erreicht
        return wp.est_power_w
    if device.car is not None:
        car = device.car
        if not car.soc_valid or car.soc_pct is None:
            # SoC kurzzeitig ungültig: ein bereits laufender Ladevorgang mit
            # Messwert wird gehalten, sonst nichts Neues starten.
            if device.state_on and device.measured_power_w:
                return device.measured_power_w
            return 0.0
        if car.soc_pct >= car.max_soc - SOC_DONE_EPSILON_PCT:
            return 0.0
        return device.power_limit_w
    # Verbraucher
    if device.state_on and device.measured_power_w:
        return device.measured_power_w
    return device.nominal_power_w or device.power_limit_w


def _can_turn_off(device: Device, now: float) -> bool:
    """Mindest-Einschaltdauer eingehalten?"""
    if not device.state_on:
        return True
    if device.last_on_ts is None:
        return True
    return now - device.last_on_ts >= device.min_on_s


def _can_turn_on(device: Device, now: float) -> bool:
    """Mindest-Ausschaltdauer eingehalten?"""
    if device.state_on:
        return True
    if device.last_off_ts is None:
        return True
    return now - device.last_off_ts >= device.min_off_s


def compute_plan(inp: CycleInput) -> CyclePlan:
    """Berechnet den Steuerplan für einen Zyklus."""
    plan = CyclePlan()
    if inp.mode == MODE_OFF or not inp.devices:
        return plan

    now = inp.now
    mode = inp.mode
    devices = sorted(inp.devices, key=lambda d: d.priority)

    surplus_remaining = max(0.0, inp.surplus_w) if inp.surplus_valid else 0.0
    grid_used = 0.0
    surplus_used = 0.0

    # id -> finale Aktion
    final: dict[str, DeviceAction] = {}

    def put(action: DeviceAction) -> None:
        """Fügt eine Aktion hinzu; verschmilzt mehrere Entscheidungen."""
        prev = final.get(action.id)
        if prev is None:
            final[action.id] = action
            return
        if prev.set_on != action.set_on:
            # Gegensätzliche Entscheidungen: die zuletzt gesetzte gewinnt.
            final[action.id] = action
            return
        # Gleicher Zielzustand: Flags und Leistungswert zusammenführen.
        final[action.id] = DeviceAction(
            id=action.id,
            set_on=prev.set_on,
            set_power_w=(
                action.set_power_w
                if action.set_power_w is not None
                else prev.set_power_w
            ),
            reason=(
                action.reason
                if action.set_power_w is not None
                else prev.reason
            ),
            clear_manual=prev.clear_manual or action.clear_manual,
        )

    # ------------------------------------------------------------------
    # 1) Garantierte Läufe
    # ------------------------------------------------------------------
    for dev in devices:
        if not dev.enabled:
            continue
        on, power, reason = _need_forced_on(dev, mode, now)
        if not on and dev.schedule_on:
            # Kalender-Zeitfenster mit Netz-Freigabe: garantiert laufen lassen
            if dev.schedule_grid and _grid_allowed(mode):
                on, power, reason = (
                    True,
                    dev.schedule_power_w or dev.nominal_power_w or dev.power_limit_w,
                    REASON_ON_SCHEDULE,
                )
        if not on:
            continue

        if power <= 0:
            # Ziel erreicht -> ausschalten
            if dev.state_on and _can_turn_off(dev, now):
                clear = (
                    reason == REASON_OFF_TARGET
                    and dev.car is not None
                    and dev.car.manual_force
                )
                put(
                    DeviceAction(
                        id=dev.id,
                        set_on=False,
                        set_power_w=0.0 if dev.has_power_setpoint else None,
                        reason=reason,
                        clear_manual=clear,
                    )
                )
            continue

        if not _can_turn_on(dev, now):
            # Gerade erst ausgeschaltet und Frist ist dringend?
            if reason not in (REASON_ON_DEADLINE, REASON_ON_MANUAL):
                continue

        # Überschuss zuerst verbrauchen, Rest aus dem Netz
        consumed = min(power, surplus_remaining)
        surplus_remaining -= consumed
        surplus_used += consumed
        grid_used += max(0.0, power - consumed)
        if dev.has_power_setpoint:
            put(
                DeviceAction(
                    id=dev.id,
                    set_on=True,
                    set_power_w=power,
                    reason=reason,
                )
            )
        else:
            put(DeviceAction(id=dev.id, set_on=True, set_power_w=None, reason=reason))

    # Zeitfenster-Kalender: Verbraucher außerhalb ihres Zeitfensters beenden
    # (auch wenn gerade Überschuss da wäre – das Fenster ist der Wunsch).
    for dev in devices:
        if (
            dev.role == ROLE_VERBRAUCHER
            and dev.scheduled_window
            and not dev.schedule_on
            and dev.state_on
            and dev.id not in final
        ):
            if _can_turn_off(dev, now):
                put(
                    DeviceAction(
                        id=dev.id,
                        set_on=False,
                        set_power_w=None,
                        reason=REASON_OFF_TARGET,
                    )
                )

    # ------------------------------------------------------------------
    # 2) Überschuss-Verteilung nach Priorität
    # ------------------------------------------------------------------
    can_start_surplus = mode in (MODE_AUTO, MODE_SURPLUS)
    if (can_start_surplus or mode == MODE_DEADLINE) and inp.surplus_valid:
        for dev in devices:
            if not dev.enabled:
                if dev.state_on and _can_turn_off(dev, now):
                    put(
                        DeviceAction(
                            id=dev.id,
                            set_on=False,
                            set_power_w=None,
                            reason=REASON_OFF_MANUAL,
                        )
                    )
                continue
            if dev.id in final and final[dev.id].set_on is True:
                continue  # läuft bereits als Garantielauf
            if (
                dev.role == ROLE_VERBRAUCHER
                and dev.scheduled_window
                and not dev.schedule_on
            ):
                continue  # Verbraucher mit Kalender-Fenster: außerhalb nicht starten

            want = _surplus_want(dev)
            if want <= 0:
                if dev.state_on and _can_turn_off(dev, now):
                    put(
                        DeviceAction(
                            id=dev.id,
                            set_on=False,
                            set_power_w=0.0 if dev.has_power_setpoint else None,
                            reason=REASON_OFF_TARGET,
                        )
                    )
                continue

            enough = surplus_remaining >= want - 1.0

            if dev.has_power_setpoint:
                give = min(want, surplus_remaining)
                if dev.state_on:
                    # Läuft bereits: Leistung nachziehen oder stoppen
                    if give < dev.min_on_power_w:
                        if _can_turn_off(dev, now):
                            put(
                                DeviceAction(
                                    id=dev.id,
                                    set_on=False,
                                    set_power_w=None,
                                    reason=REASON_OFF_NO_SURPLUS,
                                )
                            )
                        continue
                    if give >= dev.min_on_power_w:
                        put(
                            DeviceAction(
                                id=dev.id,
                                set_on=True,
                                set_power_w=round(give),
                                reason=REASON_ON_SURPLUS,
                            )
                        )
                    continue
                # Aus -> nur starten, wenn sauber möglich
                if not can_start_surplus:
                    continue
                if give < dev.min_on_power_w or not _can_turn_on(dev, now):
                    continue
                surplus_remaining -= give
                surplus_used += give
                put(
                    DeviceAction(
                        id=dev.id,
                        set_on=True,
                        set_power_w=round(give),
                        reason=REASON_ON_SURPLUS,
                    )
                )
            else:
                # Nur Ein/Aus
                if dev.state_on:
                    if not enough and surplus_remaining < want - SWITCH_KEEP_TOLERANCE_W:
                        # Kurze Wolkenphase laut Prognose? Dann halten statt
                        # abschalten – sonst flackert z. B. die Wärmepumpe bei
                        # vorüberziehenden Wolken ständig an/aus. Nur die
                        # Wallbox (dev.car) fährt live herunter.
                        recovery = (
                            inp.forecast_recovery_min is not None
                            and inp.forecast_recovery_min <= FORECAST_HOLD_MIN
                        )
                        if recovery and dev.car is None:
                            put(
                                DeviceAction(
                                    id=dev.id, set_on=None, set_power_w=None,
                                    reason=REASON_HOLD_FORECAST,
                                )
                            )
                        elif _can_turn_off(dev, now):
                            put(
                                DeviceAction(
                                    id=dev.id,
                                    set_on=False,
                                    set_power_w=None,
                                    reason=REASON_OFF_NO_SURPLUS,
                                )
                            )
                    continue
                if not can_start_surplus:
                    continue
                if not enough or not _can_turn_on(dev, now):
                    continue
                surplus_remaining -= want
                surplus_used += want
                put(
                    DeviceAction(
                        id=dev.id, set_on=True, set_power_w=None, reason=REASON_ON_SURPLUS
                    )
                )

    # ------------------------------------------------------------------
    # 3) Halten bei ungültigen Messwerten (keine hektischen Aktionen)
    # ------------------------------------------------------------------
    if not inp.surplus_valid:
        for dev in devices:
            if dev.state_on and dev.id not in final:
                if _surplus_want(dev) > 0:
                    # Läuft gerade – Zustand halten statt raten
                    put(DeviceAction(id=dev.id, set_on=None, set_power_w=None, reason=REASON_HOLD))

    plan.actions = list(final.values())
    plan.surplus_used_w = round(surplus_used, 1)
    plan.grid_used_w = round(grid_used, 1)
    return plan
