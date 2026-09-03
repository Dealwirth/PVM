"""PVM – Konfigurations-Flow (ein Klick, keine Fragen).

Die Integration wird ohne Wizard angelegt – alle Messungen, Geräte und
Einstellungen verwaltet der Nutzer in der eigenen **PV-Manager-Seite**
(Sidebar-Panel). Deshalb gibt es bewusst keinen Options-Flow mehr.
"""

from __future__ import annotations

from homeassistant import config_entries

from .const import DOMAIN, NAME


class PVMConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Konfigurations-Flow für PVM (ein Klick, keine Fragen)."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Legt den Eintrag direkt an – alles Weitere läuft in der Seite."""
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")
        return self.async_create_entry(title=NAME, data={})
