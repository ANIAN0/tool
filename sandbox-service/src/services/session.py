# sandbox-service/src/services/session.py

"""会话管理模块"""

import os
import hashlib
import time
import re
import shutil
from typing import Optional
from dataclasses import dataclass, field


SAFE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+$")


@dataclass
class SkillMount:
    """会话内可挂载的只读 Skill"""

    skill_id: str
    host_dir: str
    jail_dir: str


@dataclass
class Session:
    """会话数据类"""

    id: str
    user_id: str
    user_dir: str
    workspace_dir: str
    skill_mounts: dict[str, SkillMount] = field(default_factory=dict)
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
            # 工作空间需要 777：容器内进程映射为 nobody，对 nobody 拥有的目录只是“其他人”
            os.chmod(workspace_dir, 0o777)

    def _hash_user_id(self, user_id: str) -> str:
        """对用户ID进行哈希处理"""
        return hashlib.sha256(user_id.encode()).hexdigest()[:16]

    def _hash_session_id(self, session_id: str) -> str:
        """对会话ID进行哈希处理，避免直接把外部输入作为目录名"""
        return hashlib.sha256(session_id.encode()).hexdigest()[:16]

    def _validate_safe_name(self, value: str, field_name: str) -> None:
        """限制挂载名只包含安全字符，避免构造宿主或沙盒路径逃逸"""
        if not value or not SAFE_NAME_PATTERN.fullmatch(value):
            raise ValueError(f"Invalid {field_name}: only letters, numbers, dot, dash and underscore are allowed")

    def _validate_relative_file_path(self, relative_path: str) -> str:
        """校验 Skill 内部文件路径，避免写出 Skill 缓存目录"""
        normalized = os.path.normpath(relative_path.replace("\\", "/"))
        if normalized == "." or normalized.startswith("..") or os.path.isabs(normalized):
            raise ValueError("Invalid skill file path")
        return normalized

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
        session_hash = self._hash_session_id(session_id)
        user_parent_dir = os.path.join(self.data_root, user_hash)
        user_dir = os.path.join(user_parent_dir, session_hash)
        workspace_dir = os.path.join(user_dir, "workspace")

        # 用户目录保留一层分组，会话目录承载该会话自己的 workspace
        os.makedirs(user_parent_dir, exist_ok=True)
        os.makedirs(workspace_dir, exist_ok=True)
        os.chmod(user_parent_dir, 0o711)
        self._ensure_bind_source_traversable(user_dir, workspace_dir)

        session = Session(
            id=session_id,
            user_id=user_id,
            user_dir=user_dir,
            workspace_dir=workspace_dir,
            created_at=now,
            last_activity=now
        )
        self.sessions[session_id] = session
        return session

    def register_skill_mounts(self, session_id: str, user_id: str, skills: list[dict]) -> list[str]:
        """把 Skill 文件缓存为只读源目录，并注册到会话的 nsjail 挂载表"""
        session = self.get_or_create(session_id, user_id)
        mounted: list[str] = []
        cache_root = os.path.join(self.data_root, "_skills")
        os.makedirs(cache_root, exist_ok=True)
        os.chmod(cache_root, 0o755)

        for skill in skills:
            skill_id = skill["id"]
            self._validate_safe_name(skill_id, "skill id")
            files = skill.get("files") or []
            if not files:
                raise ValueError(f"Skill {skill_id} has no files")

            # fileHash 相同则复用缓存目录；没有 hash 时用内容计算，避免不同版本互相覆盖。
            version_key = skill.get("fileHash") or self._hash_skill_files(skill_id, files)
            self._validate_safe_name(version_key, "skill hash")
            host_dir = os.path.join(cache_root, f"{skill_id}-{version_key}")

            if not os.path.isfile(os.path.join(host_dir, "SKILL.md")):
                self._write_skill_cache(host_dir, files)

            # 挂载目标目录只作为 mount point，不复制 Skill 内容到 workspace。
            jail_dir = f"/workspace/skills/{skill_id}"
            mount_point = os.path.join(session.workspace_dir, "skills", skill_id)
            os.makedirs(mount_point, exist_ok=True)
            os.chmod(os.path.join(session.workspace_dir, "skills"), 0o777)
            os.chmod(mount_point, 0o777)

            session.skill_mounts[skill_id] = SkillMount(
                skill_id=skill_id,
                host_dir=host_dir,
                jail_dir=jail_dir,
            )
            mounted.append(skill_id)

        session.last_activity = time.time()
        return mounted

    def _hash_skill_files(self, skill_id: str, files: list[dict]) -> str:
        """基于 Skill 文件内容生成缓存版本号，避免无 hash 的 Skill 污染已有缓存"""
        digest = hashlib.sha256(skill_id.encode())
        for file in sorted(files, key=lambda item: item["path"]):
            digest.update(file["path"].encode())
            digest.update(b"\0")
            digest.update(file["content"].encode())
            digest.update(b"\0")
        return digest.hexdigest()[:16]

    def _write_skill_cache(self, host_dir: str, files: list[dict]) -> None:
        """写入 Skill 只读缓存目录；替换目录可避免半写入缓存被挂载"""
        tmp_dir = f"{host_dir}.tmp-{os.getpid()}-{int(time.time() * 1000)}"
        if os.path.isdir(tmp_dir):
            shutil.rmtree(tmp_dir)
        os.makedirs(tmp_dir, exist_ok=True)

        try:
            for file in files:
                relative_path = self._validate_relative_file_path(file["path"])
                target_path = os.path.join(tmp_dir, relative_path)
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                with open(target_path, "w", encoding="utf-8") as f:
                    f.write(file["content"])
                os.chmod(target_path, 0o644)

            for root, dirs, _ in os.walk(tmp_dir):
                os.chmod(root, 0o755)
                for directory in dirs:
                    os.chmod(os.path.join(root, directory), 0o755)

            if os.path.isdir(host_dir):
                shutil.rmtree(host_dir)
            os.replace(tmp_dir, host_dir)
        finally:
            if os.path.isdir(tmp_dir):
                shutil.rmtree(tmp_dir)

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
