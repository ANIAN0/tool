# sandbox-service/src/utils/security.py

"""安全工具模块"""

import hashlib
import os


def validate_path(user_dir: str, relative_path: str) -> str:
    """
    验证路径安全性，防止路径遍历攻击

    Args:
        user_dir: 用户目录
        relative_path: 相对路径

    Returns:
        验证后的完整路径

    Raises:
        ValueError: 路径不安全
    """
    # 规范化路径
    normalized = os.path.normpath(relative_path)

    # 检查是否包含危险路径片段
    if normalized.startswith('..') or os.path.isabs(normalized):
        raise ValueError("Invalid path: path traversal detected")

    # 构建完整路径
    full_path = os.path.join(user_dir, 'workspace', normalized)

    # 再次验证最终路径在工作空间内
    workspace_dir = os.path.join(user_dir, 'workspace')
    if not full_path.startswith(workspace_dir):
        raise ValueError("Invalid path: path escapes workspace")

    return full_path


def hash_user_id(user_id: str) -> str:
    """
    对用户ID进行SHA256哈希处理

    Args:
        user_id: 用户ID

    Returns:
        16字符的哈希字符串
    """
    return hashlib.sha256(user_id.encode()).hexdigest()[:16]