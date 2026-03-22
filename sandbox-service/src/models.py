# sandbox-service/src/models.py

"""请求和响应模型"""

from typing import Optional
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """错误响应"""
    success: bool = False
    error: dict


class ExecRequest(BaseModel):
    """执行请求"""
    userId: str
    code: str
    language: str = "bash"


class ExecResponse(BaseModel):
    """执行响应"""
    success: bool = True
    stdout: str
    stderr: str
    exitCode: int
    execTimeMs: int


class ReadFileRequest(BaseModel):
    """读取文件请求"""
    userId: str
    path: str


class ReadFileResponse(BaseModel):
    """读取文件响应"""
    success: bool = True
    content: str


class WriteFileRequest(BaseModel):
    """写入文件请求"""
    userId: str
    path: str
    content: str


class WriteFileResponse(BaseModel):
    """写入文件响应"""
    success: bool = True


class SessionStatus(BaseModel):
    """会话状态"""
    status: str
    lastActivity: int


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    timestamp: str
    version: str