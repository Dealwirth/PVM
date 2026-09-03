"""WP-Kalibrierung – Testlauf-Zustandsmaschine (reine Logik).

Der Test heizt die Wärmepumpe bis zur Zieltemperatur (Standard 70 °C) und
misst dabei Leistung und Temperatur. Störungen (z. B. Waschmaschine, die
zusätzlich Strom zieht) werden erkannt und aus der Energiebilanz entfernt.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Statuswerte
STATUS_IDLE = "idle"
STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_TIMEOUT = "timeout"
STATUS_ABORTED = "aborted"
STATUS_NO_DATA = "no_data"

# Ergebnis-/Status-Beschriftungen für das UI
STATUS_LABELS = {
    STATUS_IDLE: "Bereit",
    STATUS_RUNNING: "Läuft",
    STATUS_DONE: "Abgeschlossen",
    STATUS_TIMEOUT: "Zeitüberschreitung",
    STATUS_ABORTED: "Abgebrochen",
    STATUS_NO_DATA: "Keine Messwerte",
}


@dataclass
class WpTestConfig:
    """Konfiguration eines Testlaufs."""

    target_temp_c: float = 70.0
    max_duration_s: float = 120 * 60.0
    sample_interval_s: float = 10.0
    disturbance_w: float = 500.0
    end_power_floor_w: float = 50.0  # Leistung unter diesem Wert = Heizung aus


@dataclass
class WpTestResult:
    """Ergebnis eines abgeschlossenen Testlaufs."""

    status: str
    duration_s: float = 0.0
    energy_wh: float = 0.0
    avg_power_w: float = 0.0
    peak_power_w: float = 0.0
    start_temp_c: float | None = None
    end_temp_c: float | None = None
    samples: int = 0
    disturbed_samples: int = 0
    note: str = ""

    def as_dict(self) -> dict:
        """Serialisierbares Dict für Speicher und Entität."""
        return {
            "status": self.status,
            "status_label": STATUS_LABELS.get(self.status, self.status),
            "duration_s": round(self.duration_s, 1),
            "energy_wh": round(self.energy_wh, 1),
            "avg_power_w": round(self.avg_power_w, 1),
            "peak_power_w": round(self.peak_power_w, 1),
            "start_temp_c": self.start_temp_c,
            "end_temp_c": self.end_temp_c,
            "samples": self.samples,
            "disturbed_samples": self.disturbed_samples,
            "note": self.note,
        }


@dataclass
class WpTestRunner:
    """Zustandsmaschine für einen einzelnen Testlauf."""

    config: WpTestConfig = field(default_factory=WpTestConfig)
    status: str = STATUS_IDLE
    start_ts: float | None = None
    last_sample_ts: float | None = None
    last_clean_power_w: float | None = None
    start_temp_c: float | None = None
    end_temp_c: float | None = None
    _energy_wh: float = 0.0
    _peak_power_w: float = 0.0
    _samples: int = 0
    _disturbed: int = 0

    @property
    def running(self) -> bool:
        """Läuft der Test gerade?"""
        return self.status == STATUS_RUNNING

    def start(self, now: float, start_temp_c: float | None) -> None:
        """Startet den Testlauf."""
        self.status = STATUS_RUNNING
        self.start_ts = now
        self.last_sample_ts = now
        self.start_temp_c = start_temp_c
        self.end_temp_c = None
        self._energy_wh = 0.0
        self._peak_power_w = 0.0
        self._samples = 0
        self._disturbed = 0
        self.last_clean_power_w = None

    def sample(self, now: float, power_w: float | None, temp_c: float | None) -> str:
        """Verarbeitet eine Messung; liefert den aktuellen Status.

        Gültige (nicht gestörte) Messwerte fließen in die Energiebilanz ein.
        """
        if not self.running or self.start_ts is None:
            return self.status

        if self.last_sample_ts is None:
            self.last_sample_ts = now

        # Zeitüberschreitung?
        if now - self.start_ts >= self.config.max_duration_s:
            self.status = STATUS_TIMEOUT
            self.end_temp_c = temp_c
            return self.status

        # Zieltemperatur erreicht?
        if temp_c is not None and temp_c >= self.config.target_temp_c:
            self.status = STATUS_DONE
            self.end_temp_c = temp_c
            return self.status

        # Kein gültiger Messwert (Sensor weg/ungültig)?
        if power_w is None or temp_c is None:
            self.last_sample_ts = now
            return self.status

        dt = max(0.0, now - self.last_sample_ts)
        self.last_sample_ts = now
        self._samples += 1

        # Störung erkennen: Leistungssprung ohne dass die Heizung
        # sinnvoll diese Menge verbrauchen könnte.
        disturbed = False
        if (
            self.last_clean_power_w is not None
            and abs(power_w - self.last_clean_power_w) > self.config.disturbance_w
            and not (
                self.last_clean_power_w <= self.config.end_power_floor_w
                and power_w > self.config.end_power_floor_w
            )
        ):
            # Leistungsrückgang kann normales Takten sein; ein großer
            # *Anstieg* deutet auf einen Fremdverbraucher hin.
            disturbed = power_w > self.last_clean_power_w

        if not disturbed:
            # Energiebilanz über das Intervall integrieren
            self._energy_wh += power_w * dt / 3600.0
            self._peak_power_w = max(self._peak_power_w, power_w)
            self.last_clean_power_w = power_w
        else:
            self._disturbed += 1

        return self.status

    def finish(self, now: float, temp_c: float | None = None, aborted: bool = False) -> WpTestResult:
        """Beendet den Test (manuell oder durch Stopp) und liefert das Ergebnis."""
        if self.status == STATUS_IDLE:
            return WpTestResult(status=STATUS_IDLE)

        if aborted:
            self.status = STATUS_ABORTED
        elif self.status == STATUS_RUNNING:
            # Abbruch ohne Zielerreichung gilt als Abbruch, wenn noch nie
            # Daten kamen, sonst als regulärer Abschluss mit Teilbilanz.
            self.status = STATUS_DONE if self._samples > 0 else STATUS_NO_DATA

        start = self.start_ts if self.start_ts is not None else now
        duration = max(0.0, now - start)
        avg_power = self._energy_wh / (duration / 3600.0) if duration > 0 else 0.0
        result = WpTestResult(
            status=self.status,
            duration_s=duration,
            energy_wh=self._energy_wh,
            avg_power_w=avg_power,
            peak_power_w=self._peak_power_w,
            start_temp_c=self.start_temp_c,
            end_temp_c=temp_c if temp_c is not None else self.end_temp_c,
            samples=self._samples,
            disturbed_samples=self._disturbed,
        )
        if result.status == STATUS_TIMEOUT:
            result.note = "Zeitlimit erreicht – Test wurde beendet."
        elif result.status == STATUS_ABORTED:
            result.note = "Test wurde manuell abgebrochen."
        elif result.samples == 0:
            result.note = "Keine gültigen Messwerte empfangen."
        elif result.disturbed_samples > 0:
            result.note = (
                f"{result.disturbed_samples} gestörte Messwerte erkannt und "
                "herausgerechnet."
            )
        self.status = STATUS_IDLE if self.status in (STATUS_ABORTED, STATUS_DONE, STATUS_NO_DATA, STATUS_TIMEOUT) else self.status
        return result
