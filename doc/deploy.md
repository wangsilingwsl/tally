# 归物 · Tally 启动与部署说明

## 一、本地开发

### 1. 环境要求

- Node.js >= 18
- PostgreSQL 16（本地安装或 Docker 运行均可）
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

### 4. 初始化数据库

```bash
cd packages/server
npx prisma migrate dev
```

### 5. 启动服务

项目根目录提供三个开发脚本：

```bash
# 仅启动前端（默认 http://localhost:5173）
npm run dev:web

# 仅启动后端（默认 http://localhost:3001）
npm run dev:server

# 同时启动前端和后端
npm run dev
```

前端使用 Vite 开发服务器，后端使用 tsx watch 热重载。

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
