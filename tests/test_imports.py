"""Import-Smoke-Test: alle HA-seitigen Module sind importierbar.

Läuft dank der Stubs in ``conftest.py`` ohne echte Home-Assistant-Installation
und deckt Namens-/Importfehler ab, die reine Logik-Tests nicht finden.
"""

import importlib

MODULES = [
    "custom_components.pvm.config_flow",
    "custom_components.pvm.sensor",
    "custom_components.pvm.number",
    "custom_components.pvm.switch",
    "custom_components.pvm.button",
    "custom_components.pvm.select",
    "custom_components.pvm.time",
    "custom_components.pvm.services",
    "custom_components.pvm.diagnostics",
    "custom_components.pvm.store",
    "custom_components.pvm.manager",
    "custom_components.pvm.panel_data",
    "custom_components.pvm.panel",
    "custom_components.pvm.websocket",
    "custom_components.pvm.__init__",
]


def test_all_modules_importable():
    for name in MODULES:
        importlib.import_module(name)


def test_flow_class_exists():
    from custom_components.pvm.config_flow import PVMConfigFlow

    assert PVMConfigFlow.__name__ == "PVMConfigFlow"
    # Bewusst kein Options-Flow: Alle Verwaltung läuft im eigenen Panel.
    assert PVMConfigFlow.VERSION == 1
