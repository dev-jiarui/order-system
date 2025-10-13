
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 创建非root用户
# RUN addgroup -g 1001 -S nodejs && \
#     adduser -S nodejs -u 1001

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制应用代码
COPY . .

# 更改文件所有者
RUN chown -R nodejs:nodejs /app
USER nodejs

# 暴露应用端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# 启动命令
CMD ["node", "index.js"]