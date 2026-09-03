# Entwicklung

## Projektstruktur

```

PVM/
├── custom_components/pvm/
│   ├── init.py          # Einstiegspunkt
│   ├── manifest.json        # Metadaten
│   ├── config_flow.py       # Setup-Wizard
│   ├── const.py             # Konstanten
│   ├── sensor.py            # Sensoren
│   ├── switch.py            # Schalter
│   ├── services.yaml        # Service-Definitionen
│   ├── services.py          # Service-Implementierungen
│   ├── device_types/        # Gerätetypen
│   │   ├── base.py          # Basisklasse
│   │   ├── wallbox.py       # Wallbox
│   │   ├── auto.py          # Auto
│   │   ├── waermepumpe.py   # Wärmepumpe
│   │   ├── verbraucher.py   # Verbraucher
│   │   └── registry.py      # Registry
│   ├── logic/               # Logikmodule
│   │   ├── priority_engine.py
│   │   ├── load_balancer.py
│   │   ├── scheduler.py
│   │   ├── auto_detector.py
│   │   └── error_handler.py
│   ├── dashboard/           # Dashboard
│   │   ├── dashboard_creator.py
│   │   └── lovelace_cards.yaml
│   ├── translations/        # Übersetzungen
│   │   └── de.json
│   └── tests/               # Tests
└── docs/                    # Dokumentation

```

## Neues Gerät hinzufügen

1. Erstelle eine neue Datei im Ordner `device_types/`
2. Definiere die Klasse (erbt von `BaseDevice`)
3. Implementiere die Methoden:
   - `async_get_power()`
   - `async_turn_on()`
   - `async_turn_off()`
   - `async_set_power()` (optional)
4. Registriere das Gerät in `registry.py`

## Code-Stil
- **Async/Await** für alle I/O-Operationen
- **Type Hints** für alle Funktionen
- **Docstrings** in Google-Style
- Keine externen Abhängigkeiten außer Home Assistant Core

## Tests
- `pytest` für alle Module
- Testabdeckung > 80 % (Ziel)
- Tests im `tests/`-Ordner

## Pull Requests
1. Branche von `dev` abzweigen
2. Änderungen dokumentieren
3. Tests durchlaufen lassen
4. Pull Request öffnen