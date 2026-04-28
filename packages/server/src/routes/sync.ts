import { FastifyInstance } from 'fastify';

/** 单条变更记录类型 */
interface SyncChange {
  table: 'items' | 'categories';
  type: 'create' | 'update' | 'delete';
  id: string;
  data?: Record<string, unknown>;
  updatedAt: string;
}

/** Push 请求体 */
interface PushBody {
  lastSyncAt: string;
  changes: SyncChange[];
}

/** Pull 请求体 */
interface PullBody {
  lastSyncAt: string;
}

/** Push 请求的 JSON Schema 校验 */
const pushSchema = {
  body: {
    type: 'object',
    required: ['lastSyncAt', 'changes'],
    properties: {
      lastSyncAt: { type: 'string', format: 'date-time' },
      changes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['table', 'type', 'id', 'updatedAt'],
          properties: {
            table: { type: 'string', enum: ['items', 'categories'] },
            type: { type: 'string', enum: ['create', 'update', 'delete'] },
            id: { type: 'string' },
            data: { type: 'object' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
};

/** Pull 请求的 JSON Schema 校验 */
const pullSchema = {
  body: {
    type: 'object',
    required: ['lastSyncAt'],
    properties: {
      lastSyncAt: { type: 'string', format: 'date-time' },
    },
  },
};

/**
 * 处理标签：根据标签名数组，查找或创建标签，返回标签 ID 列表
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
 * 处理单条 items 表变更（create / update / delete）
 * 采用 Last-Write-Wins 策略：客户端 updatedAt > 服务端 updatedAt 时才写入
 */
async function handleItemChange(
  prisma: any,
  userId: string,
  change: SyncChange,
): Promise<void> {
  const { type, id, data, updatedAt } = change;
  const clientTime = new Date(updatedAt);

  // 删除操作：软删除
  if (type === 'delete') {
    const existing = await prisma.item.findFirst({ where: { id, userId } });
    if (existing) {
      // LWW：客户端时间更新才执行
      if (clientTime > existing.updatedAt) {
        await prisma.item.update({
          where: { id },
          data: { isDeleted: true, updatedAt: clientTime },
        });
      }
    }
    return;
  }

  // create / update 操作
  if (!data) return;

  const existing = await prisma.item.findFirst({ where: { id, userId } });

  // 提取标签数组，其余为物品字段
  const tags = (data.tags as string[]) ?? [];

  // 构建物品数据（排除前端专有字段）
  const itemData: Record<string, unknown> = {};
  if (data.name !== undefined) itemData.name = data.name;
  if (data.brand !== undefined) itemData.brand = data.brand || null;
  if (data.model !== undefined) itemData.model = data.model || null;
  if (data.purchaseDate !== undefined) itemData.purchaseDate = new Date(data.purchaseDate as string);
  if (data.purchasePrice !== undefined) itemData.purchasePrice = data.purchasePrice as number;
  if (data.purchaseChannel !== undefined) itemData.purchaseChannel = data.purchaseChannel || null;
  if (data.resalePrice !== undefined) {
    itemData.resalePrice = data.resalePrice != null ? data.resalePrice as number : null;
  }
  if (data.status !== undefined) itemData.status = data.status;
  if (data.warrantyDate !== undefined) {
    itemData.warrantyDate = data.warrantyDate ? new Date(data.warrantyDate as string) : null;
  }
  if (data.expiryDate !== undefined) {
    itemData.expiryDate = data.expiryDate ? new Date(data.expiryDate as string) : null;
  }
  if (data.note !== undefined) itemData.note = data.note || null;
  if (data.categoryId !== undefined) itemData.categoryId = data.categoryId || null;
  if (data.isDeleted !== undefined) itemData.isDeleted = data.isDeleted as boolean;

  if (existing) {
    // 记录已存在：LWW 冲突检测
    if (clientTime <= existing.updatedAt) return;

    // 更新物品字段
    await prisma.item.update({
      where: { id },
      data: { ...itemData, updatedAt: clientTime },
    });

    // 更新标签关联：先删后建
    await prisma.itemTag.deleteMany({ where: { itemId: id } });
    if (tags.length > 0) {
      const tagIds = await resolveTagIds(prisma, userId, tags);
      await prisma.itemTag.createMany({
        data: tagIds.map((tagId: string) => ({ itemId: id, tagId })),
      });
    }
  } else if (type === 'create') {
    // 新建物品：必须包含必填字段
    const createData: any = {
      id,
      userId,
      name: itemData.name ?? '未命名物品',
      purchaseDate: itemData.purchaseDate ?? new Date(),
      purchasePrice: itemData.purchasePrice ?? 0,
      status: (itemData.status) ?? 'IN_USE',
      ...itemData,
      updatedAt: clientTime,
    };

    // 移除 undefined 字段
    Object.keys(createData).forEach((key) => {
      if (createData[key] === undefined) delete createData[key];
    });

    await prisma.item.create({ data: createData });

    // 创建标签关联
    if (tags.length > 0) {
      const tagIds = await resolveTagIds(prisma, userId, tags);
      await prisma.itemTag.createMany({
        data: tagIds.map((tagId: string) => ({ itemId: id, tagId })),
      });
    }
  }
}

/**
 * 处理单条 categories 表变更（create / update / delete）
 * 采用 Last-Write-Wins 策略
 */
async function handleCategoryChange(
  prisma: any,
  userId: string,
  change: SyncChange,
): Promise<void> {
  const { type, id, data, updatedAt } = change;
  const clientTime = new Date(updatedAt);

  // 删除操作：软删除
  if (type === 'delete') {
    const existing = await prisma.category.findFirst({ where: { id, userId } });
    if (existing) {
      if (clientTime > existing.updatedAt) {
        await prisma.$transaction([
          prisma.category.update({
            where: { id },
            data: { isDeleted: true, updatedAt: clientTime },
          }),
          prisma.item.updateMany({
            where: { categoryId: id, userId },
            data: { categoryId: null },
          }),
        ]);
      }
    }
    return;
  }

  // create / update 操作
  if (!data) return;

  const existing = await prisma.category.findFirst({ where: { id, userId } });

  if (existing) {
    // LWW 冲突检测
    if (clientTime <= existing.updatedAt) return;

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isDeleted !== undefined) updateData.isDeleted = data.isDeleted;

    await prisma.category.update({
      where: { id },
      data: { ...updateData, updatedAt: clientTime },
    });
  } else if (type === 'create') {
    await prisma.category.create({
      data: {
        id,
        name: (data.name as string) ?? '未命名分类',
        userId,
        isDeleted: (data.isDeleted as boolean) ?? false,
        updatedAt: clientTime,
      },
    });
  }
}

/**
 * 同步路由模块
 * 提供 push（推送本地变更）和 pull（拉取云端变更）接口
 */
export default async function syncRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/sync/push - 推送本地变更到云端
   * 接收客户端变更列表，按 LWW 策略写入数据库
   */
  fastify.post<{ Body: PushBody }>(
    '/api/sync/push',
    { preHandler: [fastify.authenticate], schema: pushSchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { changes } = request.body;

      let applied = 0;
      let skipped = 0;

      for (const change of changes) {
        try {
          if (change.table === 'items') {
            await handleItemChange(fastify.prisma, userId, change);
          } else if (change.table === 'categories') {
            await handleCategoryChange(fastify.prisma, userId, change);
          }
          applied++;
        } catch (err) {
          // 单条变更失败不影响其他变更
          fastify.log.warn({ err, change }, '同步变更处理失败');
          skipped++;
        }
      }

      const syncedAt = new Date().toISOString();

      return reply.send({
        applied,
        skipped,
        syncedAt,
      });
    },
  );

  /**
   * POST /api/sync/pull - 拉取云端变更到本地
   * 根据 lastSyncAt 查询变更记录，返回变更列表和同步时间戳
   */
  fastify.post<{ Body: PullBody }>(
    '/api/sync/pull',
    { preHandler: [fastify.authenticate], schema: pullSchema },
    async (request, reply) => {
      const { userId } = request.user;
      const { lastSyncAt } = request.body;
      const since = new Date(lastSyncAt);

      // 查询 items 变更（包含已删除的，以便客户端同步删除状态）
      const items = await fastify.prisma.item.findMany({
        where: {
          userId,
          updatedAt: { gt: since },
        },
        include: {
          category: { select: { id: true, name: true } },
          itemTags: { include: { tag: { select: { id: true, name: true } } } },
        },
      });

      // 查询 categories 变更
      const categories = await fastify.prisma.category.findMany({
        where: {
          userId,
          updatedAt: { gt: since },
        },
      });

      // 组装变更列表
      const changes: Array<{
        table: string;
        type: string;
        id: string;
        data: Record<string, unknown>;
        updatedAt: string;
      }> = [];

      // 转换 items 变更
      for (const item of items) {
        const { itemTags, category, ...rest } = item;
        // 将标签从关联表转为字符串数组（前端格式）
        const tags = itemTags?.map((it: any) => it.tag.name) ?? [];

        const changeType = item.isDeleted ? 'delete' : 'update';

        changes.push({
          table: 'items',
          type: changeType,
          id: item.id,
          data: {
            name: rest.name,
            brand: rest.brand,
            model: rest.model,
            purchaseDate: rest.purchaseDate.toISOString(),
            purchasePrice: Number(rest.purchasePrice),
            purchaseChannel: rest.purchaseChannel,
            resalePrice: rest.resalePrice != null ? Number(rest.resalePrice) : null,
            status: rest.status,
            warrantyDate: rest.warrantyDate?.toISOString() ?? null,
            expiryDate: rest.expiryDate?.toISOString() ?? null,
            note: rest.note,
            categoryId: rest.categoryId,
            tags,
            isDeleted: rest.isDeleted,
          },
          updatedAt: rest.updatedAt.toISOString(),
        });
      }

      // 转换 categories 变更
      for (const cat of categories) {
        const changeType = cat.isDeleted ? 'delete' : 'update';

        changes.push({
          table: 'categories',
          type: changeType,
          id: cat.id,
          data: {
            name: cat.name,
            isDeleted: cat.isDeleted,
          },
          updatedAt: cat.updatedAt.toISOString(),
        });
      }

      const syncedAt = new Date().toISOString();

      return reply.send({
        changes,
        syncedAt,
      });
    },
  );
}
