import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

/** JWT Token 载荷类型 */
export interface JwtPayload {
  userId: string;
  email: string;
}

// 扩展 Fastify 类型声明
declare module 'fastify' {
  interface FastifyRequest {
    /** 当前登录用户信息，通过 JWT 解析 */
    user: JwtPayload;
  }
  interface FastifyInstance {
    /** JWT 认证装饰器，用于保护需认证的路由 */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** 获取 JWT 密钥，未配置时使用默认值（仅限开发环境） */
function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'tally-dev-secret-change-in-production';
}

/** JWT 过期时间 */
const JWT_EXPIRES_IN = '7d';

/**
 * 签发 JWT Token
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证并解析 JWT Token
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

/**
 * JWT 认证插件
 * 注册 authenticate 装饰器，用于路由级别的认证保护
 */
async function authPlugin(fastify: FastifyInstance) {
  // 装饰 request，声明 user 属性（Fastify 5 使用 getter/setter 形式）
  fastify.decorateRequest('user', undefined as unknown as JwtPayload);

  // 注册认证方法到 fastify 实例
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: '请先登录',
      });
    }

    const token = authHeader.slice(7);

    try {
      const payload = verifyToken(token);
      request.user = payload;
    } catch {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: '登录已过期，请重新登录',
      });
    }
  });
}

export default fp(authPlugin, {
  name: 'auth',
});
