# sandbox-service/src/main.py

"""FastAPI 应用入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.routes.api import router as api_router
from src.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Sandbox Service",
    description="基于 nsjail 的代码沙盒服务",
    version="1.0.0",
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    print(f"[Sandbox] Service starting on port {settings.PORT}")
    print(f"[Sandbox] API Key configured: {'Yes' if settings.API_KEY else 'No'}")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    print("[Sandbox] Service shutting down")