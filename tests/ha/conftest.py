"""Shared fixtures for the PVM HA component tests."""

from __future__ import annotations

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.pvm.const import CONF_PVM_TOKEN, CONF_PVM_URL, DOMAIN

pytest_plugins = ["pytest_homeassistant_custom_component"]


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Enable loading of custom integrations in every test."""
    yield


@pytest.fixture
def pvm_url() -> str:
    return "http://pvm.local:7000"


@pytest.fixture
def mock_entry(pvm_url: str) -> MockConfigEntry:
    return MockConfigEntry(
        domain=DOMAIN,
        title="PVM",
        data={CONF_PVM_URL: pvm_url, CONF_PVM_TOKEN: "secret-token"},
        unique_id=pvm_url,
    )
