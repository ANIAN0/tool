# sandbox-service/tests/conftest.py

"""pytest 配置"""

import sys
import os
import pytest
import tempfile

# 确保 src 模块可以被导入
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(autouse=True)
def clear_cache():
    """每个测试前清除配置缓存，确保环境变量更改生效"""
    from src.config import clear_settings_cache
    clear_settings_cache()
    yield
    clear_settings_cache()


@pytest.fixture
def temp_data_root():
    """临时数据目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


from src.services.session import SessionManager


@pytest.fixture
def session_manager(temp_data_root):
    """SessionManager fixture"""
    return SessionManager(data_root=temp_data_root)


from src.services.sandbox import NsjailSandbox


@pytest.fixture
def sandbox():
    """NsjailSandbox fixture"""
    return NsjailSandbox()


from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    """测试客户端"""
    # 设置测试 API Key
    monkeypatch.setenv("API_KEY", "test-api-key")

    from src.main import app
    return TestClient(app)