"""PV-Prognose für PVM – Open-Meteo (mit eigenem API-Schlüssel).

Konzept
-------
1. **Open-Meteo** liefert eine 15-Minuten-Strahlungsprognose. PVM fragt die
   Prognose NUR über den dedizierten Kunden-Endpunkt
   (customer-api.open-meteo.com) ab – dafür ist ein eigener API-Schlüssel
   erforderlich (unter open-meteo.com → Tarif wählen → Schlüssel erhalten).
   Aus der Strahlung wird mit einem gelernten Umrechnungsfaktor
   (Watt PV je W/m²) die erwartete PV-Leistung geschätzt.
2. **Lokales Modell** (Fallback, wenn das Netz nicht erreichbar ist): PVM
   nutzt die Messungen der letzten Tage zur gleichen Tageszeit als
   Erwartungskurve – grob, aber komplett offline.

Ergebnis (dict) – wird vom Manager gecacht und der Engine/der Seite bereit
gestellt::

    {
      "source": "openmeteo" | "local" | "off",
      "ts": <epoch>,
      "recovery_min": int | None,   # Minuten bis die PV wieder steigt
      "series": [{"t": epoch, "pv_w": float}, ...],   # nächste 3 h (15 min)
      "day_curve": [{"t": epoch, "pv_w": float}, ...], # Rest des Tages (stündlich)
      "day_kwh": float | None,      # erwartete PV-Energie Rest des Tages
      "note": str,
    }
"""

from __future__ import annotations

import math
from datetime import datetime

# Open-Meteo: Der offene Endpunkt (api.open-meteo.com) funktioniert auch
# OHNE API-Schlüssel – PVM nutzt ihn standardmäßig (kostenlos). Wer mag,
# hinterlegt zusätzlich einen eigenen Schlüssel für den Kunden-Endpunkt
# (customer-api.open-meteo.com) – stabiler und mit höheren Limits.
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_API_URL = "https://customer-api.open-meteo.com/v1/forecast"
# Min. Strahlung, ab der ein Umrechnungsfaktor gelernt wird (W/m²)
RAD_LEARN_MIN_WM2 = 80.0
# Nach dieser Dauer ohne Sonne verfällt der gelernte Faktor nicht sofort –
# wir behalten den letzten Wert und nutzen ihn für die Tagessumme.
DERATE_MAX = 3.0  # nie mehr als 300 % Wirkungsgrad-Glättung


def _derate_from(pv_w: float | None, rad_wm2: float | None, prev: float | None) -> float | None:
    """Lernt den Faktor Watt-PV je W/m² aus einer aktuellen Messung."""
    if pv_w is None or rad_wm2 is None or rad_wm2 < RAD_LEARN_MIN_WM2 or pv_w <= 0:
        return prev
    factor = pv_w / rad_wm2
    factor = max(0.05, min(DERATE_MAX, factor))
    if prev is None:
        return factor
    # Exponentiell gleiten – Messfehler einzelner Minuten verpuffen.
    return prev * 0.7 + factor * 0.3


def _scale_to_now(rad_wm2: float | None, now_pv_w: float | None) -> float | None:
    """Ankerfaktor: erwartete PV jetzt ≈ gemessene PV jetzt."""
    if rad_wm2 is None or now_pv_w is None or rad_wm2 <= 0 or now_pv_w <= 0:
        return None
    factor = now_pv_w / rad_wm2
    return max(0.05, min(DERATE_MAX, factor))


def radiation_now(meteo: dict, now_ts: float) -> float | None:
    """Aktuelle (bzw. nächste) Strahlung aus der Open-Meteo-Antwort."""
    times = meteo.get("times") or []
    radiation = meteo.get("radiation") or []
    for t, rad in zip(times, radiation, strict=False):
        if t >= now_ts - 900:
            return float(rad) if rad is not None else None
    return None


async def fetch_open_meteo(
    session, lat: float, lon: float, api_key: str | None = None
) -> dict | None:
    """Holt die 15-Minuten-Strahlungsprognose von Open-Meteo.

    Erwartet einen eigenen ``api_key``; dieser wird als Parameter ``apikey``
    an den Kunden-Endpunkt (customer-api.open-meteo.com) gesendet.
    Liefert {"times": [epoch, ...], "radiation": [W/m², ...]} oder None.
    """
    params = {
        "latitude": round(lat, 5),
        "longitude": round(lon, 5),
        "minutely_15": "shortwave_radiation",
        "forecast_minutely_15": 192,   # 48 Stunden in 15-min-Schritten
        "timezone": "auto",
    }
    key = (api_key or "").strip()
    if key:
        params["apikey"] = key
    try:
        timeout = 8.0
        async with session.get(
            OPEN_METEO_API_URL if key else OPEN_METEO_URL, params=params, timeout=timeout
        ) as resp:
            if resp.status != 200:
                # Wichtiges Feedback fürs Panel: Ist der eigene Schlüssel
                # falsch (401) oder das Limit erreicht (429), darf PVM nicht
                # still ins lokale Modell fallen – der Nutzer sieht sonst
                # nicht, dass der Schlüssel das Problem ist.
                if key:
                    hint = {
                        401: "API-Schlüssel ungültig (HTTP 401)",
                        403: "Zugriff verweigert (HTTP 403)",
                        429: "Anfragen-Limit erreicht (HTTP 429)",
                    }.get(resp.status, f"Open-Meteo-Fehler (HTTP {resp.status})")
                    return {"error": hint}
                return None
            data = await resp.json()
        times_raw = (data.get("minutely_15") or {}).get("time") or []
        radiation = (data.get("minutely_15") or {}).get("shortwave_radiation") or []
        if not times_raw or not radiation:
            return None
        times = []
        for raw in times_raw:
            try:
                times.append(datetime.fromisoformat(raw).timestamp())
            except (TypeError, ValueError):
                return None
        return {
            "times": times,
            "radiation": [float(v) if v is not None else 0.0 for v in radiation],
        }
    except Exception:  # noqa: BLE001 – offline/Zeitüberschreitung → lokales Modell
        return None


def _epoch_hour(t: float) -> int:
    """Lokale Viertelstunden-Nummer (für Tageszeit-Vergleich)."""
    dt = datetime.fromtimestamp(t)
    return dt.hour * 4 + dt.minute // 15


def build_open_meteo_series(
    times: list[float],
    radiation: list[float],
    factor: float | None,
    now_ts: float,
    horizon_s: int = 3 * 3600,
) -> list[dict]:
    """Baut die PV-Kurve (W) für die nächsten Stunden aus der Prognose."""
    out: list[dict] = []
    for t, rad in zip(times, radiation, strict=False):
        if t < now_ts - 60:
            continue
        if t > now_ts + horizon_s:
            break
        pv = rad * factor if factor is not None else None
        out.append({"t": int(t), "pv_w": round(pv) if pv is not None else None})
    return out


def local_fallback_series(
    history: list[tuple[float, float]], now_ts: float, horizon_s: int = 3 * 3600
) -> list[dict] | None:
    """Lokales Modell: gleiche Tageszeit der letzten Tage als Erwartung.

    ``history`` = [(ts, pv_w), ...] der letzten Tage (max. ~5 Tage sinnvoll).
    """
    if len(history) < 40:
        return None
    now_quarter = _epoch_hour(now_ts)
    out: list[dict] = []
    step_s = 900.0
    # Suche Messungen aus den letzten 5 Tagen zur gleichen Uhrzeit ± 1 Stunde
    window_days = 5
    oldest = now_ts - window_days * 86400.0
    relevant = [(ts, w) for ts, w in history if ts >= oldest and w is not None and w > 5]
    if len(relevant) < 20:
        return None
    for offset in range(0, int(horizon_s // step_s) + 1):
        target = now_ts + offset * step_s
        target_quarter = (now_quarter + offset) % 96
        bucket = []
        for ts, w in relevant:
            # gleiche Viertelstunde ± 2 (≈ 30 min Toleranz)
            if abs(_epoch_hour(ts) - target_quarter) <= 2:
                bucket.append(w)
        if not bucket:
            continue
        bucket.sort()
        median = bucket[len(bucket) // 2]
        out.append({"t": int(target), "pv_w": round(median)})
    return out or None


def split_series(
    series: list[dict],
    now_ts: float,
    horizon_s: int = 3 * 3600,
    end_ts: float | None = None,
) -> list[dict]:
    """Schneidet eine Serie auf einen Zeitraum (Horizont ab jetzt)."""
    out = []
    limit = end_ts if end_ts is not None else now_ts + horizon_s
    for p in series:
        if p["t"] < now_ts - 120:
            continue
        if p["t"] > limit:
            break
        out.append(p)
    return out


def hourly_day_curve(series: list[dict]) -> list[dict]:
    """Vergröbert die 15-min-Serie auf stündliche Werte (Tagessicht)."""
    if not series:
        return []
    out: list[dict] = []
    step_s = 3600
    first = int(series[0]["t"] // step_s) * step_s
    for hour_start in range(first, int(series[-1]["t"]) + 1, step_s):
        bucket = [p["pv_w"] for p in series if hour_start <= p["t"] < hour_start + step_s]
        values = [v for v in bucket if v is not None]
        if not values:
            continue
        out.append({"t": hour_start, "pv_w": round(sum(values) / len(values))})
    return out


def energy_kwh(series: list[dict], step_s: float = 900.0) -> float | None:
    """Summiert eine PV-Kurve (W, 15-min-Auflösung) zu kWh."""
    values = [p["pv_w"] for p in series if p.get("pv_w") is not None]
    if not values:
        return None
    # Wh je Punkt = W * (Schritt/3600) h
    return round(sum(values) * (step_s / 3600.0) / 1000.0, 2)


def recovery_minutes(series: list[dict], live_pv_w: float | None) -> int | None:
    """Wie viele Minuten dauert es, bis die PV laut Prognose wieder steigt?

    None = keine Prognose oder kein kurzer Einbruch (nicht relevant).
    """
    if not series:
        return None
    base = live_pv_w if live_pv_w is not None else (series[0].get("pv_w") or 0.0)
    rising_threshold = max(base * 0.5, base - 200.0)
    # Aktueller Einbruch: erster Punkt niedrig & Prognose steigt bald wieder
    now_pv = series[0].get("pv_w") if len(series) > 0 else None
    if now_pv is None or now_pv > base * 1.05:
        # Gerade keine Wolke (Prognose ≈ Messung) → kein Grund zu halten
        return None
    for i, point in enumerate(series[1:], start=1):
        pv = point.get("pv_w")
        if pv is None:
            continue
        if pv >= rising_threshold and pv >= now_pv * 1.15:
            return i * 15
        if i > 8:  # länger als 2 h weg? → kein „kurzer Einbruch“
            return None
    return None


# ---------------------------------------------------------------------------
# Lernmodell: Sonnenstand → PV-Leistung (kostenlos, ohne API-Schlüssel)
# ---------------------------------------------------------------------------
# Die Prognose funktioniert auch ganz ohne Open-Meteo-Schlüssel:
#  1. PVM berechnet den Sonnenstand (Elevation) für jeden Zeitpunkt selbst.
#  2. Aus den letzten Tagen wird eine „Eichkurve“ gelernt: Wie viel
#     PV-Leistung erzeugt die Anlage bei welchem Sonnenstand (normiert auf
#     die wolkenlose Einstrahlung)?
#  3. Die kostenlose Open-Meteo-Strahlungsprognose skaliert diese Kurve mit
#     dem Wolkenanteil – so entstehen genaue Kurven auch ohne Schlüssel.

ELEV_BIN_DEG = 5.0      # Sonnenstands-Klassengröße (5°) für die Lernkurve
CURVE_MAX_RATIO = 3.0   # nie mehr als 300 % „Wirkungsgrad“ (Schutz vor Ausreißern)


def solar_elevation(lat: float, lon: float, ts: float) -> float:
    """Sonnenhöhe in Grad über dem Horizont (0° = Sonnenaufgang).

    Standardformel nach NOAA (Genauigkeit ≈ ±0,5° – völlig ausreichend für
    eine PV-Prognose). ``ts`` ist ein Unix-Zeitstempel (Sekunden, UTC).
    """
    # Julianisches Datum
    jd = ts / 86400.0 + 2440587.5
    n = jd - 2451545.0
    g = math.radians((357.529 + 0.98560028 * n) % 360.0)
    q = math.radians((280.459 + 0.98564736 * n) % 360.0)
    e = math.radians(23.439 - 0.00000036 * n)
    lam = q + math.radians(1.915 * math.sin(g) + 0.020 * math.sin(2 * g))
    ra = math.atan2(math.cos(e) * math.sin(lam), math.cos(lam))
    dec = math.asin(math.sin(e) * math.sin(lam))
    gmst = (280.46061837 + 360.98564736629 * n) % 360.0
    ha = math.radians(gmst + lon) - ra
    sin_alt = (
        math.sin(dec) * math.sin(math.radians(lat))
        + math.cos(dec) * math.cos(math.radians(lat)) * math.cos(ha)
    )
    return math.degrees(math.asin(max(-1.0, min(1.0, sin_alt))))


def clear_sky_wm2(elev_deg: float) -> float:
    """Grobe wolkenlose Einstrahlung (W/m²) bei gegebener Sonnenhöhe.

    Einfaches Luftmassen-Modell: extraterrestrische Strahlung × Transparenz
    der Atmosphäre – ohne Wolken. Basis für die Normierung der Lernkurve.
    """
    e = max(0.0, float(elev_deg))
    if e <= 0.0:
        return 0.0
    sin_e = math.sin(math.radians(e))
    if sin_e <= 0.02:
        return 0.0
    am = 1.0 / max(0.05, sin_e)          # Luftmasse ≈ 1/sin(h)
    ext = 1361.0 * sin_e                 # extraterrestrisch (W/m²)
    return max(0.0, min(1250.0, ext * (0.7 ** (am * 0.678))))


def learn_elevation_curve(
    history: list[tuple[float, float]],
    lat: float,
    lon: float,
    bin_deg: float = ELEV_BIN_DEG,
) -> dict:
    """Lernt aus den letzten Tagen: PV-Leistung je Sonnenstand.

    Für jeden Messpunkt wird das Verhältnis ``pv / clear_sky(elev)`` gebildet
    und pro Sonnenstands-Klasse (5°) der Median genommen. Ausreißer (z. B.
    Wolkenschatten) verpuffen dadurch. Ergebnis::

        {
          "points": [{"elev": 12.5, "factor": 0.34, "count": 47}, ...],
          "coverage": 1234,   # Anzahl verwerteter Messpunkte
          "days": 6,          # Tage mit Daten
        }
    """
    buckets: dict[int, list[float]] = {}
    days_seen: set[str] = set()
    coverage = 0
    for ts, w in history:
        if w is None or w <= 0:
            continue
        elev = solar_elevation(lat, lon, ts)
        clear = clear_sky_wm2(elev)
        if elev < 2.0 or clear < 10.0:
            continue
        ratio = w / clear
        if ratio <= 0.0:
            continue
        b = int(elev // bin_deg) * bin_deg
        buckets.setdefault(b, []).append(min(CURVE_MAX_RATIO, ratio))
        coverage += 1
        days_seen.add(datetime.fromtimestamp(ts).date().isoformat())
    points = []
    for b in sorted(buckets):
        vals = sorted(buckets[b])
        median = vals[len(vals) // 2]
        points.append({
            "elev": round(b + bin_deg / 2.0, 1),
            "factor": round(median, 4),
            "count": len(vals),
        })
    return {"points": points, "coverage": coverage, "days": len(days_seen)}


def elev_factor(elev: float, curve: dict | None) -> float | None:
    """Interpoliert den gelernten Faktor für eine Sonnenhöhe."""
    pts = (curve or {}).get("points") or []
    if not pts:
        return None
    if elev <= 0.0:
        return 0.0
    if elev <= pts[0]["elev"]:
        return pts[0]["factor"]
    if elev >= pts[-1]["elev"]:
        return pts[-1]["factor"]
    for a, b in zip(pts, pts[1:], strict=False):
        if a["elev"] <= elev <= b["elev"]:
            span = max(1e-6, b["elev"] - a["elev"])
            t = (elev - a["elev"]) / span
            return a["factor"] + t * (b["factor"] - a["factor"])
    return pts[-1]["factor"]


def predict_from_radiation(
    times: list[float],
    radiation: list[float],
    lat: float,
    lon: float,
    curve: dict | None,
    now_ts: float,
    horizon_s: int = 36 * 3600,
) -> list[dict]:
    """PV-Kurve (W) aus Strahlungsprognose × gelernte Sonnenstandskurve.

    pv(t) = clear_sky(elev(t)) · factor(elev(t)) · (rad(t) / clear_sky(elev(t)))

    Der Bruch rad/clear ist der „Wolkenfaktor“ (1 = sonnig, <1 = Wolken).
    Fehlt die Strahlung für einen Zeitpunkt, wird sonnig angenommen.
    """
    out: list[dict] = []
    for t, rad in zip(times, radiation, strict=False):
        if t < now_ts - 60:
            continue
        if t > now_ts + horizon_s:
            break
        elev = solar_elevation(lat, lon, t)
        clear = clear_sky_wm2(elev)
        fac = elev_factor(elev, curve)
        if fac is None:
            out.append({"t": int(t), "pv_w": None})
            continue
        if clear <= 0.0 or elev < 1.0 or fac <= 0.0:
            out.append({"t": int(t), "pv_w": 0})
            continue
        rad_v = rad if rad is not None and rad > 0 else clear
        cloud = max(0.0, min(1.4, rad_v / clear))
        pv = clear * fac * cloud
        out.append({"t": int(t), "pv_w": round(pv)})
    return out


def predict_clear_sky(
    times: list[float],
    lat: float,
    lon: float,
    curve: dict | None,
    now_ts: float,
    horizon_s: int = 36 * 3600,
) -> list[dict]:
    """Ohne Wetterdaten: erwartete PV nur aus Sonnenstand + Lernkurve.

    Dient als Offline-Fallback (Clear-Sky-Schätzung) – konservativ, aber
    deutlich besser als „gar keine Prognose“.
    """
    out: list[dict] = []
    for t in times:
        if t < now_ts - 60:
            continue
        if t > now_ts + horizon_s:
            break
        elev = solar_elevation(lat, lon, t)
        clear = clear_sky_wm2(elev)
        fac = elev_factor(elev, curve)
        if clear <= 0.0 or elev < 1.0 or fac is None or fac <= 0.0:
            out.append({"t": int(t), "pv_w": 0})
            continue
        out.append({"t": int(t), "pv_w": round(clear * fac)})
    return out
