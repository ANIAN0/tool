# sandbox-service/src/routes/api.py

"""API 路由"""

import os
import posixpath
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from src.middleware.auth import verify_api_key
from src.models import (
    ExecRequest,
    ExecResponse,
    ReadFileRequest,
    ReadFileResponse,
    SkillMountRequest,
    SkillMountResponse,
    WriteFileRequest,
    WriteFileResponse,
)
from src.services.sandbox import NsjailSandbox
from src.services.session import Session, SessionManager
from src.utils.logger import get_logger
from src.utils.security import validate_path

router = APIRouter()

logger = get_logger("api")
session_manager = SessionManager()
sandbox = NsjailSandbox()


@router.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "version": "1.0.0",
    }


@router.post("/sessions/{session_id}/exec")
async def exec_code(
    session_id: str,
    request: ExecRequest,
    req: Request,
    _: None = Depends(verify_api_key),
):
    """执行代码"""
    try:
        session = session_manager.get_or_create(session_id, request.userId)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if request.language not in ["bash", "python", "node"]:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_LANGUAGE",
                    "message": f"Unsupported language: {request.language}",
                },
            },
        )

    try:
        result = await sandbox.exec(
            code=request.code,
            language=request.language,
            workdir=session.workspace_dir,
            skill_mounts=session.skill_mounts,
            timeout=60,
        )

        return ExecResponse(
            success=True,
            stdout=result["stdout"],
            stderr=result["stderr"],
            exitCode=result["exit_code"],
            execTimeMs=result["exec_time_ms"],
        )
    except TimeoutError as e:
        raise HTTPException(
            status_code=408,
            detail={
                "success": False,
                "error": {
                    "code": "TIMEOUT",
                    "message": str(e),
                },
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "EXEC_ERROR",
                    "message": str(e),
                },
            },
        )


@router.post("/sessions/{session_id}/skills")
async def register_skills(
    session_id: str,
    request: SkillMountRequest,
    req: Request,
    _: None = Depends(verify_api_key),
):
    """注册会话级 Skill 只读挂载"""
    try:
        # 只缓存 Skill 源目录；workspace 内仅创建 mount point，不复制 Skill 文件。
        mounted = session_manager.register_skill_mounts(
            session_id,
            request.userId,
            [skill.model_dump() for skill in request.skills],
        )
        return SkillMountResponse(success=True, mountedSkills=mounted)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_SKILL_MOUNT",
                    "message": str(e),
                },
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "SKILL_MOUNT_ERROR",
                    "message": str(e),
                },
            },
        )


def resolve_skill_file(session: Session, relative_path: str) -> str | None:
    """把 skills/{skillId}/... 的读取请求映射到只读 Skill 缓存"""
    normalized = posixpath.normpath(relative_path.replace("\\", "/"))
    if normalized.startswith("/") or normalized == ".." or normalized.startswith("../"):
        return None

    parts = normalized.split("/")
    if len(parts) < 3 or parts[0] != "skills":
        return None

    mount = session.skill_mounts.get(parts[1])
    if not mount:
        return None

    inner_path = os.path.normpath("/".join(parts[2:]))
    if inner_path == "." or inner_path.startswith("..") or os.path.isabs(inner_path):
        raise ValueError("Invalid path: path traversal detected")

    full_path = os.path.join(mount.host_dir, inner_path)
    if not os.path.realpath(full_path).startswith(os.path.realpath(mount.host_dir)):
        raise ValueError("Invalid path: path escapes skill mount")
    return full_path


@router.post("/sessions/{session_id}/read")
async def read_file(
    session_id: str,
    request: ReadFileRequest,
    req: Request,
    _: None = Depends(verify_api_key),
):
    """读取文件"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "error": {
                    "code": "SESSION_NOT_FOUND",
                    "message": f"Session {session_id} not found",
                },
            },
        )

    if session.user_id != request.userId:
        raise HTTPException(
            status_code=403,
            detail={
                "success": False,
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Session does not belong to user",
                },
            },
        )

    try:
        # Skill 路径读只读缓存，普通路径仍限制在会话 workspace 内。
        file_path = resolve_skill_file(session, request.path) or validate_path(
            session.user_dir,
            request.path,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_PATH",
                    "message": str(e),
                },
            },
        )

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return ReadFileResponse(success=True, content=content)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "error": {
                    "code": "FILE_NOT_FOUND",
                    "message": f"File {request.path} not found",
                },
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "READ_ERROR",
                    "message": str(e),
                },
            },
        )


@router.post("/sessions/{session_id}/write")
async def write_file(
    session_id: str,
    request: WriteFileRequest,
    req: Request,
    _: None = Depends(verify_api_key),
):
    """写入文件"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "error": {
                    "code": "SESSION_NOT_FOUND",
                    "message": f"Session {session_id} not found",
                },
            },
        )

    if session.user_id != request.userId:
        raise HTTPException(
            status_code=403,
            detail={
                "success": False,
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Session does not belong to user",
                },
            },
        )

    if request.path.replace("\\", "/").startswith("skills/"):
        raise HTTPException(
            status_code=403,
            detail={
                "success": False,
                "error": {
                    "code": "READ_ONLY_SKILL",
                    "message": "Skill mount is read-only",
                },
            },
        )

    try:
        file_path = validate_path(session.user_dir, request.path)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_PATH",
                    "message": str(e),
                },
            },
        )

    try:
        dir_path = os.path.dirname(file_path)
        logger.info(f"[Write] file_path: {file_path}")
        logger.info(f"[Write] dir_path: {dir_path}")
        logger.info(f"[Write] content length: {len(request.content)} bytes")

        if dir_path:
            os.makedirs(dir_path, mode=0o777, exist_ok=True)
            logger.info(f"[Write] 目录已创建或确认: {dir_path}")

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(request.content)

        logger.info(f"[Write] 文件写入成功: {file_path}")
        return WriteFileResponse(success=True)
    except Exception as e:
        import traceback

        logger.error(f"[Write] 写入失败: {file_path}")
        logger.error(f"[Write] 错误类型: {type(e).__name__}")
        logger.error(f"[Write] 错误信息: {str(e)}")
        logger.error(f"[Write] 堆栈追踪:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "WRITE_ERROR",
                    "message": str(e),
                    "type": type(e).__name__,
                },
            },
        )


@router.post("/sessions/{session_id}/heartbeat")
async def heartbeat(
    session_id: str,
    req: Request,
    _: None = Depends(verify_api_key),
):
    """发送心跳"""
    session_manager.update_activity(session_id)
    return {"success": True}


@router.get("/sessions/{session_id}/status")
async def get_status(
    session_id: str,
    req: Request,
    _: None = Depends(verify_api_key),
):
    """获取会话状态"""
    session = session_manager.get_session(session_id)
    if not session:
        return {"status": "not_found", "lastActivity": 0}

    return {
        "status": session.status,
        "lastActivity": int(session.last_activity * 1000),
    }
