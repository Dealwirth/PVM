"""Tests für die PVM-Steuer-Engine."""

from custom_components.pvm import engine as eng
from custom_components.pvm.const import (
    MODE_AUTO,
    MODE_DEADLINE,
    MODE_OFF,
    MODE_SURPLUS,
    REASON_OFF_NO_SURPLUS,
    REASON_OFF_TARGET,
    REASON_ON_DEADLINE,
    REASON_ON_MANUAL,
    REASON_ON_MIN_SOC,
    REASON_ON_SURPLUS,
    REASON_ON_WP_SAFETY,
    REASON_ON_WP_TEST,
    ROLE_VERBRAUCHER,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
)

NOW = 1_700_000_000.0


def consumer(
    device_id: str,
    priority: int,
    nominal: float = 2000.0,
    state_on: bool = False,
    enabled: bool = True,
    has_setpoint: bool = False,
    measured: float | None = None,
    last_on: float | None = None,
    last_off: float | None = None,
) -> eng.Device:
    return eng.Device(
        id=device_id,
        role=ROLE_VERBRAUCHER,
        priority=priority,
        state_on=state_on,
        has_power_setpoint=has_setpoint,
        power_limit_w=nominal,
        min_on_power_w=nominal,
        nominal_power_w=nominal,
        measured_power_w=measured,
        min_on_s=120,
        min_off_s=60,
        last_on_ts=last_on,
        last_off_ts=last_off,
        enabled=enabled,
    )


def car(
    device_id: str,
    priority: int,
    soc: float | None = 50.0,
    soc_valid: bool = True,
    capacity: float = 60.0,
    min_soc: float = 50.0,
    max_soc: float = 80.0,
    manual: bool = False,
    deadline_ts: float | None = None,
    deadline_soc: float | None = None,
    grid_min: bool = True,
    grid_deadline: bool = True,
    state_on: bool = False,
    has_setpoint: bool = True,
    power_limit: float = 11000.0,
    min_charge: float = 4000.0,
    enabled: bool = True,
    measured: float | None = None,
) -> eng.Device:
    return eng.Device(
        id=device_id,
        role=ROLE_WALLBOX,
        priority=priority,
        state_on=state_on,
        has_power_setpoint=has_setpoint,
        power_limit_w=power_limit,
        min_on_power_w=1400.0,
        nominal_power_w=power_limit,
        measured_power_w=measured,
        min_on_s=120,
        min_off_s=60,
        last_on_ts=None,
        last_off_ts=None,
        enabled=enabled,
        car=eng.CarInfo(
            soc_pct=soc,
            soc_valid=soc_valid,
            capacity_kwh=capacity,
            min_soc=min_soc,
            max_soc=max_soc,
            min_charge_power_w=min_charge,
            grid_min_allowed=grid_min,
            grid_deadline_allowed=grid_deadline,
            manual_force=manual,
            deadline_ts=deadline_ts,
            deadline_soc=deadline_soc,
        ),
    )


def wp(
    device_id: str,
    priority: int,
    temp: float = 55.0,
    temp_valid: bool = True,
    comfort: float = 60.0,
    safety: float = 40.0,
    est: float = 2000.0,
    state_on: bool = False,
    test_active: bool = False,
    grid_fallback: bool = True,
    enabled: bool = True,
) -> eng.Device:
    return eng.Device(
        id=device_id,
        role=ROLE_WAERMEPUMPE,
        priority=priority,
        state_on=state_on,
        has_power_setpoint=False,
        power_limit_w=est,
        min_on_power_w=500.0,
        nominal_power_w=est,
        measured_power_w=None,
        min_on_s=120,
        min_off_s=60,
        last_on_ts=None,
        last_off_ts=None,
        enabled=enabled,
        wp=eng.WpInfo(
            temp_c=temp,
            temp_valid=temp_valid,
            comfort_c=comfort,
            safety_min_c=safety,
            est_power_w=est,
            grid_fallback_allowed=grid_fallback,
            test_active=test_active,
        ),
    )


def run(devices, surplus=5000.0, valid=True, mode=MODE_AUTO) -> eng.CyclePlan:
    return eng.compute_plan(
        eng.CycleInput(now=NOW, mode=mode, surplus_w=surplus, surplus_valid=valid, devices=devices)
    )


def action_for(plan: eng.CyclePlan, device_id: str) -> eng.DeviceAction | None:
    for action in plan.actions:
        if action.id == device_id:
            return action
    return None


# ---------------------------------------------------------------------------
# Überschuss-Verteilung
# ---------------------------------------------------------------------------

def test_higher_priority_gets_surplus_first():
    plan = run(
        [
            consumer("washer", 1, nominal=2000.0),
            consumer("pool", 2, nominal=2000.0),
        ],
        surplus=3000.0,
    )
    assert action_for(plan, "washer").set_on is True
    assert action_for(plan, "washer").reason == REASON_ON_SURPLUS
    # Nicht genug Überschuss für den zweiten Verbraucher
    assert action_for(plan, "pool") is None


def test_enough_surplus_for_both():
    plan = run(
        [
            consumer("washer", 1, nominal=2000.0),
            consumer("pool", 2, nominal=2000.0),
        ],
        surplus=5000.0,
    )
    assert action_for(plan, "washer").set_on is True
    assert action_for(plan, "pool").set_on is True


def test_partial_surplus_for_setpoint_device():
    car_dev = car("auto1", 1, soc=50.0)
    plan = run([car_dev], surplus=3000.0)
    action = action_for(plan, "auto1")
    assert action is not None
    assert action.set_on is True
    assert action.set_power_w == 3000.0
    assert action.reason == REASON_ON_SURPLUS


def test_no_start_below_min_power():
    car_dev = car("auto1", 1, soc=50.0)
    plan = run([car_dev], surplus=1000.0)
    assert action_for(plan, "auto1") is None


def test_running_switch_only_turns_off_when_surplus_drops():
    dev = consumer("washer", 1, nominal=2000.0, state_on=True, last_on=NOW - 600)
    plan = run([dev], surplus=1500.0)
    action = action_for(plan, "washer")
    assert action is not None
    assert action.set_on is False
    assert action.reason == REASON_OFF_NO_SURPLUS


def test_running_device_stays_on_with_small_drop():
    dev = consumer("washer", 1, nominal=2000.0, state_on=True, last_on=NOW - 600)
    plan = run([dev], surplus=1800.0)
    assert action_for(plan, "washer") is None  # Toleranz greift


def test_min_on_time_blocks_turn_off():
    dev = consumer("washer", 1, nominal=2000.0, state_on=True, last_on=NOW - 30)
    plan = run([dev], surplus=0.0)
    assert action_for(plan, "washer") is None


def test_min_off_time_blocks_restart():
    dev = consumer("washer", 1, nominal=2000.0, state_on=False, last_off=NOW - 10)
    plan = run([dev], surplus=5000.0)
    assert action_for(plan, "washer") is None


def test_disabled_running_device_turns_off():
    dev = consumer("washer", 1, nominal=2000.0, state_on=True, enabled=False, last_on=NOW - 600)
    plan = run([dev], surplus=5000.0)
    action = action_for(plan, "washer")
    assert action is not None
    assert action.set_on is False


def test_mode_off_does_nothing():
    dev = consumer("washer", 1, nominal=2000.0, state_on=False)
    plan = run([dev], surplus=5000.0, mode=MODE_OFF)
    assert plan.actions == []


# ---------------------------------------------------------------------------
# E-Auto
# ---------------------------------------------------------------------------

def test_power_charge_uses_full_power_and_grid():
    car_dev = car("auto1", 1, soc=50.0, manual=True)
    plan = run([car_dev], surplus=3000.0)
    action = action_for(plan, "auto1")
    assert action is not None
    assert action.set_on is True
    assert action.set_power_w == 11000.0
    assert action.reason == REASON_ON_MANUAL
    assert plan.grid_used_w == 8000.0


def test_power_charge_stops_at_max_soc_and_clears():
    car_dev = car("auto1", 1, soc=79.9, manual=True, state_on=True)
    car_dev.last_on_ts = NOW - 600
    plan = run([car_dev], surplus=0.0)
    action = action_for(plan, "auto1")
    assert action is not None
    assert action.set_on is False
    assert action.clear_manual is True
    assert action.reason == REASON_OFF_TARGET


def test_min_soc_charging_with_grid():
    car_dev = car("auto1", 1, soc=45.0, min_soc=50.0)
    plan = run([car_dev], surplus=0.0)
    action = action_for(plan, "auto1")
    assert action is not None
    assert action.set_on is True
    assert action.set_power_w == 4000.0
    assert action.reason == REASON_ON_MIN_SOC


def test_min_soc_without_grid_allowed_uses_surplus_only():
    car_dev = car("auto1", 1, soc=45.0, min_soc=50.0, grid_min=False)
    plan = run([car_dev], surplus=0.0)
    assert action_for(plan, "auto1") is None
    plan2 = run([car_dev], surplus=5000.0)
    action = action_for(plan2, "auto1")
    assert action is not None and action.set_on is True


def test_deadline_forces_charging_when_late():
    # 30 % von 60 kWh = 18 kWh, bei 11 kW ~ 1.6 h nötig
    car_dev = car(
        "auto1", 1, soc=50.0, deadline_ts=NOW + 3600.0, deadline_soc=80.0
    )
    plan = run([car_dev], surplus=0.0)
    action = action_for(plan, "auto1")
    assert action is not None
    assert action.reason == REASON_ON_DEADLINE


def test_deadline_not_yet_urgent_stays_off():
    car_dev = car(
        "auto1", 1, soc=50.0, deadline_ts=NOW + 6 * 3600.0, deadline_soc=80.0
    )
    plan = run([car_dev], surplus=0.0)
    assert action_for(plan, "auto1") is None


def test_deadline_target_already_reached():
    car_dev = car(
        "auto1", 1, soc=85.0, deadline_ts=NOW + 3600.0, deadline_soc=80.0, state_on=True
    )
    car_dev.last_on_ts = NOW - 600
    plan = run([car_dev], surplus=0.0)
    action = action_for(plan, "auto1")
    assert action is not None and action.set_on is False


def test_deadline_charging_stops_at_deadline_soc():
    car_dev = car(
        "auto1", 1, soc=79.6, deadline_ts=NOW + 3600.0, deadline_soc=80.0, state_on=True
    )
    car_dev.last_on_ts = NOW - 600
    plan = run([car_dev], surplus=0.0)
    action = action_for(plan, "auto1")
    assert action is not None and action.set_on is False


def test_no_soc_no_guaranteed_charging():
    car_dev = car("auto1", 1, soc=None, manual=True, soc_valid=False)
    plan = run([car_dev], surplus=0.0)
    assert action_for(plan, "auto1") is None


def test_car_above_min_soc_is_surplus_only():
    car_dev = car("auto1", 1, soc=60.0, min_soc=50.0)
    plan = run([car_dev], surplus=0.0)
    assert action_for(plan, "auto1") is None


# ---------------------------------------------------------------------------
# Modus-Einschränkungen
# ---------------------------------------------------------------------------

def test_surplus_mode_blocks_manual_grid_charge():
    car_dev = car("auto1", 1, soc=60.0, manual=True)
    plan = run([car_dev], surplus=8000.0, mode=MODE_SURPLUS)
    action = action_for(plan, "auto1")
    assert action is not None
    assert action.reason == REASON_ON_SURPLUS
    assert plan.grid_used_w == 0.0


def test_deadline_mode_skips_surplus_distribution():
    car_dev = car("auto1", 1, soc=60.0)
    plan = run([car_dev], surplus=8000.0, mode=MODE_DEADLINE)
    assert action_for(plan, "auto1") is None


def test_deadline_mode_still_runs_deadline():
    car_dev = car(
        "auto1", 1, soc=50.0, deadline_ts=NOW + 1200.0, deadline_soc=80.0
    )
    plan = run([car_dev], surplus=0.0, mode=MODE_DEADLINE)
    action = action_for(plan, "auto1")
    assert action is not None and action.reason == REASON_ON_DEADLINE


# ---------------------------------------------------------------------------
# Wärmepumpe
# ---------------------------------------------------------------------------

def test_wp_runs_from_surplus_below_comfort():
    wp_dev = wp("wp1", 1, temp=55.0, comfort=60.0)
    plan = run([wp_dev], surplus=2000.0)
    action = action_for(plan, "wp1")
    assert action is not None and action.set_on is True
    assert action.reason == REASON_ON_SURPLUS


def test_wp_off_when_comfort_reached():
    wp_dev = wp("wp1", 1, temp=60.5, comfort=60.0, state_on=True, )
    wp_dev.last_on_ts = NOW - 600
    plan = run([wp_dev], surplus=5000.0)
    action = action_for(plan, "wp1")
    assert action is not None and action.set_on is False
    assert action.reason == REASON_OFF_TARGET


def test_wp_safety_heats_with_grid():
    wp_dev = wp("wp1", 1, temp=35.0, safety=40.0)
    plan = run([wp_dev], surplus=0.0)
    action = action_for(plan, "wp1")
    assert action is not None and action.set_on is True
    assert action.reason == REASON_ON_WP_SAFETY


def test_wp_safety_requires_fallback_flag():
    wp_dev = wp("wp1", 1, temp=35.0, safety=40.0, grid_fallback=False)
    plan = run([wp_dev], surplus=0.0)
    assert action_for(plan, "wp1") is None


def test_wp_test_forces_on():
    wp_dev = wp("wp1", 1, temp=50.0, test_active=True)
    plan = run([wp_dev], surplus=0.0)
    action = action_for(plan, "wp1")
    assert action is not None and action.set_on is True
    assert action.reason == REASON_ON_WP_TEST


# ---------------------------------------------------------------------------
# Messwert-Qualität
# ---------------------------------------------------------------------------

def test_invalid_surplus_holds_state():
    dev = consumer("washer", 1, nominal=2000.0, state_on=True, last_on=NOW - 600)
    plan = run([dev], surplus=0.0, valid=False)
    # Kein Ausschalten, wenn die Messung gerade unbrauchbar ist
    assert action_for(plan, "washer") is None or action_for(plan, "washer").set_on is None
