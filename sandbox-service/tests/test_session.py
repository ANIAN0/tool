# sandbox-service/tests/test_session.py

"""会话管理测试"""

import time
import pytest
import os
from src.services.session import Session, SessionManager


class TestSession:
    """Session 数据类测试"""

    def test_session_creation(self):
        """测试会话创建"""
        session = Session(
            id="session-123",
            user_id="user-456",
            user_dir="/var/lib/sandbox/users/abc123/def456",
            workspace_dir="/var/lib/sandbox/users/abc123/def456/workspace"
        )
        assert session.id == "session-123"
        assert session.user_id == "user-456"
        assert session.status == "active"

    def test_session_default_values(self):
        """测试默认值"""
        now = time.time()
        session = Session(
            id="session-123",
            user_id="user-456",
            user_dir="/var/lib/sandbox/users/abc123/def456",
            workspace_dir="/var/lib/sandbox/users/abc123/def456/workspace",
            created_at=now,
            last_activity=now
        )
        assert session.status == "active"
        assert session.created_at == now
        assert session.last_activity == now


class TestSessionManagerHash:
    """SessionManager 哈希方法测试"""

    def test_hash_user_id(self, session_manager):
        """测试用户ID哈希"""
        result = session_manager._hash_user_id("user-123")
        assert len(result) == 16
        assert all(c in "0123456789abcdef" for c in result)

    def test_hash_consistency(self, session_manager):
        """测试哈希一致性"""
        hash1 = session_manager._hash_user_id("user-123")
        hash2 = session_manager._hash_user_id("user-123")
        assert hash1 == hash2


class TestSessionManagerGetOrCreate:
    """SessionManager.get_or_create 测试"""

    def test_create_new_session(self, session_manager):
        """测试创建新会话"""
        session = session_manager.get_or_create("session-1", "user-123")

        assert session.id == "session-1"
        assert session.user_id == "user-123"
        assert session.status == "active"

    def test_get_existing_session(self, session_manager):
        """测试获取已存在的会话"""
        # 先创建
        session1 = session_manager.get_or_create("session-1", "user-123")
        # 再获取
        session2 = session_manager.get_or_create("session-1", "user-123")

        assert session1 is session2

    def test_update_activity_on_get(self, session_manager):
        """测试获取时更新活动时间"""
        session1 = session_manager.get_or_create("session-1", "user-123")
        first_activity = session1.last_activity

        time.sleep(0.1)  # 等待一小段时间

        session2 = session_manager.get_or_create("session-1", "user-123")
        assert session2.last_activity > first_activity

    def test_user_dir_created(self, session_manager, temp_data_root):
        """测试用户目录被创建"""
        session = session_manager.get_or_create("session-1", "user-123")

        # 检查用户目录存在
        user_hash = session_manager._hash_user_id("user-123")
        user_dir = os.path.join(temp_data_root, user_hash)
        assert os.path.isdir(user_dir)

        # 检查会话级 workspace 目录存在
        session_hash = session_manager._hash_session_id("session-1")
        workspace_dir = os.path.join(user_dir, session_hash, "workspace")
        assert os.path.isdir(workspace_dir)
        assert session.workspace_dir == workspace_dir

    def test_sessions_have_isolated_workspaces(self, session_manager):
        """测试同一用户的不同会话使用不同 workspace"""
        session1 = session_manager.get_or_create("session-1", "user-123")
        session2 = session_manager.get_or_create("session-2", "user-123")

        assert session1.workspace_dir != session2.workspace_dir
        assert os.path.isdir(session1.workspace_dir)
        assert os.path.isdir(session2.workspace_dir)

    def test_register_skill_mounts(self, session_manager):
        """测试 Skill 注册为只读挂载源，而不是复制到 workspace"""
        session = session_manager.get_or_create("session-1", "user-123")
        mounted = session_manager.register_skill_mounts(
            "session-1",
            "user-123",
            [
                {
                    "id": "skill-1",
                    "fileHash": "abc123",
                    "files": [{"path": "SKILL.md", "content": "# Skill"}],
                }
            ],
        )

        assert mounted == ["skill-1"]
        assert "skill-1" in session.skill_mounts
        assert os.path.isfile(os.path.join(session.skill_mounts["skill-1"].host_dir, "SKILL.md"))
        assert not os.path.isfile(os.path.join(session.workspace_dir, "skills", "skill-1", "SKILL.md"))

    def test_session_ownership_validation(self, session_manager):
        """测试会话归属验证"""
        # 用户 A 创建会话
        session_manager.get_or_create("session-1", "user-a")

        # 用户 B 尝试访问同一会话
        with pytest.raises(PermissionError, match="does not belong to user"):
            session_manager.get_or_create("session-1", "user-b")


class TestSessionManagerOtherMethods:
    """SessionManager 其他方法测试"""

    def test_update_activity(self, session_manager):
        """测试更新活动时间"""
        session = session_manager.get_or_create("session-1", "user-123")
        first_activity = session.last_activity

        time.sleep(0.1)
        session_manager.update_activity("session-1")

        assert session.last_activity > first_activity

    def test_get_session(self, session_manager):
        """测试获取会话"""
        session_manager.get_or_create("session-1", "user-123")

        session = session_manager.get_session("session-1")
        assert session is not None
        assert session.id == "session-1"

    def test_get_nonexistent_session(self, session_manager):
        """测试获取不存在的会话"""
        session = session_manager.get_session("nonexistent")
        assert session is None

    def test_delete_session(self, session_manager):
        """测试删除会话"""
        session_manager.get_or_create("session-1", "user-123")

        result = session_manager.delete_session("session-1")
        assert result is True
        assert session_manager.get_session("session-1") is None

    def test_delete_nonexistent_session(self, session_manager):
        """测试删除不存在的会话"""
        result = session_manager.delete_session("nonexistent")
        assert result is False

    def test_cleanup_expired(self, session_manager):
        """测试清理过期会话"""
        # 创建会话
        session_manager.get_or_create("session-1", "user-123")
        session_manager.get_or_create("session-2", "user-456")

        # 模拟会话过期
        session_manager.sessions["session-1"].last_activity = (
            time.time() - session_manager.idle_timeout - 1
        )

        # 清理
        cleaned = session_manager.cleanup_expired()
        assert cleaned == 1
        assert session_manager.get_session("session-1") is None
        assert session_manager.get_session("session-2") is not None

    def test_verify_ownership(self, session_manager):
        """测试验证会话归属"""
        session_manager.get_or_create("session-1", "user-123")

        assert session_manager.verify_ownership("session-1", "user-123") is True
        assert session_manager.verify_ownership("session-1", "user-456") is False
        assert session_manager.verify_ownership("nonexistent", "user-123") is False
