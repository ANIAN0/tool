#!/bin/bash
# deploy/sandbox-deploy/deploy.sh
# 沙盒服务一键部署脚本

set -e

echo "=== 沙盒服务部署脚本 ==="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查root权限
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请使用root权限运行此脚本${NC}"
  exit 1
fi

# 1. 检查系统环境
echo -e "${YELLOW}[1/9] 检查系统环境...${NC}"
if ! grep -E '(vmx|svm)' /proc/cpuinfo > /dev/null; then
  echo -e "${RED}错误: CPU不支持虚拟化或未启用VT-x/AMD-V${NC}"
  exit 1
fi
echo -e "${GREEN}✓ CPU支持虚拟化${NC}"

# 2. 安装系统依赖
echo -e "${YELLOW}[2/9] 安装系统依赖...${NC}"
apt update
apt install -y curl wget git build-essential libssl-dev pkg-config \
    qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils

# 3. 创建zeroboot用户
echo -e "${YELLOW}[3/9] 创建系统用户...${NC}"
if ! id "zeroboot" &>/dev/null; then
  useradd --system --no-create-home --shell /bin/false \
      --comment "Zeroboot Service" zeroboot
fi
mkdir -p /var/lib/zeroboot/{templates,users,logs}
mkdir -p /var/run/zeroboot
chown -R zeroboot:zeroboot /var/lib/zeroboot
chown -R zeroboot:zeroboot /var/run/zeroboot
chmod 700 /var/lib/zeroboot/users

# 4. 安装Node.js
echo -e "${YELLOW}[4/9] 安装Node.js...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
fi
echo "Node.js版本: $(node --version)"

# 5. 安装Zeroboot（需要用户下载）
echo -e "${YELLOW}[5/9] 安装Zeroboot...${NC}"
if [ ! -f /usr/local/bin/zeroboot ]; then
  echo -e "${YELLOW}请手动下载Zeroboot并放置到 /usr/local/bin/zeroboot${NC}"
  echo "下载地址: https://github.com/anthropics/zeroboot/releases"
  read -p "已完成Zeroboot安装? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 6. 安装Gateway服务
echo -e "${YELLOW}[6/9] 安装Sandbox Gateway...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_SRC="$SCRIPT_DIR/../../sandbox-gateway"

if [ -d "$GATEWAY_SRC" ]; then
  mkdir -p /opt/sandbox-gateway
  cp -r "$GATEWAY_SRC"/* /opt/sandbox-gateway/
  cd /opt/sandbox-gateway
  npm install --production
  chown -R zeroboot:zeroboot /opt/sandbox-gateway
else
  echo -e "${RED}错误: 找不到Gateway源代码${NC}"
  exit 1
fi

# 7. 配置环境变量
echo -e "${YELLOW}[7/9] 配置环境变量...${NC}"
if [ ! -f /opt/sandbox-gateway/.env ]; then
  cp "$SCRIPT_DIR/config/.env.example" /opt/sandbox-gateway/.env
  echo -e "${YELLOW}请编辑 /opt/sandbox-gateway/.env 配置API密钥${NC}"
fi

# 8. 安装systemd服务
echo -e "${YELLOW}[8/9] 安装systemd服务...${NC}"
cp "$SCRIPT_DIR/systemd/zeroboot.service" /etc/systemd/system/
cp "$SCRIPT_DIR/systemd/sandbox-gateway.service" /etc/systemd/system/
systemctl daemon-reload

# 9. 启动服务
echo -e "${YELLOW}[9/9] 启动服务...${NC}"
systemctl enable zeroboot sandbox-gateway
systemctl start zeroboot
sleep 3
systemctl start sandbox-gateway

# 验证
echo -e "${GREEN}=== 部署完成 ===${NC}"
echo "Gateway地址: http://localhost:8080"
echo "Zeroboot地址: http://127.0.0.1:8081 (仅内网)"
echo ""
echo "常用命令:"
echo "  查看日志: journalctl -u sandbox-gateway -f"
echo "  重启服务: systemctl restart sandbox-gateway"
echo "  查看状态: systemctl status sandbox-gateway"