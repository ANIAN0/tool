# sandbox-service/src/routes/api.py

"""API 路由"""

from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends, HTTPException
from src.middleware.auth import verify_api_key
from src.services.session import SessionManager
from src.services.sandbox import NsjailSandbox
from src.utils.security import validate_path, hash_user_id
from src.models import (
    ExecRequest, ExecResponse,
    ReadFileRequest, ReadFileResponse,
    WriteFileRequest, WriteFileResponse,
    SessionStatus, ErrorResponse
)
from src.config import get_settings

router = APIRouter()

# 会话管理器实例
session_manager = SessionManager()

# 沙盒执行器实例
sandbox = NsjailSandbox()


@router.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "version": "1.0.0"
    }


@router.post("/sessions/{session_id}/exec")
async def exec_code(
    session_id: str,
    request: ExecRequest,
    req: Request,
    _: None = Depends(verify_api_key)
):
    """执行代码"""
    # 获取或创建会话
    try:
        session = session_manager.get_or_create(session_id, request.userId)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    # 验证语言支持
    if request.language not in ["bash", "python", "node"]:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_LANGUAGE",
                    "message": f"Unsupported language: {request.language}"
                }
            }
        )

    # 获取用户哈希
    user_hash = hash_user_id(request.userId)
    workdir = session.user_dir + "/workspace"

    # 执行代码
    try:
        result = await sandbox.exec(
            code=request.code,
            language=request.language,
            workdir=workdir,
            user_hash=user_hash,
            timeout=60
        )

        return ExecResponse(
            success=True,
            stdout=result["stdout"],
            stderr=result["stderr"],
            exitCode=result["exit_code"],
            execTimeMs=result["exec_time_ms"]
        )
    except TimeoutError as e:
        raise HTTPException(
            status_code=408,
            detail={
                "success": False,
                "error": {
                    "code": "TIMEOUT",
                    "message": str(e)
                }
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "EXEC_ERROR",
                    "message": str(e)
                }
            }
        )


@router.post("/sessions/{session_id}/read")
async def read_file(
    session_id: str,
    request: ReadFileRequest,
    req: Request,
    _: None = Depends(verify_api_key)
):
    """读取文件"""
    # 获取会话
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "error": {
                    "code": "SESSION_NOT_FOUND",
                    "message": f"Session {session_id} not found"
                }
            }
        )

    # 验证会话归属
    if session.user_id != request.userId:
        raise HTTPException(
            status_code=403,
            detail={
                "success": False,
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Session does not belong to user"
                }
            }
        )

    # 验证路径
    try:
        file_path = validate_path(session.user_dir, request.path)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_PATH",
                    "message": str(e)
                }
            }
        )

    # 读取文件
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return ReadFileResponse(success=True, content=content)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "error": {
                    "code": "FILE_NOT_FOUND",
                    "message": f"File {request.path} not found"
                }
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "READ_ERROR",
                    "message": str(e)
                }
            }
        )


@router.post("/sessions/{session_id}/write")
async def write_file(
    session_id: str,
    request: WriteFileRequest,
    req: Request,
    _: None = Depends(verify_api_key)
):
    """写入文件"""
    # 获取会话
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "error": {
                    "code": "SESSION_NOT_FOUND",
                    "message": f"Session {session_id} not found"
                }
            }
        )

    # 验证会话归属
    if session.user_id != request.userId:
        raise HTTPException(
            status_code=403,
            detail={
                "success": False,
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Session does not belong to user"
                }
            }
        )

    # 验证路径
    try:
        file_path = validate_path(session.user_dir, request.path)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_PATH",
                    "message": str(e)
                }
            }
        )

    # 写入文件
    try:
        # 确保目录存在
        import os
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(request.content)

        return WriteFileResponse(success=True)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "WRITE_ERROR",
                    "message": str(e)
                }
            }
        )


@router.post("/sessions/{session_id}/heartbeat")
async def heartbeat(
    session_id: str,
    req: Request,
    _: None = Depends(verify_api_key)
):
    """发送心跳"""
    session_manager.update_activity(session_id)
    return {"success": True}


@router.get("/sessions/{session_id}/status")
async def get_status(
    session_id: str,
    req: Request,
    _: None = Depends(verify_api_key)
):
    """获取会话状态"""
    session = session_manager.get_session(session_id)

    if not session:
        return {"status": "not_found", "lastActivity": 0}

    return {
        "status": session.status,
        "lastActivity": int(session.last_activity * 1000)
    }