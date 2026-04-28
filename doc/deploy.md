# 归物 · Tally 启动与部署说明

## 一、本地开发

### 1. 环境要求

- Node.js >= 18
- npm >= 9

无需安装数据库，系统使用 SQLite，数据存储在本地文件中。

### 2. 一键启动

```bash
npm install          # 安装依赖
npm start            # 启动服务
```

`npm start` 会自动完成：
1. 生成 `.env` 配置文件（首次）
2. 创建 SQLite 数据库并执行迁移
3. 启动前端（http://localhost:3000）和后端（http://localhost:3001）

之后每次开发，直接 `npm start` 即可。

### 3. 停止服务

按 `Ctrl+C` 停止。

### 4. 单独启动（可选）

```bash
npm run dev          # 仅启动前后端
npm run dev:web      # 仅启动前端
npm run dev:server   # 仅启动后端
npm run db:migrate   # 仅执行数据库迁移
```

### 5. 数据存储

数据库文件位于 `packages/server/data/tally.db`，上传图片存储在 `packages/server/uploads/`。

备份数据只需复制这两个路径。

### 6. 环境变量

配置文件位于 `packages/server/.env`，首次启动时自动生成。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:./data/tally.db` |
| `JWT_SECRET` | JWT 签名密钥 | `dev-secret-key-change-in-production` |
| `SMTP_HOST` | 邮件服务器地址 | 空（不发送邮件） |
| `SMTP_PORT` | 邮件服务器端口 | `465` |
| `SMTP_USER` | 邮件账号 | 空 |
| `SMTP_PASS` | 邮件密码 | 空 |

---

## 二、Docker 部署

### 1. 环境要求

- Docker >= 20
- Docker Compose >= 2

### 2. 构建并启动

```bash
cp .env.example .env
# 按需修改 JWT_SECRET 等配置

docker compose up -d --build
```

启动后访问 `http://localhost:3000`。

### 3. 常用命令

```bash
docker compose ps          # 查看服务状态
docker compose logs -f     # 查看日志
docker compose down        # 停止服务
```
