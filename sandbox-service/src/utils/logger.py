# sandbox-service/src/utils/logger.py

"""日志工具模块"""

import os
import logging
from datetime import datetime
from typing import Optional

# 日志目录（使用 systemd 允许的路径）
LOG_DIR = "/var/log/sandbox"

# 确保日志目录存在
os.makedirs(LOG_DIR, exist_ok=True)

# 日志格式
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def get_logger(name: str, log_file: Optional[str] = None) -> logging.Logger:
    """
    获取配置好的日志器

    Args:
        name: 日志器名称
        log_file: 日志文件名（不含路径），默认为 app.log

    Returns:
        配置好的日志器
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # 避免重复添加 handler
    if logger.handlers:
        return logger

    # 日志文件名
    if log_file is None:
        log_file = "app.log"

    log_path = os.path.join(LOG_DIR, log_file)

    # 文件处理器
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    logger.addHandler(file_handler)

    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    logger.addHandler(console_handler)

    return logger


# 创建默认日志器
default_logger = get_logger("sandbox")


def log_request(logger: logging.Logger, method: str, path: str, **kwargs):
    """记录请求日志"""
    params = " | ".join([f"{k}={v}" for k, v in kwargs.items() if v is not None])
    logger.info(f"[{method}] {path} | {params}")


def log_error(logger: logging.Logger, error: Exception, context: dict = None):
    """记录错误日志"""
    import traceback
    logger.error(f"错误类型: {type(error).__name__}")
    logger.error(f"错误信息: {str(error)}")
    if context:
        logger.error(f"上下文: {context}")
    logger.error(f"堆栈追踪:\n{traceback.format_exc()}")