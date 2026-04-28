# 归物 · Tally 启动与部署说明

## 一、本地开发

### 1. 环境要求

- Node.js >= 18
- Docker（用于运行 PostgreSQL，无需本地安装数据库）
- npm >= 9

### 2. 安装依赖

在项目根目录执行：

```bash
npm install
```

会自动安装 `packages/web` 和 `packages/server` 两个子包的依赖。

### 3. 配置环境变量

复制环境变量模板并修改：

```bash
cp .env.example packages/server/.env
```

编辑 `packages/server/.env`，填写实际配置：

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接地址 | `postgresql://tally:tally123@localhost:5432/tally` |
| `JWT_SECRET` | JWT 签名密钥 | 任意随机字符串 |
| `SMTP_HOST` | 邮件服务器地址（可选） | `smtp.example.com` |
| `SMTP_PORT` | 邮件服务器端口（可选） | `465` |
| `SMTP_USER` | 邮件账号（可选） | `your-email@example.com` |
| `SMTP_PASS` | 邮件密码（可选） | 邮箱授权码 |

使用默认的 `.env.example` 配置即可直接运行，无需修改。

### 4. 启动数据库

无需本地安装 PostgreSQL，通过 Docker 一键启动：

```bash
npm run db:start
```

该命令会创建并启动一个名为 `tally-db` 的 PostgreSQL 容器（端口 5432）。再次执行会自动复用已有容器。

停止数据库：

```bash
npm run db:stop
```

### 5. 初始化数据库

首次使用或 Schema 变更后执行迁移：

```bash
npm run db:migrate
```

### 6. 启动服务

```bash
# 同时启动前端和后端
npm run dev

# 或分别启动
npm run dev:web      # 前端（http://localhost:3000）
npm run dev:server   # 后端（http://localhost:3001）
```

前端使用 Vite 开发服务器，后端使用 tsx watch 热重载。

### 日常开发流程

每次开发只需三步：

```bash
npm run db:start     # 启动数据库
npm run dev          # 启动前后端
# 开发完成后
npm run db:stop      # 停止数据库（可选）
```

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
