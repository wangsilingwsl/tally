import { FastifyInstance } from 'fastify';

/** 路由参数类型 */
interface ReminderParams {
  id: string;
}

/**
 * 提醒管理路由模块
 * 提供提醒的查询和已读标记接口，所有数据按 userId 隔离
 */
export default async function reminderRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/reminders - 获取当前用户的提醒列表
   * 按未读优先、到期日期升序排列
   */
  fastify.get(
    '/api/reminders',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const reminders = await fastify.prisma.reminder.findMany({
        where: { userId },
        orderBy: [
          { isRead: 'asc' },
          { dueDate: 'asc' },
        ],
      });

      return reply.send({ reminders });
    },
  );

  /**
   * PUT /api/reminders/:id/read - 标记单条提醒为已读
   */
  fastify.put<{ Params: ReminderParams }>(
    '/api/reminders/:id/read',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;

      // 检查提醒是否存在且属于当前用户
      const reminder = await fastify.prisma.reminder.findFirst({
        where: { id, userId },
      });

      if (!reminder) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '提醒不存在',
        });
      }

      const updated = await fastify.prisma.reminder.update({
        where: { id },
        data: { isRead: true },
      });

      return reply.send({ reminder: updated });
    },
  );

  /**
   * PUT /api/reminders/read-all - 标记当前用户所有提醒为已读
   */
  fastify.put(
    '/api/reminders/read-all',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const result = await fastify.prisma.reminder.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return reply.send({
        message: '已全部标记为已读',
        count: result.count,
      });
    },
  );
}
