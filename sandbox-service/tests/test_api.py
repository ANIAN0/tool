# sandbox-service/tests/test_api.py

"""API 路由测试"""

import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """健康检查端点测试"""

    def test_health_check(self, client):
        """测试健康检查"""
        response = client.get("/api/v1/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data


class TestExecEndpoint:
    """执行端点测试"""

    def test_exec_missing_auth(self, client):
        """测试缺少认证"""
        response = client.post(
            "/api/v1/sessions/test-session/exec",
            json={"userId": "user-123", "code": "echo test", "language": "bash"}
        )
        assert response.status_code == 401

    def test_exec_invalid_auth(self, client, monkeypatch):
        """测试无效认证"""
        monkeypatch.setenv("API_KEY", "correct-key")

        response = client.post(
            "/api/v1/sessions/test-session/exec",
            json={"userId": "user-123", "code": "echo test", "language": "bash"},
            headers={"Authorization": "Bearer wrong-key"}
        )
        assert response.status_code == 401


class TestSessionStatusEndpoint:
    """会话状态端点测试"""

    def test_status_missing_auth(self, client):
        """测试缺少认证"""
        response = client.get("/api/v1/sessions/test-session/status")
        assert response.status_code == 401