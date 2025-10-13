#!/bin/bash

# 部署脚本 - 支持本地和 Docker 两种模式

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项] <环境>"
    echo ""
    echo "环境:"
    echo "  dev     开发环境"
    echo "  uat     测试环境"
    echo "  prod    生产环境"
    echo ""
    echo "选项:"
    echo "  -d, --docker    使用 Docker 部署"
    echo "  -l, --local     本地部署（默认）"
    echo "  -s, --stop      停止服务"
    echo "  -h, --help      显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 dev                    # 本地开发环境"
    echo "  $0 --docker dev           # Docker 开发环境"
    echo "  $0 --docker --stop prod   # 停止 Docker 生产环境"
}

# 参数解析
DOCKER_MODE=false
STOP_MODE=false
ENVIRONMENT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--docker)
            DOCKER_MODE=true
            shift
            ;;
        -l|--local)
            DOCKER_MODE=false
            shift
            ;;
        -s|--stop)
            STOP_MODE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        dev|uat|prod)
            ENVIRONMENT=$1
            shift
            ;;
        *)
            echo -e "${RED}错误: 未知参数 $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 检查环境参数
if [[ -z "$ENVIRONMENT" ]]; then
    echo -e "${RED}错误: 请指定环境 (dev/uat/prod)${NC}"
    show_help
    exit 1
fi

# 验证环境文件存在
ENV_FILE=".env.$ENVIRONMENT"
if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}错误: 环境文件 $ENV_FILE 不存在${NC}"
    exit 1
fi

echo -e "${GREEN}=== 订单系统部署脚本 ===${NC}"
echo -e "环境: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "模式: ${YELLOW}$([ "$DOCKER_MODE" = true ] && echo "Docker" || echo "本地")${NC}"
echo -e "操作: ${YELLOW}$([ "$STOP_MODE" = true ] && echo "停止" || echo "启动")${NC}"
echo ""

if [[ "$DOCKER_MODE" = true ]]; then
    # Docker 模式
    if [[ "$STOP_MODE" = true ]]; then
        echo -e "${YELLOW}停止 Docker 服务...${NC}"
        if [[ "$ENVIRONMENT" = "prod" ]]; then
            docker-compose --env-file "$ENV_FILE" --profile production down
        else
            docker-compose --env-file "$ENV_FILE" down
        fi
        echo -e "${GREEN}Docker 服务已停止${NC}"
    else
        echo -e "${YELLOW}启动 Docker 服务...${NC}"
        
        # 检查 Docker 是否运行
        if ! docker info > /dev/null 2>&1; then
            echo -e "${RED}错误: Docker 未运行，请先启动 Docker${NC}"
            exit 1
        fi
        
        # 构建镜像（如果需要）
        if [[ ! "$(docker images -q order-system:latest 2> /dev/null)" ]]; then
            echo -e "${YELLOW}构建 Docker 镜像...${NC}"
            docker build -t order-system:latest .
        fi
        
        # 启动服务
        if [[ "$ENVIRONMENT" = "prod" ]]; then
            docker-compose --env-file "$ENV_FILE" --profile production up -d
        else
            docker-compose --env-file "$ENV_FILE" up -d
        fi
        
        echo -e "${GREEN}Docker 服务启动成功${NC}"
        echo ""
        echo -e "${YELLOW}服务状态:${NC}"
        docker-compose --env-file "$ENV_FILE" ps
    fi
else
    # 本地模式
    if [[ "$STOP_MODE" = true ]]; then
        echo -e "${YELLOW}停止本地服务...${NC}"
        # 查找并杀死 Node.js 进程
        pkill -f "node.*index.js" || echo "没有找到运行中的服务"
        echo -e "${GREEN}本地服务已停止${NC}"
    else
        echo -e "${YELLOW}启动本地服务...${NC}"
        
        # 检查 Node.js 是否安装
        if ! command -v node &> /dev/null; then
            echo -e "${RED}错误: Node.js 未安装${NC}"
            exit 1
        fi
        
        # 检查依赖是否安装
        if [[ ! -d "node_modules" ]]; then
            echo -e "${YELLOW}安装依赖...${NC}"
            npm install
        fi
        
        # 设置环境变量并启动
        export NODE_ENV="$ENVIRONMENT"
        echo -e "${GREEN}本地服务启动成功${NC}"
        echo -e "${YELLOW}环境: $ENVIRONMENT${NC}"
        echo -e "${YELLOW}配置文件: $ENV_FILE${NC}"
        echo ""
        
        # 启动应用
        npm start
    fi
fi