# sandbox-service/tests/conftest.py

"""pytest 配置"""

import sys
import os
import pytest
import tempfile

# 确保 src 模块可以被导入
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


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