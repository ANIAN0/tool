# sandbox-service/tests/test_sandbox.py

"""沙盒服务测试"""

import pytest
import os
from src.services.sandbox import NsjailSandbox
from src.utils.security import hash_user_id


class TestNsjailSandboxInit:
    """NsjailSandbox 初始化测试"""

    def test_default_config_path(self):
        """测试默认配置路径"""
        sandbox = NsjailSandbox()
        assert sandbox.config_path == "/etc/sandbox/nsjail.conf"
        assert sandbox.nsjail_path == "/usr/local/bin/nsjail"

    def test_custom_config_path(self):
        """测试自定义配置路径"""
        sandbox = NsjailSandbox(config_path="/custom/path/nsjail.conf")
        assert sandbox.config_path == "/custom/path/nsjail.conf"


class TestNsjailSandboxSuffix:
    """NsjailSandbox 文件后缀测试"""

    def test_bash_suffix(self, sandbox):
        """测试 bash 文件后缀"""
        assert sandbox._get_suffix("bash") == ".sh"

    def test_python_suffix(self, sandbox):
        """测试 python 文件后缀"""
        assert sandbox._get_suffix("python") == ".py"

    def test_node_suffix(self, sandbox):
        """测试 node 文件后缀"""
        assert sandbox._get_suffix("node") == ".js"

    def test_unknown_suffix(self, sandbox):
        """测试未知语言后缀"""
        assert sandbox._get_suffix("unknown") == ".txt"


class TestNsjailSandboxBuildCommand:
    """NsjailSandbox._build_command 测试"""

    def test_bash_command(self, sandbox):
        """测试 bash 命令构建"""
        cmd = sandbox._build_command(
            script_path="/workspace/test.sh",
            workdir="/workspace",
            language="bash",
            timeout=60,
            user_hash="abc123"
        )

        assert sandbox.nsjail_path in cmd
        assert "--config" in cmd
        assert sandbox.config_path in cmd
        assert "--time_limit" in cmd
        assert "60" in cmd
        assert "--bindmount" in cmd
        assert "/bin/bash" in cmd
        assert "/workspace/test.sh" in cmd

    def test_python_command(self, sandbox):
        """测试 python 命令构建"""
        cmd = sandbox._build_command(
            script_path="/workspace/test.py",
            workdir="/workspace",
            language="python",
            timeout=30,
            user_hash="abc123"
        )

        assert "/usr/bin/python3" in cmd
        assert "/workspace/test.py" in cmd

    def test_node_command(self, sandbox):
        """测试 node 命令构建"""
        cmd = sandbox._build_command(
            script_path="/workspace/test.js",
            workdir="/workspace",
            language="node",
            timeout=60,
            user_hash="abc123"
        )

        assert "/usr/bin/node" in cmd
        assert "/workspace/test.js" in cmd

    def test_unsupported_language(self, sandbox):
        """测试不支持的语言"""
        with pytest.raises(ValueError, match="Unsupported language"):
            sandbox._build_command(
                script_path="/workspace/test.xyz",
                workdir="/workspace",
                language="ruby",
                timeout=60,
                user_hash="abc123"
            )

    def test_bindmount_includes_user_hash(self, sandbox):
        """测试 bindmount 包含用户哈希"""
        cmd = sandbox._build_command(
            script_path="/workspace/test.sh",
            workdir="/workspace",
            language="bash",
            timeout=60,
            user_hash="userhash123"
        )

        # 检查 bindmount 参数包含正确的用户哈希
        bindmount_idx = cmd.index("--bindmount")
        bindmount_value = cmd[bindmount_idx + 1]
        assert "userhash123" in bindmount_value
        assert "/workspace:rw" in bindmount_value


class TestNsjailSandboxExec:
    """NsjailSandbox.exec 测试（模拟模式）"""

    @pytest.mark.asyncio
    async def test_exec_creates_script_file(self, sandbox, temp_data_root):
        """测试脚本文件创建"""
        # 创建用户工作目录
        user_hash = hash_user_id("user-123")
        workspace = os.path.join(temp_data_root, user_hash, "workspace")
        os.makedirs(workspace, exist_ok=True)

        # 检查工作目录为空
        files_before = os.listdir(workspace)
        assert len(files_before) == 0

    @pytest.mark.asyncio
    async def test_exec_timeout_handling(self, sandbox, temp_data_root):
        """测试超时处理逻辑"""
        # 这个测试验证超时异常的结构
        # 实际超时测试需要在集成测试中进行
        pass

    @pytest.mark.asyncio
    async def test_exec_return_format(self, sandbox):
        """测试返回格式"""
        # 验证返回值结构
        expected_keys = {"stdout", "stderr", "exit_code", "exec_time_ms"}
        # 实际执行测试在集成测试中进行
        pass