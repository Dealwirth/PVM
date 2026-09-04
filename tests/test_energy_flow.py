"""Tests für die Energiefluss-Berechnung (getrennte vs. kombinierte Netz-Sensoren)."""

from custom_components.pvm.config_model import compute_energy_flow


def test_separate_sensors_export_and_import():
    # Einspeisung 3200 W, Bezug 0 W → Export 3200, Netz −3200
    export, valid, net = compute_energy_flow(
        grid_import=0.0,
        import_valid=True,
        grid_export=3200.0,
        export_valid=True,
    )
    assert valid is True
    assert export == 3200.0
    assert net == -3200.0


def test_separate_sensors_both_directions():
    # Bezug 500 W UND Einspeisung 1200 W (SolarNet kann beides parallel liefern)
    export, valid, net = compute_energy_flow(
        grid_import=500.0,
        import_valid=True,
        grid_export=1200.0,
        export_valid=True,
    )
    assert valid is True
    assert export == 1200.0
    assert net == -700.0  # 500 − 1200


def test_only_import_sensor_means_surplus_unknown():
    # Nur Netzbezug bekannt → Überschuss ist NICHT „0“, sondern unbekannt
    export, valid, net = compute_energy_flow(
        grid_import=2500.0,
        import_valid=True,
        grid_export=None,
        export_valid=False,
    )
    assert valid is False
    assert export == 0.0
    assert net == 2500.0


def test_export_invalid_falls_back_to_import():
    export, valid, net = compute_energy_flow(
        grid_import=1200.0,
        import_valid=True,
        grid_export=None,
        export_valid=False,
        grid_kind="net",
    )
    assert valid is False
    assert net == 1200.0


def test_combined_net_sensor_net_kind():
    # Kombiniert: positiv = Bezug, negativ = Einspeisung
    export, valid, net = compute_energy_flow(grid=-4300.0, grid_valid=True)
    assert valid is True
    assert export == 4300.0
    assert net == -4300.0


def test_combined_export_only_kind():
    # „Nur Einspeisung“: positiv = Einspeisung
    export, valid, net = compute_energy_flow(
        grid=2700.0, grid_valid=True, grid_kind="export_only"
    )
    assert valid is True
    assert export == 2700.0
    assert net == -2700.0


def test_pv_minus_house():
    export, valid, net = compute_energy_flow(
        pv=5200.0, pv_valid=True, house=1800.0, house_valid=True
    )
    assert valid is True
    assert export == 3400.0
    assert net == 0.0


def test_pv_without_house_uses_pv_as_surplus():
    export, valid, net = compute_energy_flow(pv=5200.0, pv_valid=True)
    assert valid is True
    assert export == 5200.0


def test_no_data_is_invalid():
    export, valid, net = compute_energy_flow()
    assert valid is False
    assert export == 0.0
    assert net == 0.0


def test_negative_import_is_clamped():
    # Kaputte/unsinnige Sensoren: nichts Negatives durchreichen
    export, valid, net = compute_energy_flow(
        grid_import=0.0,
        import_valid=True,
        grid_export=0.0,
        export_valid=True,
    )
    assert valid is True
    assert export == 0.0
    assert net == 0.0


def test_combined_inverted_kind():
    # SolarNet-typisch: positiv = Einspeisung, negativ = Bezug
    export, valid, net = compute_energy_flow(
        grid=3200.0, grid_valid=True, grid_kind="inverted"
    )
    assert valid is True
    assert export == 3200.0
    assert net == -3200.0
    # Negativer Wert = Bezug -> keine Einspeisung
    export, valid, net = compute_energy_flow(
        grid=-1400.0, grid_valid=True, grid_kind="inverted"
    )
    assert valid is True
    assert export == 0.0
    assert net == 1400.0


def test_explicit_mode_separate_ignores_combined_sensor():
    # Nutzer wählt „zwei getrennte Sensoren“, ein alter kombinierter Sensor
    # liegt noch im Config (nicht gelöscht) – er darf NICHT mehr zählen.
    export, valid, net = compute_energy_flow(
        grid=8000.0,
        grid_valid=True,
        grid_import=400.0,
        import_valid=True,
        grid_export=2500.0,
        export_valid=True,
        grid_mode="separate",
    )
    assert valid is True
    assert export == 2500.0
    assert net == -2100.0  # 400 - 2500 (kombinierter Sensor wird ignoriert)


def test_explicit_mode_combined_ignores_separate_sensors():
    # Umgekehrt: „ein Sensor“ gewählt, aber Bezug/Einspeisung liegen noch im
    # Config – der kombinierte Wert ist die Wahrheit.
    export, valid, net = compute_energy_flow(
        grid=-5000.0,
        grid_valid=True,
        grid_import=999.0,
        import_valid=True,
        grid_export=999.0,
        export_valid=True,
        grid_mode="combined",
    )
    assert valid is True
    assert export == 5000.0
    assert net == -5000.0
