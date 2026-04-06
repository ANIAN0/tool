# sandbox-service/src/services/sandbox.py

"""沙盒执行模块"""

import asyncio
import tempfile
import os
import time
from typing import Optional

from src.utils.logger import get_logger

# 沙盒执行器日志（写入 /var/log/sandbox/exec.log）
logger = get_logger("sandbox.exec", "exec.log")


class NsjailSandbox:
    """nsjail 沙盒执行器"""

    def __init__(self, config_path: str = "/etc/sandbox/nsjail.conf"):
        self.config_path = config_path
        self.nsjail_path = "/usr/local/bin/nsjail"

    def _filter_system_logs(self, stderr: str) -> str:
        """
        过滤 nsjail 系统日志，只保留用户命令的真实 stderr

        nsjail 系统日志格式：
        - [I][timestamp] - info日志（Mode、Jail parameters、Mount等）
        - [W][timestamp] - warning日志
        - [E][timestamp] - error日志

        Args:
            stderr: 原始 stderr 输出

        Returns:
            过滤后的 stderr（仅用户命令输出）
        """
        if not stderr:
            return stderr

        # 过滤以 [I]、[W]、[E] 开头的系统日志行
        lines = stderr.split('\n')
        filtered_lines = [
            line for line in lines
            if not line.startswith('[I][') and
               not line.startswith('[W][') and
               not line.startswith('[E][')
        ]

        return '\n'.join(filtered_lines).strip()

    def _get_suffix(self, language: str) -> str:
        """获取脚本文件后缀"""
        return {
            "bash": ".sh",
            "python": ".py",
            "node": ".js"
        }.get(language, ".txt")

    def _build_command(
        self,
        script_name: str,
        language: str,
        timeout: int,
        user_hash: str
    ) -> list:
        """
        构建 nsjail 命令

        Args:
            script_name: 脚本文件名（不含路径）
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
            # 动态绑定用户工作空间（读写模式）
            "-B", f"/var/lib/sandbox/users/{user_hash}/workspace:/workspace",
        ]

        # 沙盒内路径：工作区已通过 -B 挂载为 /workspace，禁止传宿主机绝对路径（否则报 No such file）
        jail_script = f"/workspace/{script_name}"

        # 根据语言选择执行器
        if language == "bash":
            cmd.extend(["--", "/bin/bash", jail_script])
        elif language == "python":
            cmd.extend(["--", "/usr/bin/python3", jail_script])
        elif language == "node":
            cmd.extend(["--", "/usr/bin/node", jail_script])
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

        # 临时文件默认 0600；user namespace 映射后进程在宿主上常为 65534，无法读 root 的 600 文件 → Permission denied
        os.chmod(script_path, 0o644)

        try:
            # 仅传文件名；nsjail 内可见路径为 /workspace/<文件名>（与 -B 挂载一致）
            script_basename = os.path.basename(script_path)
            cmd = self._build_command(
                script_name=script_basename,
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

            # 解码输出
            stdout_text = stdout.decode('utf-8', errors='replace')
            stderr_text = stderr.decode('utf-8', errors='replace')

            # 写入完整日志到文件（用于运维排查）
            logger.debug(f"[exec] language={language}, exit_code={proc.returncode}")
            logger.debug(f"[exec] stdout:\n{stdout_text}")
            logger.debug(f"[exec] stderr:\n{stderr_text}")

            return {
                "stdout": stdout_text,
                "stderr": self._filter_system_logs(stderr_text),
                "exit_code": proc.returncode or 0,
                "exec_time_ms": exec_time_ms
            }

        finally:
            # 清理临时文件
            if os.path.exists(script_path):
                os.unlink(script_path)