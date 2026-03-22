# sandbox-service/tests/test_security.py

"""安全工具测试"""

import os
import pytest
from src.utils.security import validate_path, hash_user_id


class TestValidatePath:
    """路径验证测试"""

    def test_valid_path(self):
        """测试有效路径"""
        user_dir = "/var/lib/sandbox/users/abc123"
        result = validate_path(user_dir, "test.txt")
        expected = os.path.join(user_dir, "workspace", "test.txt")
        assert result == expected

    def test_valid_nested_path(self):
        """测试有效的嵌套路径"""
        user_dir = "/var/lib/sandbox/users/abc123"
        result = validate_path(user_dir, "subdir/test.txt")
        expected = os.path.join(user_dir, "workspace", "subdir", "test.txt")
        assert result == expected

    def test_path_traversal_dotdot(self):
        """测试路径遍历攻击（..）"""
        user_dir = "/var/lib/sandbox/users/abc123"
        with pytest.raises(ValueError, match="path traversal"):
            validate_path(user_dir, "../etc/passwd")

    def test_path_traversal_absolute(self):
        """测试绝对路径攻击"""
        user_dir = "/var/lib/sandbox/users/abc123"
        with pytest.raises(ValueError, match="Invalid path"):
            validate_path(user_dir, "/etc/passwd")

    def test_path_traversal_complex(self):
        """测试复杂的路径遍历攻击"""
        user_dir = "/var/lib/sandbox/users/abc123"
        with pytest.raises(ValueError, match="Invalid path"):
            validate_path(user_dir, "subdir/../../other_user/file.txt")


class TestHashUserId:
    """用户ID哈希测试"""

    def test_hash_consistency(self):
        """测试哈希一致性"""
        hash1 = hash_user_id("user-123")
        hash2 = hash_user_id("user-123")
        assert hash1 == hash2

    def test_hash_uniqueness(self):
        """测试哈希唯一性"""
        hash1 = hash_user_id("user-123")
        hash2 = hash_user_id("user-456")
        assert hash1 != hash2

    def test_hash_length(self):
        """测试哈希长度"""
        result = hash_user_id("user-123")
        assert len(result) == 16

    def test_hash_is_hex(self):
        """测试哈希是十六进制"""
        result = hash_user_id("user-123")
        assert all(c in "0123456789abcdef" for c in result)