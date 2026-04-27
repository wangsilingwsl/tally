import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

// 声明 Fastify 实例上的 prisma 属性类型
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

/**
 * Prisma Client 插件
 * 将 PrismaClient 实例注入到 Fastify 实例上，方便路由中直接使用
 */
async function prismaPlugin(fastify: FastifyInstance) {
  const prisma = new PrismaClient();

  // 连接数据库
  await prisma.$connect();

  // 装饰 Fastify 实例，注入 prisma
  fastify.decorate('prisma', prisma);

  // 服务关闭时断开数据库连接
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

export default fp(prismaPlugin, {
  name: 'prisma',
});
