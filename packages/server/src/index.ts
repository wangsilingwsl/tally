import Fastify, { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import prismaPlugin from './plugins/prisma.js';

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

  // 注册 Prisma Client 插件
  await app.register(prismaPlugin);

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
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
