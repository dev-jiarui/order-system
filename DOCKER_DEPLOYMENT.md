# Docker 部署指南

## 概述

本项目使用单一的 `docker-compose.yml` 文件配合现有的环境配置文件来管理多环境部署，实现了配置的统一管理。

## 环境配置文件

复用现有的应用环境配置文件，已扩展支持 Docker 部署：
- `.env.dev` - 开发环境配置（包含 Docker 配置）
- `.env.uat` - 测试环境配置（包含 Docker 配置）
- `.env.prod` - 生产环境配置（包含 Docker 配置）

## 部署命令

### 开发环境
```bash
# 启动开发环境
docker-compose --env-file .env.dev up -d

# 停止开发环境
docker-compose --env-file .env.dev down

# 查看日志
docker-compose --env-file .env.dev logs -f
```

### 测试环境
```bash
# 启动测试环境
docker-compose --env-file .env.uat up -d

# 停止测试环境
docker-compose --env-file .env.uat down
```

### 生产环境
```bash
# 启动生产环境（包含 Nginx）
docker-compose --env-file .env.prod --profile production up -d

# 仅启动应用和数据库（不包含 Nginx）
docker-compose --env-file .env.prod up -d

# 停止生产环境
docker-compose --env-file .env.prod --profile production down
```

## 环境变量说明

### 应用配置
- `NODE_ENV`: 运行环境 (dev/uat/prod)
- `IMAGE_NAME`: Docker 镜像名称
- `IMAGE_TAG`: Docker 镜像标签
- `CONTAINER_NAME`: 容器名称
- `APP_PORT`: 主机端口映射
- `PORT`: 容器内应用端口

### 数据库配置
- `MONGODB_URI`: MongoDB 连接字符串
- `MONGO_INITDB_DATABASE`: 初始化数据库名
- `MONGODB_MAX_POOL_SIZE`: 连接池最大连接数
- `MONGODB_SERVER_SELECTION_TIMEOUT`: 服务器选择超时
- `MONGODB_SOCKET_TIMEOUT`: Socket 超时

### 安全配置
- `JWT_SECRET`: JWT 密钥
- `MONGO_ROOT_USERNAME`: MongoDB 管理员用户名（生产环境）
- `MONGO_ROOT_PASSWORD`: MongoDB 管理员密码（生产环境）

### 资源限制
- `CPU_LIMIT`: CPU 使用限制
- `MEMORY_LIMIT`: 内存使用限制
- `CPU_RESERVATION`: CPU 预留
- `MEMORY_RESERVATION`: 内存预留

## 生产环境特殊配置

### Nginx 反向代理
生产环境包含 Nginx 服务，需要：
1. 创建 `nginx/nginx.conf` 配置文件
2. 准备 SSL 证书放在 `nginx/ssl/` 目录

### 环境变量
生产环境的敏感信息通过系统环境变量注入：
```bash
export JWT_SECRET_PROD="your-super-secure-jwt-secret"
export MONGO_ROOT_USERNAME="admin"
export MONGO_ROOT_PASSWORD="secure-password"
export FUNCTIONGRAPH_ACCESS_KEY_PROD="prod-access-key"
export FUNCTIONGRAPH_SECRET_KEY_PROD="prod-secret-key"
```

## 健康检查

所有环境都配置了健康检查：
- 应用健康检查：通过 `healthcheck.js` 脚本
- MongoDB 健康检查：通过 `mongosh` 命令

## 数据持久化

- MongoDB 数据：`mongo-data` 卷
- 应用日志：`./logs` 目录
- 数据库备份：`./backups` 目录

## 配置统一管理


### 配置切换
```bash
# 本地开发（直接运行）
NODE_ENV=dev npm start

# Docker 开发环境
docker-compose --env-file .env.dev up -d

# 两种方式使用相同的配置文件
```

## 监控和日志

```bash
# 查看所有服务状态
docker-compose --env-file .env.prod ps

# 查看特定服务日志
docker-compose --env-file .env.prod logs -f order-system

# 查看资源使用情况
docker stats
```

## 故障排除

### 常见问题
1. **端口冲突**：修改 `.env` 文件中的 `APP_PORT` 配置
2. **权限问题**：确保 Docker 有足够权限访问挂载目录
3. **内存不足**：调整 `CPU_LIMIT` 和 `MEMORY_LIMIT` 配置

### 调试命令
```bash
# 进入容器调试
docker-compose --env-file .env.dev exec order-system sh

# 查看容器详细信息
docker inspect order-system-dev

# 重建镜像
docker-compose --env-file .env.dev build --no-cache
```