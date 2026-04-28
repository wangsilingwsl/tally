# 归物 · Tally

个人物品消费管理系统。记录已购物品，追踪日均使用成本，获取保修到期提醒和消费趋势分析。

## 功能

- **物品管理** — 记录物品名称、品牌、型号、购买日期、价格、状态等信息，支持分类和标签
- **日均成本** — 自动计算每件物品的日均使用成本，直观评估性价比
- **资产总览** — 仪表盘展示总资产、整体日均成本、资产估值、状态分布
- **消费统计** — 按月/季/年查看消费趋势折线图、分类占比饼图、折旧分析
- **保修提醒** — 自动扫描即将到期的保修和有效期，站内通知 + 邮件提醒
- **图片管理** — 为物品上传实物照、发票、保修卡，支持拖拽上传和画廊浏览
- **数据导出** — 导出 Excel 或 PDF 格式的物品清单，支持按条件筛选
- **离线优先** — 数据优先存储在本地 IndexedDB，联网后自动同步到云端
- **Docker 部署** — 提供 Docker Compose 一键部署

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 6 |
| 本地存储 | Dexie.js (IndexedDB) |
| 状态管理 | Zustand |
| 图表 | Recharts |
| 后端 | Fastify 5 + TypeScript |
| ORM | Prisma 6 |
| 数据库 | PostgreSQL 16 |
| 认证 | JWT |
| 部署 | Docker Compose (Nginx + API + PostgreSQL) |

## 项目结构

```
├── packages/
│   ├── web/              # 前端 React SPA
│   │   ├── src/
│   │   │   ├── pages/    # 页面组件
│   │   │   ├── components/ # 通用组件
│   │   │   ├── db/       # Dexie 数据库与同步引擎
│   │   │   ├── stores/   # Zustand 状态管理
│   │   │   ├── utils/    # 工具函数
│   │   │   └── styles/   # 全局样式与主题
│   │   └── Dockerfile
│   └── server/           # 后端 Fastify API
│       ├── src/
│       │   ├── routes/   # 路由模块
│       │   ├── plugins/  # Fastify 插件
│       │   ├── schemas/  # JSON Schema 校验
│       │   └── services/ # 业务逻辑（定时任务等）
│       ├── prisma/       # Prisma Schema
│       └── Dockerfile
├── docker-compose.yml
├── .env.example
└── doc/
    └── deploy.md         # 部署说明
```

## 快速开始

### 环境要求

- Node.js >= 18
- PostgreSQL 16
- npm >= 9

### 安装与启动

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example packages/server/.env
# 编辑 packages/server/.env，填写数据库连接等配置

# 初始化数据库
cd packages/server
npx prisma migrate dev
cd ../..

# 启动前后端
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端运行在 `http://localhost:3001`。

### Docker 部署

```bash
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET 和数据库密码

docker compose up -d --build
```

启动后访问 `http://localhost:3000`。

详细部署说明见 [doc/deploy.md](doc/deploy.md)。

## 开发脚本

```bash
npm run dev          # 同时启动前后端
npm run dev:web      # 仅启动前端
npm run dev:server   # 仅启动后端
```

## 设计风格

暖色调羊皮纸质感，参考 Claude (Anthropic) 设计系统：

- 页面背景 `#f5f4ed`（羊皮纸色）
- 卡片背景 `#faf9f5`（象牙白）
- 品牌色 `#c96442`（赤陶色）
- 标题字体 Georgia，正文字体 system-ui

## 许可证

MIT
