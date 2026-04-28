import Fastify, { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import categoryRoutes from './routes/categories.js';
import imageRoutes from './routes/images.js';
import reminderRoutes from './routes/reminders.js';
import { startReminderCron } from './services/reminderCron.js';

/**
 * 统一错误响应格式
 */
interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * 构建 Fastify 应用实例
 * 抽取为独立函数，方便测试时复用
 */
export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // 注册 CORS 插件
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // 注册 multipart 文件上传插件（5MB 限制）
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  // 注册 Prisma Client 插件
  await app.register(prismaPlugin);

  // 注册 JWT 认证插件
  await app.register(authPlugin);

  // 注册认证路由
  await app.register(authRoutes);

  // 注册物品管理路由
  await app.register(itemRoutes);

  // 注册分类管理路由
  await app.register(categoryRoutes);

  // 注册图片管理路由
  await app.register(imageRoutes);

  // 注册提醒管理路由
  await app.register(reminderRoutes);

  // 全局错误处理器：统一错误响应格式
  app.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode ?? 500;

    // JSON Schema 校验错误
    if (error.validation) {
      const response: ErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: '请求参数校验失败',
        details: error.validation,
      };
      return reply.status(400).send(response);
    }

    // 已知业务错误（带 statusCode）
    if (statusCode < 500) {
      const response: ErrorResponse = {
        error: error.code ?? 'REQUEST_ERROR',
        message: error.message,
      };
      return reply.status(statusCode).send(response);
    }

    // 未知服务器错误，隐藏内部细节
    app.log.error(error);
    const response: ErrorResponse = {
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    };
    return reply.status(500).send(response);
  });

  // 健康检查路由
  app.get('/api/health', async () => {
    return { status: 'ok' };
  });

  return app;
}

/**
 * 启动服务
 */
async function start() {
  const app = await buildApp();
  const port = Number(process.env.API_PORT) || 3001;

  try {
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`归物 · Tally 服务已启动，端口: ${port}`);

    // 启动提醒定时任务
    startReminderCron(app.prisma);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
