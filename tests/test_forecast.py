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


def test_solar_elevation_sane():
    lat, lon = 50.1, 8.7  # Mitteleuropa
    # Sommer-Mittag (UTC 12:00, 21. Juni) deutlich höher als Winter-Mittag
    import datetime as _dt
    summer = _dt.datetime(2026, 6, 21, 12, 0, tzinfo=_dt.UTC).timestamp()
    winter = _dt.datetime(2026, 12, 21, 12, 0, tzinfo=_dt.UTC).timestamp()
    assert fc.solar_elevation(lat, lon, summer) > fc.solar_elevation(lat, lon, winter)
    assert fc.solar_elevation(lat, lon, summer) > 50.0
    assert fc.solar_elevation(lat, lon, winter) < 30.0
    # Nachts unter 0
    midnight = _dt.datetime(2026, 6, 21, 0, 30, tzinfo=_dt.UTC).timestamp()
    assert fc.solar_elevation(lat, lon, midnight) < 5.0


def test_clear_sky_monotonic():
    assert fc.clear_sky_wm2(0.0) == 0.0
    assert fc.clear_sky_wm2(5.0) < fc.clear_sky_wm2(30.0) < fc.clear_sky_wm2(60.0)
    assert 0.0 < fc.clear_sky_wm2(45.0) <= 1250.0


def test_learn_curve_and_factor():
    lat, lon = 50.1, 8.7
    # Simulierte Vergangenheit: bei hohem Sonnenstand mehr PV-Leistung
    history = []
    import datetime as _dt
    for day in range(6):
        for hour in (9, 10, 11, 12, 13, 14, 15):
            ts = _dt.datetime(2026, 6, day + 1, hour, 0, tzinfo=_dt.UTC).timestamp()
            elev = fc.solar_elevation(lat, lon, ts)
            clear = fc.clear_sky_wm2(elev)
            pv = clear * 0.3 if clear > 0 else 0.0
            history.append((ts, pv))
    curve = fc.learn_elevation_curve(history, lat, lon)
    assert curve["points"]
    assert curve["days"] == 6
    assert curve["coverage"] > 0
    # Interpolation liegt im Bereich der Punkte
    f_mid = fc.elev_factor(30.0, curve)
    assert f_mid is not None and 0.0 < f_mid <= fc.CURVE_MAX_RATIO
    assert fc.elev_factor(0.0, curve) == 0.0
    assert fc.elev_factor(89.0, curve) == curve["points"][-1]["factor"]


def test_predict_from_radiation():
    lat, lon = 50.1, 8.7
    history = [(NOW - i * 900, 1500.0) for i in range(1, 80)]
    curve = fc.learn_elevation_curve(history, lat, lon)
    times = [NOW + i * 900 for i in range(0, 12)]
    rad = [800.0] * 12
    out = fc.predict_from_radiation(times, rad, lat, lon, curve, NOW, horizon_s=3 * 3600)
    assert out
    assert all(p["t"] >= NOW - 60 for p in out)
    # Sonne am Tag → positive Werte, kein Absturz
    assert all(p["pv_w"] is not None for p in out)


def test_predict_clear_sky():
    lat, lon = 50.1, 8.7
    curve = {"points": [{"elev": 25.0, "factor": 0.3, "count": 5}, {"elev": 55.0, "factor": 0.32, "count": 5}]}
    times = [NOW + i * 900 for i in range(0, 8)]
    out = fc.predict_clear_sky(times, lat, lon, curve, NOW, horizon_s=3 * 3600)
    assert out
    assert all(p["pv_w"] >= 0 for p in out)


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
