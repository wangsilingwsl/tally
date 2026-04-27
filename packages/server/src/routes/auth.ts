import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { signToken } from '../plugins/auth.js';
import { registerSchema, loginSchema } from '../schemas/auth.js';

/** 注册请求体类型 */
interface RegisterBody {
  email: string;
  password: string;
}

/** 登录请求体类型 */
interface LoginBody {
  email: string;
  password: string;
}

/** bcrypt 哈希轮数 */
const SALT_ROUNDS = 10;

/**
 * 认证路由模块
 * 提供注册、登录、登出、获取用户信息接口
 */
export default async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/register - 用户注册
   * 校验邮箱格式和密码强度，密码使用 bcrypt 哈希存储
   */
  fastify.post(
    '/api/auth/register',
    { schema: registerSchema },
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      const { email, password } = request.body;

      // 检查邮箱是否已注册
      const existingUser = await fastify.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return reply.status(409).send({
          error: 'CONFLICT',
          message: '该邮箱已注册',
        });
      }

      // 密码哈希
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // 创建用户
      const user = await fastify.prisma.user.create({
        data: { email, passwordHash },
      });

      // 签发 Token
      const token = signToken({ userId: user.id, email: user.email });

      return reply.status(201).send({
        token,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    },
  );

  /**
   * POST /api/auth/login - 用户登录
   * 验证邮箱密码，签发 JWT Token
   */
  fastify.post(
    '/api/auth/login',
    { schema: loginSchema },
    async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      const { email, password } = request.body;

      // 查找用户
      const user = await fastify.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: '邮箱或密码错误',
        });
      }

      // 验证密码
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: '邮箱或密码错误',
        });
      }

      // 签发 Token
      const token = signToken({ userId: user.id, email: user.email });

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    },
  );

  /**
   * POST /api/auth/logout - 退出登录
   * JWT 无状态，客户端清除 Token 即可
   */
  fastify.post(
    '/api/auth/logout',
    { preHandler: [fastify.authenticate] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ message: '已退出登录' });
    },
  );

  /**
   * GET /api/auth/me - 获取当前用户信息
   * 需要认证，返回用户基本信息
   */
  fastify.get(
    '/api/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.userId },
        select: {
          id: true,
          email: true,
          notifyEmail: true,
          emailEnabled: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '用户不存在',
        });
      }

      return reply.send({ user });
    },
  );
}
