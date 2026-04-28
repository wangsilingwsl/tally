#!/bin/bash
# 一键启动开发环境：数据库 → 迁移 → 前后端

set -e

echo "🔧 归物 · Tally 开发环境启动中..."

# 1. 启动数据库容器
echo "📦 启动 PostgreSQL..."
if docker inspect tally-db > /dev/null 2>&1; then
  docker start tally-db > /dev/null 2>&1 || true
else
  docker run -d --name tally-db \
    -e POSTGRES_USER=tally \
    -e POSTGRES_PASSWORD=tally123 \
    -e POSTGRES_DB=tally \
    -p 5432:5432 \
    postgres:16-alpine > /dev/null
fi

# 2. 等待数据库就绪
echo "⏳ 等待数据库就绪..."
for i in $(seq 1 30); do
  if docker exec tally-db pg_isready -U tally > /dev/null 2>&1; then
    echo "✅ 数据库已就绪"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ 数据库启动超时"
    exit 1
  fi
  sleep 1
done

# 3. 配置环境变量（首次自动生成）
if [ ! -f packages/server/.env ]; then
  echo "📝 生成 .env 配置文件..."
  cat > packages/server/.env << 'EOF'
DATABASE_URL=postgresql://tally:tally123@localhost:5432/tally
JWT_SECRET=dev-secret-key-change-in-production
EOF
fi

# 4. 执行数据库迁移
echo "🗄️  执行数据库迁移..."
cd packages/server
npx prisma migrate dev --skip-generate > /dev/null 2>&1 || npx prisma migrate deploy > /dev/null 2>&1
npx prisma generate > /dev/null 2>&1
cd ../..

# 5. 启动前后端
echo "🚀 启动前后端服务..."
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:3001"
echo ""
npm run dev
