"""Zentrale Fehlerbehandlung und Logging."""

import logging
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

class ErrorHandler:
    """Singleton für Fehlerbehandlung."""

    _instance = None

    def __new__(cls, hass: HomeAssistant):
        if cls._instance is None:
            cls._instance = super(ErrorHandler, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, hass: HomeAssistant):
        if self._initialized:
            return
        self.hass = hass
        self._error_count = 0
        self._consecutive_errors = 0
        self._initialized = True

    def log_error(self, module: str, message: str, exception: Exception = None):
        """Protokolliert einen Fehler."""
        _LOGGER.error(f"[{module}] {message}")
        if exception:
            _LOGGER.error(f"Exception: {exception}")
        self._error_count += 1
        self._consecutive_errors += 1

    def log_warning(self, module: str, message: str):
        """Protokolliert eine Warnung."""
        _LOGGER.warning(f"[{module}] {message}")

    def log_info(self, module: str, message: str):
        """Protokolliert eine Info."""
        _LOGGER.info(f"[{module}] {message}")

    def reset_consecutive_errors(self):
        """Setzt den Zähler für aufeinanderfolgende Fehler zurück."""
        self._consecutive_errors = 0

    @property
    def consecutive_errors(self) -> int:
        return self._consecutive_errors

    @property
    def total_errors(self) -> int:
        return self._error_count