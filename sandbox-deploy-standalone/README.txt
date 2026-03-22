# 沙盒服务独立部署包

这是 sandbox-gateway 的独立部署包，包含了部署所需的所有文件。

## 目录结构

```
sandbox-deploy-standalone/
├── gateway/                 # Sandbox Gateway 服务代码
│   ├── package.json         # Node.js 依赖
│   ├── .env.example         # 环境变量模板
│   └── src/                 # 源代码
├── systemd/                 # systemd 服务配置
│   ├── zeroboot.service
│   └── sandbox-gateway.service
├── deploy.sh                # 一键部署脚本
└── .env.example             # 环境变量配置模板
```

## 快速部署

### 1. 上传到服务器

```bash
# 方式一：使用 scp
scp -r sandbox-deploy-standalone user@your-server:/opt/

# 方式二：使用 rsync
rsync -avz sandbox-deploy-standalone user@your-server:/opt/
```

### 2. 执行部署脚本

```bash
ssh user@your-server
cd /opt/sandbox-deploy-standalone
sudo bash deploy.sh
```

### 3. 配置 API Key

```bash
# 编辑配置文件
sudo nano /opt/sandbox-gateway/.env

# 修改以下配置项
API_KEY=your-secure-api-key-here

# 重启服务
sudo systemctl restart sandbox-gateway
```

## 系统要求

- **操作系统**: Ubuntu 22.04 LTS 或更高版本
- **CPU**: 支持 VT-x/AMD-V 虚拟化
- **内存**: 最低 4GB，推荐 8GB+
- **磁盘**: 最低 20GB

## 需要提前准备

### Zeroboot

Zeroboot 需要单独下载安装：

1. 访问 https://github.com/anthropics/zeroboot/releases
2. 下载对应平台的二进制文件
3. 部署脚本会提示你放置位置：`/usr/local/bin/zeroboot`

```bash
# 下载示例
wget https://github.com/anthropics/zeroboot/releases/download/v1.0.0/zeroboot-linux-amd64
chmod +x zeroboot-linux-amd64
sudo mv zeroboot-linux-amd64 /usr/local/bin/zeroboot
```

## 验证部署

```bash
# 检查服务状态
sudo systemctl status sandbox-gateway

# 检查健康状态
curl http://localhost:8080/health

# 预期响应
# {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

## 与 AgentChat 集成

在 AgentChat 服务器的 `.env.local` 中添加：

```bash
SANDBOX_ENABLED=true
SANDBOX_GATEWAY_URL=http://your-sandbox-server:8080
SANDBOX_API_KEY=your-secure-api-key
```

## 故障排查

```bash
# 查看日志
sudo journalctl -u sandbox-gateway -f

# 检查端口
sudo lsof -i :8080

# 检查 KVM 支持
grep -E '(vmx|svm)' /proc/cpuinfo
```

## 详细文档

完整文档请参考 `gateway/README.md`