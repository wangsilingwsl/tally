FROM node:20-alpine

WORKDIR /app

# 先复制依赖文件和 Prisma Schema，利用 Docker 缓存层
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci

# 生成 Prisma Client
RUN npx prisma generate

# 复制源码
COPY . .

# 编译 TypeScript
RUN npm run build

# 创建 uploads 目录（Docker 卷挂载点）
RUN mkdir -p /app/uploads/originals /app/uploads/thumbnails

EXPOSE 3001

# 启动服务（先执行数据库迁移，再启动）
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
