# 归物 · Tally 启动与部署说明

## 一、本地开发

### 1. 环境要求

- Node.js >= 18
- Docker（用于运行 PostgreSQL，无需本地安装数据库）
- npm >= 9

### 2. 一键启动

首次使用只需两步：

```bash
npm install          # 安装依赖
npm start            # 启动全部服务（数据库 + 迁移 + 前后端）
```

`npm start` 会自动完成以下操作：
1. 启动 PostgreSQL Docker 容器
2. 等待数据库就绪
3. 生成 `.env` 配置文件（首次自动生成，无需手动配置）
4. 执行数据库迁移
5. 启动前端（http://localhost:3000）和后端（http://localhost:3001）

之后每次开发，直接 `npm start` 即可。

### 3. 停止服务

按 `Ctrl+C` 停止前后端，然后停止数据库：

```bash
npm run db:stop
```

### 4. 单独启动（可选）

如果只需要启动部分服务：

```bash
npm run db:start     # 仅启动数据库
npm run dev          # 仅启动前后端（需数据库已运行）
npm run dev:web      # 仅启动前端
npm run dev:server   # 仅启动后端
npm run db:migrate   # 仅执行数据库迁移
```

### 5. 环境变量

配置文件位于 `packages/server/.env`，首次启动时自动生成。如需自定义：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接地址 | `postgresql://tally:tally123@localhost:5432/tally` |
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

### 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
cp .env.example .env
```

按需修改各项配置。生产环境务必修改 `JWT_SECRET` 和数据库密码。

### 3. 构建并启动

```bash
docker compose up -d --build
```

该命令会启动三个容器：

| 服务 | 说明 | 默认端口 |
|------|------|----------|
| `web` | 前端 Nginx，提供静态资源和 API 反向代理 | 3000 |
| `server` | 后端 Fastify API 服务 | 3001 |
| `db` | PostgreSQL 16 数据库 | 5432（仅内部访问） |

启动后访问 `http://localhost:3000` 即可使用。

### 4. 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f server

# 停止服务
docker compose down

# 停止并清除数据卷（会删除数据库数据）
docker compose down -v
```

### 5. 数据持久化

Docker Compose 配置了两个持久化卷：

- `pgdata`：PostgreSQL 数据目录
- `uploads`：用户上传的图片文件

执行 `docker compose down` 不会删除这些数据。只有加 `-v` 参数才会清除。
