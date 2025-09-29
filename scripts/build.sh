#!/bin/bash

# 构建脚本，用于Jenkins或手动执行构建和部署

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# 配置变量
IMAGE_NAME="order-system"
IMAGE_TAG="$(date +%Y%m%d_%H%M%S)"
DOCKER_REGISTRY="your-registry-url" # 替换为实际的Docker Registry
ENVIRONMENT=${1:-"dev"} # 默认开发环境

# 检查环境变量
check_environment() {
    echo -e "${YELLOW}检查环境配置...${NC}"
    if [ -z "$DOCKER_REGISTRY" ]; then
        echo -e "${RED}错误: DOCKER_REGISTRY 未设置${NC}"
        exit 1
    fi
    
    # 检查Docker是否可用
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: Docker 未安装或不可用${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}环境检查通过${NC}"
}

# 安装依赖
install_dependencies() {
    echo -e "${YELLOW}安装项目依赖...${NC}"
    npm install --production
    if [ $? -ne 0 ]; then
        echo -e "${RED}错误: 依赖安装失败${NC}"
        exit 1
    fi
    echo -e "${GREEN}依赖安装成功${NC}"
}

# 构建Docker镜像
build_image() {
    echo -e "${YELLOW}构建Docker镜像...${NC}"
    docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .
    if [ $? -ne 0 ]; then
        echo -e "${RED}错误: 镜像构建失败${NC}"
        exit 1
    fi
    
    # 为镜像添加标签
    docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${IMAGE_NAME}:${ENVIRONMENT}"
    
    echo -e "${GREEN}镜像构建成功: ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}${NC}"
}

# 推送Docker镜像
push_image() {
    echo -e "${YELLOW}推送Docker镜像到仓库...${NC}"
    docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:${ENVIRONMENT}"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}错误: 镜像推送失败${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}镜像推送成功${NC}"
}

# 部署到服务器
deploy() {
    echo -e "${YELLOW}部署到${ENVIRONMENT}环境...${NC}"
    
    # 根据环境设置服务器信息
    case "$ENVIRONMENT" in
        dev)
            SERVER="user@dev-server"
            ;;  
        test)
            SERVER="user@test-server"
            ;;  
        prod)
            SERVER="user@prod-server"
            # 生产环境可以添加确认步骤
            read -p "确认部署到生产环境? (y/n): " confirm
            if [ "$confirm" != "y" ]; then
                echo -e "${YELLOW}部署已取消${NC}"
                exit 0
            fi
            ;;  
        *)
            echo -e "${RED}错误: 未知环境: $ENVIRONMENT${NC}"
            exit 1
            ;;  
    esac
    
    # 复制docker-compose文件到服务器
    scp docker-compose.yml "${SERVER}:~"
    
    # 登录服务器并执行部署
    ssh "$SERVER" << EOF
        # 拉取镜像
        docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
        
        # 停止并移除旧容器（如果存在）
        docker-compose down || true
        
        # 启动新容器
        docker-compose up -d
        
        # 检查容器状态
        docker ps | grep order-system
EOF
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}错误: 部署失败${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}部署到${ENVIRONMENT}环境成功${NC}"
}

# 主函数
main() {
    echo -e "${GREEN}================ 订单系统构建部署脚本 ================${NC}"
    
    # 执行各步骤
    check_environment
    install_dependencies
    build_image
    push_image
    deploy
    
    echo -e "${GREEN}构建部署完成！${NC}"
}

# 执行主函数
main