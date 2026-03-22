# sandbox-service/tests/test_auth.py

"""认证中间件测试"""

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from src.middleware.auth import verify_api_key


class TestVerifyApiKey:
    """API Key 验证测试"""

    def test_valid_api_key(self, monkeypatch):
        """测试有效的 API Key"""
        monkeypatch.setenv("API_KEY", "test-key-123")

        app = FastAPI()

        @app.get("/protected")
        async def protected(request: Request):
            await verify_api_key(request)
            return {"status": "ok"}

        client = TestClient(app)
        response = client.get("/protected", headers={"Authorization": "Bearer test-key-123"})
        assert response.status_code == 200

    def test_missing_api_key(self, monkeypatch):
        """测试缺少 API Key"""
        monkeypatch.setenv("API_KEY", "test-key-123")

        app = FastAPI()

        @app.get("/protected")
        async def protected(request: Request):
            await verify_api_key(request)
            return {"status": "ok"}

        client = TestClient(app)
        response = client.get("/protected")
        assert response.status_code == 401

    def test_invalid_api_key(self, monkeypatch):
        """测试无效的 API Key"""
        monkeypatch.setenv("API_KEY", "test-key-123")

        app = FastAPI()

        @app.get("/protected")
        async def protected(request: Request):
            await verify_api_key(request)
            return {"status": "ok"}

        client = TestClient(app)
        response = client.get("/protected", headers={"Authorization": "Bearer wrong-key"})
        assert response.status_code == 401

    def test_malformed_auth_header(self, monkeypatch):
        """测试格式错误的认证头"""
        monkeypatch.setenv("API_KEY", "test-key-123")

        app = FastAPI()

        @app.get("/protected")
        async def protected(request: Request):
            await verify_api_key(request)
            return {"status": "ok"}

        client = TestClient(app)
        response = client.get("/protected", headers={"Authorization": "InvalidFormat"})
        assert response.status_code == 401