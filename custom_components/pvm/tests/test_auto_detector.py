"""Tests für den AutoDetector."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from custom_components.pvm.logic.auto_detector import AutoDetector
from custom_components.pvm.device_types.registry import DeviceRegistry
from custom_components.pvm.logic.error_handler import ErrorHandler

@pytest.fixture
def mock_hass():
    hass = MagicMock()
    hass.data = {}
    return hass

@pytest.fixture
def mock_registry(mock_hass):
    registry = MagicMock(spec=DeviceRegistry)
    registry.get_devices_by_type = MagicMock(return_value=[])
    return registry

@pytest.fixture
def mock_error_handler(mock_hass):
    return ErrorHandler(mock_hass)

@pytest.fixture
def auto_detector(mock_hass, mock_registry, mock_error_handler):
    return AutoDetector(mock_hass, mock_registry, mock_error_handler)

def test_initialization(auto_detector):
    assert auto_detector is not None
    assert auto_detector._mapping == {}

@pytest.mark.asyncio
async def test_async_initialize(auto_detector):
    await auto_detector.async_initialize()
    # Assert that initialization logs something or works

@pytest.mark.asyncio
async def test_async_detect_no_devices(auto_detector):
    auto_detector.registry.get_devices_by_type = MagicMock(return_value=[])
    await auto_detector.async_detect()
    assert auto_detector._mapping == {}

@pytest.mark.asyncio
async def test_async_detect_with_wallbox_no_auto(auto_detector):
    mock_wallbox = MagicMock()
    mock_wallbox.device_id = "wallbox_1"
    mock_wallbox.async_get_power = AsyncMock(return_value=2.3)

    auto_detector.registry.get_devices_by_type = MagicMock(side_effect=[
        [mock_wallbox],  # wallboxes
        []              # autos
    ])

    await auto_detector.async_detect()
    assert "wallbox_1" not in auto_detector._mapping

@pytest.mark.asyncio
async def test_async_manual_mapping(auto_detector):
    await auto_detector.async_manual_mapping("wallbox_1", "auto_1")
    assert auto_detector.get_auto_for_wallbox("wallbox_1") == "auto_1"

def test_get_auto_for_wallbox_unknown(auto_detector):
    assert auto_detector.get_auto_for_wallbox("unknown") is None