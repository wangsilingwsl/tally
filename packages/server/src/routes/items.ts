import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  createItemSchema,
  updateItemSchema,
  getItemSchema,
  deleteItemSchema,
  listItemsSchema,
} from '../schemas/items.js';

/** 创建物品请求体类型 */
interface CreateItemBody {
  name: string;
  brand?: string;
  model?: string;
  purchaseDate: string;
  purchasePrice: number;
  purchaseChannel?: string;
  resalePrice?: number;
  status: string;
  warrantyDate?: string;
  expiryDate?: string;
  note?: string;
  categoryId?: string;
  tags?: string[];
}

/** 更新物品请求体类型 */
interface UpdateItemBody {
  name?: string;
  brand?: string;
  model?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  purchaseChannel?: string;
  resalePrice?: number | null;
  status?: string;
  warrantyDate?: string | null;
  expiryDate?: string | null;
  note?: string | null;
  categoryId?: string | null;
  tags?: string[];
}

/** 路由参数类型 */
interface ItemParams {
  id: string;
}

/** 列表查询参数类型 */
interface ListItemsQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  tag?: string;
}

/** 物品关联查询的 include 配置 */
const ITEM_INCLUDE = {
  category: { select: { id: true, name: true } },
  itemTags: { include: { tag: { select: { id: true, name: true } } } },
  images: { select: { id: true, thumbnailPath: true }, take: 1 },
};

/**
 * 格式化物品响应数据
 * 将 itemTags 关联数据扁平化为 tags 数组
 */
function formatItemResponse(item: any) {
  const { itemTags, ...rest } = item;
  return {
    ...rest,
    tags: itemTags?.map((it: any) => ({
      id: it.tag.id,
      name: it.tag.name,
    })) ?? [],
  };
}

/**
 * 处理标签：查找或创建标签，返回标签 ID 列表
 */
async function resolveTagIds(
  prisma: any,
  userId: string,
  tagNames: string[],
): Promise<string[]> {
  const tagIds: string[] = [];

  for (const name of tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    // 查找已有标签或创建新标签
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name: trimmed } },
      update: {},
      create: { name: trimmed, userId },
    });
    tagIds.push(tag.id);
  }

  return tagIds;
}

/**
 * 物品管理路由模块
 * 提供物品的增删改查接口，所有数据按 userId 隔离
 */
export default async function itemRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/items - 获取物品列表
   * 支持分页、搜索、按分类/状态/标签筛选
   */
  fastify.get<{ Querystring: ListItemsQuery }>(
    '/api/items',
    { preHandler: [fastify.authenticate], schema: listItemsSchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { page = 1, limit = 20, search, categoryId, status, tag } = request.query;

      // 构建查询条件
      const where: Prisma.ItemWhereInput = {
        userId,
        isDeleted: false,
      };

      // 按名称模糊搜索
      if (search) {
        where.name = { contains: search };
      }

      // 按分类筛选
      if (categoryId) {
        where.categoryId = categoryId;
      }

      // 按状态筛选
      if (status) {
        where.status = status;
      }

      // 按标签筛选
      if (tag) {
        where.itemTags = {
          some: {
            tag: { name: tag, userId },
          },
        };
      }

      // 查询总数和分页数据
      const [total, items] = await Promise.all([
        fastify.prisma.item.count({ where }),
        fastify.prisma.item.findMany({
          where,
          include: ITEM_INCLUDE,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return reply.send({
        items: items.map(formatItemResponse),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /**
   * GET /api/items/:id - 获取物品详情
   */
  fastify.get<{ Params: ItemParams }>(
    '/api/items/:id',
    { preHandler: [fastify.authenticate], schema: getItemSchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;

      const item = await fastify.prisma.item.findFirst({
        where: { id, userId, isDeleted: false },
        include: {
          ...ITEM_INCLUDE,
          images: { select: { id: true, thumbnailPath: true, originalPath: true, mimeType: true } },
        },
      });

      if (!item) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '物品不存在',
        });
      }

      return reply.send({ item: formatItemResponse(item) });
    },
  );

  /**
   * POST /api/items - 创建物品
   */
  fastify.post<{ Body: CreateItemBody }>(
    '/api/items',
    { preHandler: [fastify.authenticate], schema: createItemSchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { tags, ...data } = request.body;

      // 校验分类是否属于当前用户
      if (data.categoryId) {
        const category = await fastify.prisma.category.findFirst({
          where: { id: data.categoryId, userId, isDeleted: false },
        });
        if (!category) {
          return reply.status(400).send({
            error: 'VALIDATION_ERROR',
            message: '分类不存在',
          });
        }
      }

      // 处理标签
      let tagIds: string[] = [];
      if (tags && tags.length > 0) {
        tagIds = await resolveTagIds(fastify.prisma, userId, tags);
      }

      // 创建物品
      const item = await fastify.prisma.item.create({
        data: {
          name: data.name,
          brand: data.brand,
          model: data.model,
          purchaseDate: new Date(data.purchaseDate),
          purchasePrice: data.purchasePrice,
          purchaseChannel: data.purchaseChannel,
          resalePrice: data.resalePrice ?? null,
          status: data.status,
          warrantyDate: data.warrantyDate ? new Date(data.warrantyDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          note: data.note,
          categoryId: data.categoryId,
          userId,
          itemTags: tagIds.length > 0
            ? { create: tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
        include: ITEM_INCLUDE,
      });

      return reply.status(201).send({ item: formatItemResponse(item) });
    },
  );

  /**
   * PUT /api/items/:id - 更新物品
   */
  fastify.put<{ Params: ItemParams; Body: UpdateItemBody }>(
    '/api/items/:id',
    { preHandler: [fastify.authenticate], schema: updateItemSchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;
      const { tags, ...data } = request.body;

      // 检查物品是否存在且属于当前用户
      const existing = await fastify.prisma.item.findFirst({
        where: { id, userId, isDeleted: false },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '物品不存在',
        });
      }

      // 校验分类是否属于当前用户
      if (data.categoryId) {
        const category = await fastify.prisma.category.findFirst({
          where: { id: data.categoryId, userId, isDeleted: false },
        });
        if (!category) {
          return reply.status(400).send({
            error: 'VALIDATION_ERROR',
            message: '分类不存在',
          });
        }
      }

      // 构建更新数据
      const updateData: Prisma.ItemUpdateInput = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.brand !== undefined) updateData.brand = data.brand;
      if (data.model !== undefined) updateData.model = data.model;
      if (data.purchaseDate !== undefined) updateData.purchaseDate = new Date(data.purchaseDate);
      if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice;
      if (data.purchaseChannel !== undefined) updateData.purchaseChannel = data.purchaseChannel;
      if (data.resalePrice !== undefined) {
        updateData.resalePrice = data.resalePrice ?? null;
      }
      if (data.status !== undefined) updateData.status = data.status;
      if (data.warrantyDate !== undefined) {
        updateData.warrantyDate = data.warrantyDate ? new Date(data.warrantyDate) : null;
      }
      if (data.expiryDate !== undefined) {
        updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
      }
      if (data.note !== undefined) updateData.note = data.note;
      if (data.categoryId !== undefined) {
        updateData.category = data.categoryId
          ? { connect: { id: data.categoryId } }
          : { disconnect: true };
      }

      // 处理标签更新：先删除旧关联，再创建新关联
      if (tags !== undefined) {
        await fastify.prisma.itemTag.deleteMany({ where: { itemId: id } });

        if (tags.length > 0) {
          const tagIds = await resolveTagIds(fastify.prisma, userId, tags);
          updateData.itemTags = {
            create: tagIds.map((tagId) => ({ tagId })),
          };
        }
      }

      const item = await fastify.prisma.item.update({
        where: { id },
        data: updateData,
        include: ITEM_INCLUDE,
      });

      return reply.send({ item: formatItemResponse(item) });
    },
  );

  /**
   * DELETE /api/items/:id - 软删除物品
   * 设置 isDeleted = true，保留记录用于同步
   */
  fastify.delete<{ Params: ItemParams }>(
    '/api/items/:id',
    { preHandler: [fastify.authenticate], schema: deleteItemSchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;

      // 检查物品是否存在且属于当前用户
      const existing = await fastify.prisma.item.findFirst({
        where: { id, userId, isDeleted: false },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '物品不存在',
        });
      }

      // 软删除
      await fastify.prisma.item.update({
        where: { id },
        data: { isDeleted: true },
      });

      return reply.send({ message: '物品已删除' });
    },
  );
}
