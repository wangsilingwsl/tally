import { FastifyInstance } from 'fastify';
import {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} from '../schemas/categories.js';

/** 创建/更新分类请求体类型 */
interface CategoryBody {
  name: string;
}

/** 路由参数类型 */
interface CategoryParams {
  id: string;
}

/**
 * 分类管理路由模块
 * 提供分类的增删改查接口，所有数据按 userId 隔离
 */
export default async function categoryRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/categories - 获取当前用户的分类列表
   * 过滤已软删除的分类，按创建时间升序排列
   */
  fastify.get(
    '/api/categories',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const categories = await fastify.prisma.category.findMany({
        where: { userId, isDeleted: false },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send({ categories });
    },
  );

  /**
   * POST /api/categories - 创建分类
   * 校验同一用户下名称唯一，重复返回 409
   */
  fastify.post<{ Body: CategoryBody }>(
    '/api/categories',
    { preHandler: [fastify.authenticate], schema: createCategorySchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { name } = request.body;

      // 检查同一用户下是否已存在同名分类（包括未删除的）
      const existing = await fastify.prisma.category.findFirst({
        where: { userId, name, isDeleted: false },
      });

      if (existing) {
        return reply.status(409).send({
          error: 'CONFLICT',
          message: '分类名称已存在',
        });
      }

      const category = await fastify.prisma.category.create({
        data: { name, userId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.status(201).send({ category });
    },
  );

  /**
   * PUT /api/categories/:id - 更新分类名称
   * 校验分类归属和名称唯一性
   */
  fastify.put<{ Params: CategoryParams; Body: CategoryBody }>(
    '/api/categories/:id',
    { preHandler: [fastify.authenticate], schema: updateCategorySchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;
      const { name } = request.body;

      // 检查分类是否存在且属于当前用户
      const existing = await fastify.prisma.category.findFirst({
        where: { id, userId, isDeleted: false },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '分类不存在',
        });
      }

      // 检查新名称是否与其他分类重复
      if (name !== existing.name) {
        const duplicate = await fastify.prisma.category.findFirst({
          where: { userId, name, isDeleted: false, id: { not: id } },
        });

        if (duplicate) {
          return reply.status(409).send({
            error: 'CONFLICT',
            message: '分类名称已存在',
          });
        }
      }

      const category = await fastify.prisma.category.update({
        where: { id },
        data: { name },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send({ category });
    },
  );

  /**
   * DELETE /api/categories/:id - 软删除分类
   * 将该分类下所有物品的 categoryId 设为 null（前端显示"未分类"）
   */
  fastify.delete<{ Params: CategoryParams }>(
    '/api/categories/:id',
    { preHandler: [fastify.authenticate], schema: deleteCategorySchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;

      // 检查分类是否存在且属于当前用户
      const existing = await fastify.prisma.category.findFirst({
        where: { id, userId, isDeleted: false },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '分类不存在',
        });
      }

      // 事务：软删除分类 + 将该分类下物品的 categoryId 设为 null
      await fastify.prisma.$transaction([
        fastify.prisma.category.update({
          where: { id },
          data: { isDeleted: true },
        }),
        fastify.prisma.item.updateMany({
          where: { categoryId: id, userId },
          data: { categoryId: null },
        }),
      ]);

      return reply.send({ message: '分类已删除' });
    },
  );
}
