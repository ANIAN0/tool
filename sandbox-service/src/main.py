# sandbox-service/src/main.py

"""FastAPI 应用入口"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.routes.api import router as api_router
from src.config import get_settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("sandbox")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    settings = get_settings()
    # 启动时执行
    logger.info(f"Service starting on port {settings.PORT}")
    logger.info(f"API Key configured: {'Yes' if settings.API_KEY else 'No'}")
    yield
    # 关闭时执行
    logger.info("Service shutting down")


app = FastAPI(
    title="Sandbox Service",
    description="基于 nsjail 的代码沙盒服务",
    version="1.0.0",
    lifespan=lifespan,
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