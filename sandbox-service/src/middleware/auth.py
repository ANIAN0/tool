# sandbox-service/src/middleware/auth.py

"""认证中间件"""

from fastapi import Request, HTTPException
from src.config import get_settings


async def verify_api_key(request: Request) -> None:
    """
    验证 API Key

    Raises:
        HTTPException: 认证失败
    """
    settings = get_settings()

    # 获取 Authorization 头
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Missing Authorization header"
                }
            }
        )

    # 解析 Bearer token
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid Authorization header format"
                }
            }
        )

    token = parts[1]

    # 验证 API Key
    if token != settings.API_KEY:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid API key"
                }
            }
        )