#!/bin/bash
# 一键启动开发环境：配置 → 迁移 → 前后端

set -e

echo "🔧 归物 · Tally 开发环境启动中..."

# 1. 配置环境变量（首次自动生成）
if [ ! -f packages/server/.env ]; then
  echo "📝 生成 .env 配置文件..."
  cat > packages/server/.env << 'EOF'
DATABASE_URL=file:./data/tally.db
JWT_SECRET=dev-secret-key-change-in-production
EOF
fi

# 2. 执行数据库迁移（SQLite 自动创建数据库文件）
echo "🗄️  初始化数据库..."
cd packages/server
npx prisma migrate dev --skip-generate > /dev/null 2>&1 || npx prisma migrate deploy > /dev/null 2>&1
npx prisma generate > /dev/null 2>&1
cd ../..

# 3. 启动前后端
echo "🚀 启动服务..."
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:3001"
echo ""
npm run dev
