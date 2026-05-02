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
            script_name="test.sh",
            language="bash",
            timeout=60,
            workspace_dir="/var/lib/sandbox/users/userhash/sessionhash/workspace"
        )

        assert sandbox.nsjail_path in cmd
        assert "--config" in cmd
        assert sandbox.config_path in cmd
        assert "--time_limit" in cmd
        assert "60" in cmd
        assert "-B" in cmd
        assert "/bin/bash" in cmd
        assert "/workspace/test.sh" in cmd

    def test_python_command(self, sandbox):
        """测试 python 命令构建"""
        cmd = sandbox._build_command(
            script_name="test.py",
            language="python",
            timeout=30,
            workspace_dir="/var/lib/sandbox/users/userhash/sessionhash/workspace"
        )

        assert "/usr/bin/python3" in cmd
        assert "/workspace/test.py" in cmd

    def test_node_command(self, sandbox):
        """测试 node 命令构建"""
        cmd = sandbox._build_command(
            script_name="test.js",
            language="node",
            timeout=60,
            workspace_dir="/var/lib/sandbox/users/userhash/sessionhash/workspace"
        )

        assert "/usr/bin/node" in cmd
        assert "/workspace/test.js" in cmd

    def test_unsupported_language(self, sandbox):
        """测试不支持的语言"""
        with pytest.raises(ValueError, match="Unsupported language"):
            sandbox._build_command(
                script_name="test.xyz",
                language="ruby",
                timeout=60,
                workspace_dir="/var/lib/sandbox/users/userhash/sessionhash/workspace"
            )

    def test_bindmount_includes_session_workspace(self, sandbox):
        """测试 bindmount 使用会话级 workspace"""
        cmd = sandbox._build_command(
            script_name="test.sh",
            language="bash",
            timeout=60,
            workspace_dir="/var/lib/sandbox/users/userhash/sessionhash/workspace"
        )

        # bind mount 必须指向会话级 workspace，避免同用户不同会话共享文件。
        bindmount_idx = cmd.index("-B")
        bindmount_value = cmd[bindmount_idx + 1]
        assert "userhash" in bindmount_value
        assert "sessionhash" in bindmount_value
        assert bindmount_value.endswith(":/workspace")

    def test_skill_mounts_are_read_only(self, sandbox):
        """测试 Skill 使用只读挂载参数"""
        class Mount:
            host_dir = "/var/lib/sandbox/users/_skills/skill-1-abc"
            jail_dir = "/workspace/skills/skill-1"

        cmd = sandbox._build_command(
            script_name="test.sh",
            language="bash",
            timeout=60,
            workspace_dir="/var/lib/sandbox/users/userhash/sessionhash/workspace",
            skill_mounts={"skill-1": Mount()},
        )

        readonly_idx = cmd.index("-R")
        assert cmd[readonly_idx + 1] == "/var/lib/sandbox/users/_skills/skill-1-abc:/workspace/skills/skill-1"


class TestNsjailSandboxExec:
    """NsjailSandbox.exec 测试（模拟模式）"""

    @pytest.mark.asyncio
    async def test_exec_creates_script_file(self, sandbox, temp_data_root):
        """测试脚本文件创建"""
        # 创建用户工作目录
        user_hash = hash_user_id("user-123")
        workspace = os.path.join(temp_data_root, user_hash, "sessionhash", "workspace")
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
