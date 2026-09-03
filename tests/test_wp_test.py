"""Tests für die WP-Kalibrierungs-Zustandsmaschine."""

import custom_components.pvm.wp_test as wpt


def make_runner(target: float = 70.0, max_min: float = 120.0, disturb: float = 500.0):
    return wpt.WpTestRunner(
        config=wpt.WpTestConfig(
            target_temp_c=target,
            max_duration_s=max_min * 60.0,
            sample_interval_s=10.0,
            disturbance_w=disturb,
        )
    )


def test_start_sets_running():
    runner = make_runner()
    runner.start(now=0.0, start_temp_c=45.0)
    assert runner.running
    assert runner.status == wpt.STATUS_RUNNING


def test_finish_without_start_returns_idle():
    runner = make_runner()
    result = runner.finish(now=10.0)
    assert result.status == wpt.STATUS_IDLE


def test_target_temp_completes_test():
    runner = make_runner()
    runner.start(0.0, 45.0)
    runner.sample(10.0, 2000.0, 46.0)
    runner.sample(20.0, 2100.0, 50.0)
    status = runner.sample(30.0, 2200.0, 70.0)
    assert status == wpt.STATUS_DONE
    result = runner.finish(40.0, temp_c=70.0)
    assert result.status == wpt.STATUS_DONE
    assert result.end_temp_c == 70.0
    assert result.samples >= 2
    assert result.energy_wh > 0


def test_timeout_ends_test():
    runner = make_runner(max_min=0.02)  # 1.2 s Limit
    runner.start(0.0, 40.0)
    runner.sample(1.0, 2000.0, 41.0)
    status = runner.sample(5.0, 2000.0, 42.0)
    assert status == wpt.STATUS_TIMEOUT


def test_energy_integration_over_intervals():
    runner = make_runner(max_min=10)
    runner.start(0.0, 40.0)
    runner.sample(10.0, 2000.0, 41.0)  # 2000 W * 10 s
    runner.sample(20.0, 2000.0, 45.0)
    result = runner.finish(20.0, temp_c=45.0)
    # 2 * 2000 W * 10 s = 40000 Ws = 11.11 Wh
    assert abs(result.energy_wh - 40000.0 / 3600.0) < 0.01
    assert result.avg_power_w > 0


def test_disturbance_is_filtered():
    runner = make_runner(max_min=10)
    runner.start(0.0, 40.0)
    runner.sample(10.0, 2000.0, 41.0)  # sauber
    # Sprung auf 6000 W (z. B. Waschmaschine) -> gestört
    status = runner.sample(20.0, 6000.0, 41.5)
    assert status == wpt.STATUS_RUNNING
    result = runner.finish(20.0, temp_c=41.5)
    assert result.disturbed_samples == 1
    # Energie nur aus sauberem Sample
    assert abs(result.energy_wh - 2000.0 * 10.0 / 3600.0) < 0.01


def test_abort_returns_aborted():
    runner = make_runner()
    runner.start(0.0, 45.0)
    runner.sample(10.0, 2000.0, 46.0)
    result = runner.finish(now=20.0, temp_c=46.5, aborted=True)
    assert result.status == wpt.STATUS_ABORTED


def test_no_samples_yields_no_data():
    runner = make_runner()
    runner.start(0.0, 45.0)
    result = runner.finish(now=10.0)
    assert result.status == wpt.STATUS_NO_DATA


def test_runner_idle_after_finish():
    runner = make_runner()
    runner.start(0.0, 45.0)
    runner.sample(10.0, 2000.0, 50.0)
    runner.finish(now=20.0, temp_c=50.0)
    assert runner.status == wpt.STATUS_IDLE
    assert not runner.running
