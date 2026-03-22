# sandbox-service/src/services/sandbox.py

"""沙盒执行模块"""

import asyncio
import tempfile
import os
import time
from typing import Optional


class NsjailSandbox:
    """nsjail 沙盒执行器"""

    def __init__(self, config_path: str = "/etc/sandbox/nsjail.conf"):
        self.config_path = config_path
        self.nsjail_path = "/usr/local/bin/nsjail"

    def _get_suffix(self, language: str) -> str:
        """获取脚本文件后缀"""
        return {
            "bash": ".sh",
            "python": ".py",
            "node": ".js"
        }.get(language, ".txt")

    def _build_command(
        self,
        script_path: str,
        workdir: str,
        language: str,
        timeout: int,
        user_hash: str
    ) -> list:
        """
        构建 nsjail 命令

        Args:
            script_path: 脚本文件路径
            workdir: 工作目录
            language: 语言类型
            timeout: 超时秒数
            user_hash: 用户哈希（用于动态挂载）

        Returns:
            nsjail 命令参数列表
        """
        cmd = [
            self.nsjail_path,
            "--config", self.config_path,
            "--time_limit", str(timeout),
            "--cwd", "/workspace",
            # 动态绑定用户工作空间
            "--bindmount", f"/var/lib/sandbox/users/{user_hash}/workspace:/workspace:rw",
        ]

        # 根据语言选择执行器
        if language == "bash":
            cmd.extend(["--", "/bin/bash", script_path])
        elif language == "python":
            cmd.extend(["--", "/usr/bin/python3", script_path])
        elif language == "node":
            cmd.extend(["--", "/usr/bin/node", script_path])
        else:
            raise ValueError(f"Unsupported language: {language}")

        return cmd

    async def exec(
        self,
        code: str,
        language: str,
        workdir: str,
        user_hash: str,
        timeout: int = 60,
        memory_limit: int = 100 * 1024 * 1024  # 100MB
    ) -> dict:
        """
        在沙盒中执行代码

        Args:
            code: 要执行的代码
            language: 语言 (bash/python/node)
            workdir: 工作目录
            user_hash: 用户哈希（用于动态挂载）
            timeout: 超时秒数
            memory_limit: 内存限制字节

        Returns:
            {stdout, stderr, exit_code, exec_time_ms}
        """
        start_time = time.time()

        # 创建临时脚本文件
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix=self._get_suffix(language),
            dir=workdir,
            delete=False
        ) as f:
            f.write(code)
            script_path = f.name

        try:
            # 构建 nsjail 命令
            cmd = self._build_command(
                script_path=script_path,
                workdir=workdir,
                language=language,
                timeout=timeout,
                user_hash=user_hash
            )

            # 执行
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout + 5  # 额外5秒缓冲
                )
            except asyncio.TimeoutError:
                proc.kill()
                raise TimeoutError(f"Execution timed out after {timeout}s")

            exec_time_ms = int((time.time() - start_time) * 1000)

            return {
                "stdout": stdout.decode('utf-8', errors='replace'),
                "stderr": stderr.decode('utf-8', errors='replace'),
                "exit_code": proc.returncode or 0,
                "exec_time_ms": exec_time_ms
            }

        finally:
            # 清理临时文件
            if os.path.exists(script_path):
                os.unlink(script_path)