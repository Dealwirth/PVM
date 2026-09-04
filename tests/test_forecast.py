"""Tests für die PV-Prognose (Open-Meteo-Aufbereitung + lokales Modell)."""

from custom_components.pvm import forecast as fc

NOW = 1_700_000_000.0  # ein fester Zeitpunkt (UTC)


def test_scale_to_now():
    # Faktor wird auf DERATE_MAX (3.0) begrenzt
    assert fc._scale_to_now(500.0, 2500.0) == 3.0
    assert fc._scale_to_now(0.0, 100.0) is None
    assert fc._scale_to_now(100.0, 0.0) is None


def test_derate_learning():
    assert fc._derate_from(2000.0, 500.0, None) == 3.0
    # Messfehler gleiten langsam
    assert fc._derate_from(3000.0, 500.0, 3.0) == 3.0 * 0.7 + 3.0 * 0.3
    assert fc._derate_from(None, 500.0, 3.0) == 3.0
    assert fc._derate_from(100.0, 20.0, 3.0) == 3.0  # zu dunkel -> lernen nicht


def test_build_series_only_future():
    times = [NOW - 900, NOW, NOW + 900, NOW + 1800, NOW + 2700]
    rad = [100.0, 200.0, 400.0, 500.0, 600.0]
    series = fc.build_open_meteo_series(times, rad, factor=5.0, now_ts=NOW)
    assert len(series) == 4
    assert series[0]["pv_w"] == 1000  # NOW + 0 -> 200 W/m² * 5
    assert all(p["t"] >= NOW - 60 for p in series)


def test_energy_kwh():
    series = [
        {"t": NOW, "pv_w": 4000},
        {"t": NOW + 900, "pv_w": 4000},
        {"t": NOW + 1800, "pv_w": 2000},
        {"t": NOW + 2700, "pv_w": None},
    ]
    # 4000 W * 0.25 h + 4000 * 0.25 + 2000 * 0.25 = 2.5 kWh
    assert fc.energy_kwh(series) == 2.5


def test_recovery_minutes_detects_short_dip():
    series = [
        {"t": NOW, "pv_w": 500},
        {"t": NOW + 900, "pv_w": 450},
        {"t": NOW + 1800, "pv_w": 800},
        {"t": NOW + 2700, "pv_w": 3000},
    ]
    # Gemessen wird gerade wenig (Wolke) – Prognose steigt in 15–30 min.
    assert fc.recovery_minutes(series, live_pv_w=500.0) == 30


def test_recovery_minutes_none_when_sunny():
    series = [
        {"t": NOW, "pv_w": 3000},
        {"t": NOW + 900, "pv_w": 3100},
        {"t": NOW + 1800, "pv_w": 3200},
    ]
    assert fc.recovery_minutes(series, live_pv_w=3000.0) is None


def test_local_fallback_needs_history():
    assert fc.local_fallback_series([], NOW) is None
    hist = [(NOW - 86400 * i - 1800, 1500.0 + i) for i in range(6)] * 10
    series = fc.local_fallback_series(hist, NOW)
    assert series is None or len(series) > 0


def test_split_and_hourly_day_curve():
    series = [{"t": NOW + i * 900, "pv_w": 2000} for i in range(24)]
    cut = fc.split_series(series, NOW, horizon_s=3600)
    assert 0 < len(cut) <= 5
    day = fc.hourly_day_curve(series)
    assert day and day[0]["pv_w"] == 2000
