#!/bin/bash
# sandbox-service/deploy/install.sh
# nsjail 沙盒服务安装脚本

set -e

echo "=== 沙盒服务安装脚本 ==="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查root权限
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请使用root权限运行此脚本${NC}"
  exit 1
fi

# 1. 安装系统依赖
echo -e "${YELLOW}[1/6] 安装系统依赖...${NC}"
apt update
apt install -y \
    docker.io \
    python3 \
    python3-pip \
    python3-venv \
    curl

# 2. 安装 uv（快速的 Python 包管理器）
echo -e "${YELLOW}[2/6] 安装 uv...${NC}"
if ! command -v uv &> /dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi
echo -e "${GREEN}✓ uv 安装完成${NC}"

# 3. 从 Docker 镜像安装 nsjail
echo -e "${YELLOW}[3/6] 安装 nsjail...${NC}"
if ! command -v nsjail &> /dev/null; then
    docker pull ghcr.io/google/nsjail/nsjail:latest
    docker create --name temp-nsjail ghcr.io/google/nsjail/nsjail:latest
    docker cp temp-nsjail:/usr/bin/nsjail /usr/local/bin/nsjail
    docker rm temp-nsjail
    chmod +x /usr/local/bin/nsjail
fi
echo -e "${GREEN}✓ nsjail 安装完成${NC}"

# 4. 创建目录结构
echo -e "${YELLOW}[4/6] 创建目录结构...${NC}"
mkdir -p /var/lib/sandbox/{rootfs,users}
mkdir -p /var/lib/sandbox/rootfs/{bin,usr/bin,usr/lib,lib/x86_64-linux-gnu,lib64,tmp,var}
mkdir -p /var/lib/sandbox/rootfs/etc/ssl/certs
mkdir -p /etc/sandbox/ssl
mkdir -p /var/log/sandbox
# 711：允许非属主沿路径进入子目录（nsjail bind 源校验常用 outside uid 65534，700 会导致挂载失败）
chmod 711 /var/lib/sandbox/users

# 5. 创建最小化 rootfs
echo -e "${YELLOW}[5/6] 创建 rootfs...${NC}"

# 复制必要的 shell 和基础工具
cp /bin/bash /var/lib/sandbox/rootfs/bin/
cp /bin/sh /var/lib/sandbox/rootfs/bin/ 2>/dev/null || ln -s bash /var/lib/sandbox/rootfs/bin/sh
cp /bin/ls /var/lib/sandbox/rootfs/bin/ 2>/dev/null || true
cp /bin/cat /var/lib/sandbox/rootfs/bin/ 2>/dev/null || true
cp /bin/mkdir /var/lib/sandbox/rootfs/bin/ 2>/dev/null || true
cp /bin/rm /var/lib/sandbox/rootfs/bin/ 2>/dev/null || true

# 复制 Python3 运行时
cp /usr/bin/python3 /var/lib/sandbox/rootfs/usr/bin/
cp -r /usr/lib/python3* /var/lib/sandbox/rootfs/usr/lib/ 2>/dev/null || true

# 复制 Node.js 运行时（如果安装了）
cp /usr/bin/node /var/lib/sandbox/rootfs/usr/bin/ 2>/dev/null || true
cp -r /usr/lib/node_modules /var/lib/sandbox/rootfs/usr/lib/ 2>/dev/null || true

# 复制网络工具
cp /usr/bin/curl /var/lib/sandbox/rootfs/usr/bin/ 2>/dev/null || true
cp /usr/bin/wget /var/lib/sandbox/rootfs/usr/bin/ 2>/dev/null || true

# 复制 CA 证书
cp -r /etc/ssl/certs/* /var/lib/sandbox/rootfs/etc/ssl/certs/ 2>/dev/null || true

# 复制依赖库
copy_deps() {
    local bin=$1
    ldd "$bin" 2>/dev/null | grep -o '/lib[^ ]*' | while read lib; do
        mkdir -p "/var/lib/sandbox/rootfs$(dirname "$lib")"
        cp -n "$lib" "/var/lib/sandbox/rootfs$lib" 2>/dev/null || true
    done
}

for bin in /var/lib/sandbox/rootfs/bin/* /var/lib/sandbox/rootfs/usr/bin/*; do
    [ -x "$bin" ] && copy_deps "$bin"
done

# 移除 setuid 二进制
find /var/lib/sandbox/rootfs -perm -4000 -exec chmod -s {} \; 2>/dev/null || true

# 6. 安装 Python 服务（使用 uv）
echo -e "${YELLOW}[6/6] 安装 sandbox-service...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_SRC="$SCRIPT_DIR/.."

# 使用 uv 创建虚拟环境并安装依赖
uv venv /opt/sandbox-service/venv
source /opt/sandbox-service/venv/bin/activate
uv pip install -r "$SERVICE_SRC/deploy/requirements.txt"

cp -r "$SERVICE_SRC/src" /opt/sandbox-service/
cp -r "$SERVICE_SRC/config" /etc/sandbox/
cp "$SERVICE_SRC/.env.example" /opt/sandbox-service/.env

deactivate

# 安装 systemd 服务
echo -e "${YELLOW}安装 systemd 服务...${NC}"
cp "$SCRIPT_DIR/sandbox-service.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable sandbox-service

# 完成
echo -e "${GREEN}=== 安装完成 ===${NC}"
echo "请编辑 /opt/sandbox-service/.env 配置 API_KEY 和证书"
echo "启动服务: systemctl start sandbox-service"