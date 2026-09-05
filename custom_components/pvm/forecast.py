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

from datetime import datetime

# Open-Meteo: Der offene Endpunkt (api.open-meteo.com) wird von PVM nicht
# mehr genutzt – er ist unzuverlässig (keine Garantie). PVM fragt ausschließ-
# lich den Kunden-Endpunkt mit eigenem API-Schlüssel ab.
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
