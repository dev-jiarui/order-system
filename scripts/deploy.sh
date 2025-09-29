#!/bin/bash

# 部署脚本，用于手动部署或在CI/CD中调用

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# 配置变量
IMAGE_NAME="order-system"
IMAGE_TAG="${1:-latest}"
DOCKER_REGISTRY="your-registry-url" # 替换为实际的Docker Registry
ENVIRONMENT=${2:-"dev"} # 默认开发环境
COMPOSE_FILE="docker-compose.yml"

# 部署到指定环境
deploy_to_environment() {
    echo -e "${YELLOW}开始部署到${ENVIRONMENT}环境...${NC}"
    echo -e "${YELLOW}使用镜像: ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}${NC}"
    
    # 根据环境选择服务器
    case "$ENVIRONMENT" in
        dev)
            SERVER="user@dev-server"
            ;;  
        test)
            SERVER="user@test-server"
            ;;  
        prod)
            SERVER="user@prod-server"
            echo -e "${YELLOW}警告: 正在部署到生产环境！${NC}"
            ;;  
        *)
            echo -e "${RED}错误: 未知环境: $ENVIRONMENT${NC}"
            exit 1
            ;;  
    esac
    
    # 检查环境配置文件是否存在
    if [ -f ".env.${ENVIRONMENT}" ]; then
        echo -e "${GREEN}发现环境配置文件: .env.${ENVIRONMENT}${NC}"
        # 复制环境配置文件到服务器
        scp ".env.${ENVIRONMENT}" "${SERVER}:~/.env"
    else
        echo -e "${YELLOW}警告: 未找到环境配置文件: .env.${ENVIRONMENT}${NC}"
    fi
    
    # 复制docker-compose文件到服务器
    scp "$COMPOSE_FILE" "${SERVER}:~"
    
    # 执行部署命令
    echo -e "${YELLOW}连接到服务器并执行部署...${NC}"
    ssh "$SERVER" << EOF
        echo "开始部署..."
        
        # 拉取最新镜像
        echo "拉取镜像: ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
        docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
        
        # 停止现有容器
        echo "停止现有容器..."
        docker-compose down || true
        
        # 启动新容器
        echo "启动新容器..."
        docker-compose up -d
        
        # 检查部署状态
        echo "检查容器状态..."
        docker ps | grep order-system
        
        # 检查应用健康状态
        if [ -n "$(command -v curl)" ]; then
            echo "检查应用健康状态..."
            curl -s http://localhost:3000/health || echo "无法访问健康检查端点"
        fi
        
        echo "部署完成"
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}部署成功！${NC}"
        return 0
    else
        echo -e "${RED}部署失败！${NC}"
        return 1
    fi
}

# 回滚部署
rollback() {
    local rollback_tag=${1:-"previous"}
    echo -e "${YELLOW}执行回滚操作，使用镜像标签: ${rollback_tag}${NC}"
    
    # 根据环境选择服务器
    case "$ENVIRONMENT" in
        dev)
            SERVER="user@dev-server"
            ;;  
        test)
            SERVER="user@test-server"
            ;;  
        prod)
            SERVER="user@prod-server"
            echo -e "${RED}警告: 正在回滚生产环境！${NC}"
            ;;  
    esac
    
    # 执行回滚
    ssh "$SERVER" << EOF
        echo "开始回滚..."
        docker-compose down || true
        docker-compose up -d
        echo "回滚完成"
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}回滚成功！${NC}"
        return 0
    else
        echo -e "${RED}回滚失败！${NC}"
        return 1
    fi
}

# 显示帮助信息
show_help() {
    echo "使用方法: $0 [镜像标签] [环境] [操作]"
    echo "参数说明:"
    echo "  镜像标签: 要部署的Docker镜像标签，默认为latest"
    echo "  环境: 部署环境(dev/test/prod)，默认为dev"
    echo "  操作: deploy(部署)/rollback(回滚)，默认为deploy"
    echo ""
    echo "示例:"
    echo "  $0 latest dev deploy    # 部署latest标签的镜像到开发环境"
    echo "  $0 v1.0.0 test deploy   # 部署v1.0.0标签的镜像到测试环境"
    echo "  $0 previous prod rollback  # 回滚生产环境到上一个版本"
}

# 主函数
main() {
    local operation=${3:-"deploy"}
    
    echo -e "${GREEN}================ 订单系统部署脚本 ================${NC}"
    
    case "$operation" in
        deploy)
            deploy_to_environment
            ;;
        rollback)
            rollback "$IMAGE_TAG"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}错误: 未知操作: $operation${NC}"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main