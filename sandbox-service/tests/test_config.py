# sandbox-service/tests/test_config.py

"""配置模块测试"""

import os
from src.config import Settings, get_settings


def test_default_settings():
    """测试默认配置"""
    settings = Settings()
    assert settings.PORT == 8443
    assert settings.API_KEY == ""
    assert settings.USER_DATA_ROOT == "/var/lib/sandbox/users"


def test_settings_from_env(monkeypatch):
    """测试从环境变量读取配置"""
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("API_KEY", "test-key-123")

    settings = Settings()
    assert settings.PORT == 9000
    assert settings.API_KEY == "test-key-123"


def test_get_settings_singleton():
    """测试配置单例"""
    s1 = get_settings()
    s2 = get_settings()
    assert s1 is s2