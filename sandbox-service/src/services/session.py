# sandbox-service/src/services/session.py

"""会话管理模块"""

import os
import hashlib
import time
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class Session:
    """会话数据类"""

    id: str
    user_id: str
    user_dir: str
    status: str = "active"
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)


class SessionManager:
    """会话管理器"""

    def __init__(self, data_root: str = "/var/lib/sandbox/users"):
        self.data_root = data_root
        self.sessions: dict[str, Session] = {}
        self.idle_timeout = 30 * 60  # 30分钟
        # 顶层 users 若为 700，nsjail 以 65534 校验路径时无法进入，需在服务启动时统一放宽为可穿越
        if os.path.isdir(self.data_root):
            os.chmod(self.data_root, 0o711)

    def _ensure_bind_source_traversable(self, user_dir: str, workspace_dir: str) -> None:
        """
        nsjail 做 bind mount 时，源路径在宿主侧会以 uid/gid 映射中的 outside 身份校验；
        目录若为 700，nobody(65534) 无法穿越，挂载失败。

        权限说明：
        - user_dir: 711 仅开放路径穿越位（不暴露其他用户的目录列表）
        - workspace_dir: 777 允许所有人读写执行（容器内 root 映射为宿主 nobody，
          对 nobody 拥有的目录只是"其他人"，需要 others 有写权限才能创建文件/目录）
        """
        os.chmod(user_dir, 0o711)
        if os.path.isdir(workspace_dir):
            # 工作空间需要 777：容器内进程映射为 nobody，对 nobody 拥有的目录只是"其他人"
            os.chmod(workspace_dir, 0o777)

    def _hash_user_id(self, user_id: str) -> str:
        """对用户ID进行哈希处理"""
        return hashlib.sha256(user_id.encode()).hexdigest()[:16]

    def get_or_create(self, session_id: str, user_id: str) -> Session:
        """
        获取或创建会话

        安全说明：会话创建时绑定 user_id，后续访问验证归属
        """
        now = time.time()

        if session_id in self.sessions:
            session = self.sessions[session_id]
            # 验证会话归属：防止用户访问其他用户的会话
            if session.user_id != user_id:
                raise PermissionError(
                    f"Session {session_id} does not belong to user {user_id}"
                )
            session.last_activity = now
            ws = os.path.join(session.user_dir, "workspace")
            self._ensure_bind_source_traversable(session.user_dir, ws)
            return session

        # 创建新会话
        user_hash = self._hash_user_id(user_id)
        user_dir = os.path.join(self.data_root, user_hash)
        workspace_dir = os.path.join(user_dir, "workspace")

        # 确保目录存在
        os.makedirs(workspace_dir, exist_ok=True)
        self._ensure_bind_source_traversable(user_dir, workspace_dir)

        session = Session(
            id=session_id,
            user_id=user_id,
            user_dir=user_dir,
            created_at=now,
            last_activity=now
        )
        self.sessions[session_id] = session
        return session

    def verify_ownership(self, session_id: str, user_id: str) -> bool:
        """验证会话归属"""
        session = self.sessions.get(session_id)
        return session is not None and session.user_id == user_id

    def update_activity(self, session_id: str):
        """更新会话活动时间"""
        if session_id in self.sessions:
            self.sessions[session_id].last_activity = time.time()

    def get_session(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        return self.sessions.get(session_id)

    def delete_session(self, session_id: str) -> bool:
        """删除会话（不删除用户数据）"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False

    def cleanup_expired(self) -> int:
        """
        清理过期会话
        返回清理的会话数量
        """
        now = time.time()
        expired = [
            sid for sid, session in self.sessions.items()
            if now - session.last_activity > self.idle_timeout
        ]
        for sid in expired:
            del self.sessions[sid]
        return len(expired)