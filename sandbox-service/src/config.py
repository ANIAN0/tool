# sandbox-service/src/config.py

"""配置管理模块"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )

    # 服务配置
    PORT: int = 8443
    NODE_ENV: str = "development"

    # 认证配置
    API_KEY: str = ""

    # 用户数据存储
    USER_DATA_ROOT: str = "/var/lib/sandbox/users"

    # 会话配置
    IDLE_TIMEOUT_MS: int = 1800000  # 30分钟

    # 安全配置
    MAX_CODE_SIZE: int = 1048576  # 1MB
    MAX_FILE_SIZE: int = 10485760  # 10MB
    MAX_STORAGE_PER_USER: int = 1073741824  # 1GB

    # nsjail 配置
    NSJAIL_CONFIG_PATH: str = "/etc/sandbox/nsjail.conf"
    NSJAIL_PATH: str = "/usr/local/bin/nsjail"

    # 日志配置
    LOG_FILE: str = "/var/log/sandbox/audit.log"


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


def clear_settings_cache() -> None:
    """清除配置缓存（供测试使用）"""
    get_settings.cache_clear()