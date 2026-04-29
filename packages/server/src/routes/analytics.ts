import { FastifyInstance } from 'fastify';

/** 趋势查询参数类型 */
interface TrendQuery {
  period?: 'month' | 'quarter' | 'year';
}

/** 趋势数据项 */
interface TrendItem {
  period: string;
  amount: number;
}

/** 分类占比数据项 */
interface CategoryRatioItem {
  categoryId: string | null;
  categoryName: string;
  amount: number;
  ratio: number;
}

/** 折旧分析数据项 */
interface DepreciationItem {
  id: string;
  name: string;
  purchasePrice: number;
  resalePrice: number | null;
  difference: number | null;
  depreciationRate: number | null;
  hasEstimate: boolean;
}

/** 资产总览摘要 */
interface SummaryData {
  totalAssets: number;
  totalResaleValue: number;
  totalItems: number;
  totalDailyCost: number;
  statusCounts: Record<string, number>;
  totalSoldIncome: number;
  soldCount: number;
  soldRecoveryRate: number | null;
}

/**
 * 将价格值转为 number（兼容处理）
 */
function toNumber(val: number | null | undefined): number {
  if (val == null) return 0;
  return Number(val);
}

/**
 * 根据购买日期获取所属周期字符串
 */
function getPeriodKey(date: Date, period: 'month' | 'quarter' | 'year'): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  switch (period) {
    case 'month':
      return `${year}-${String(month).padStart(2, '0')}`;
    case 'quarter': {
      const quarter = Math.ceil(month / 3);
      return `${year}-Q${quarter}`;
    }
    case 'year':
      return `${year}`;
  }
}

/**
 * 计算单件物品的日均成本
 */
function calcDailyCost(purchasePrice: number, purchaseDate: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - purchaseDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return purchasePrice;
  return purchasePrice / diffDays;
}

/**
 * 统计分析路由模块
 * 提供消费趋势、分类占比、折旧分析、资产摘要接口
 */
export default async function analyticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/analytics/trend - 消费金额趋势
   * 按月/季/年分组返回消费金额数据
   */
  fastify.get<{ Querystring: TrendQuery }>(
    '/api/analytics/trend',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const period = request.query.period || 'month';

      // 查询当前用户所有未删除物品
      const items = await fastify.prisma.item.findMany({
        where: { userId, isDeleted: false },
        select: { purchaseDate: true, purchasePrice: true },
      });

      // 按周期分组汇总金额
      const trendMap = new Map<string, number>();
      for (const item of items) {
        const key = getPeriodKey(item.purchaseDate, period);
        const price = toNumber(item.purchasePrice);
        trendMap.set(key, (trendMap.get(key) || 0) + price);
      }

      // 按周期排序
      const trend: TrendItem[] = Array.from(trendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, amount]) => ({
          period,
          amount: Math.round(amount * 100) / 100,
        }));

      return reply.send({ trend });
    },
  );

  /**
   * GET /api/analytics/category-ratio - 分类消费占比
   * 按分类分组返回消费金额及占比
   */
  fastify.get(
    '/api/analytics/category-ratio',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      // 查询所有未删除物品，包含分类信息
      const items = await fastify.prisma.item.findMany({
        where: { userId, isDeleted: false },
        select: {
          purchasePrice: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
      });

      // 按分类分组汇总金额
      const categoryMap = new Map<string | null, { name: string; amount: number }>();
      let totalAmount = 0;

      for (const item of items) {
        const price = toNumber(item.purchasePrice);
        totalAmount += price;

        const catId = item.categoryId;
        const catName = item.category?.name || '未分类';

        if (categoryMap.has(catId)) {
          categoryMap.get(catId)!.amount += price;
        } else {
          categoryMap.set(catId, { name: catName, amount: price });
        }
      }

      // 计算占比
      const categoryRatio: CategoryRatioItem[] = Array.from(categoryMap.entries())
        .map(([categoryId, { name, amount }]) => ({
          categoryId,
          categoryName: name,
          amount: Math.round(amount * 100) / 100,
          ratio: totalAmount > 0
            ? Math.round((amount / totalAmount) * 10000) / 100
            : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return reply.send({ categoryRatio, totalAmount: Math.round(totalAmount * 100) / 100 });
    },
  );

  /**
   * GET /api/analytics/depreciation - 折旧分析
   * 返回每件物品的购入价、当前估值、差额、贬值率
   */
  fastify.get(
    '/api/analytics/depreciation',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const items = await fastify.prisma.item.findMany({
        where: { userId, isDeleted: false },
        select: {
          id: true,
          name: true,
          purchasePrice: true,
          resalePrice: true,
        },
      });

      const depreciation: DepreciationItem[] = items.map((item) => {
        const purchasePrice = toNumber(item.purchasePrice);
        const resaleRaw = item.resalePrice;
        const hasEstimate = resaleRaw != null;

        if (!hasEstimate) {
          // 未填写二手回收价格，标记为"估值待填写"
          return {
            id: item.id,
            name: item.name,
            purchasePrice,
            resalePrice: null,
            difference: null,
            depreciationRate: null,
            hasEstimate: false,
          };
        }

        const resalePrice = toNumber(resaleRaw);
        const difference = Math.round((purchasePrice - resalePrice) * 100) / 100;
        const depreciationRate = purchasePrice > 0
          ? Math.round(((purchasePrice - resalePrice) / purchasePrice) * 10000) / 100
          : 0;

        return {
          id: item.id,
          name: item.name,
          purchasePrice,
          resalePrice,
          difference,
          depreciationRate,
          hasEstimate: true,
        };
      });

      return reply.send({ depreciation });
    },
  );

  /**
   * GET /api/analytics/summary - 资产总览摘要
   * 返回总资产、总估值、物品数、日均成本、状态分布
   */
  fastify.get(
    '/api/analytics/summary',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const items = await fastify.prisma.item.findMany({
        where: { userId, isDeleted: false },
        select: {
          purchasePrice: true,
          purchaseDate: true,
          resalePrice: true,
          soldPrice: true,
          status: true,
        },
      });

      let totalAssets = 0;
      let totalResaleValue = 0;
      let totalDailyCost = 0;
      let totalSoldIncome = 0;
      let soldCount = 0;
      let soldPurchaseTotal = 0;

      // 初始化状态计数
      const statusCounts: Record<string, number> = {
        IN_USE: 0,
        IDLE: 0,
        SOLD: 0,
        DISCARDED: 0,
      };

      for (const item of items) {
        const price = toNumber(item.purchasePrice);
        totalAssets += price;

        // 仅累加已填写二手回收价格的物品
        const resaleRaw = item.resalePrice;
        if (resaleRaw != null) {
          totalResaleValue += toNumber(resaleRaw);
        }

        // 累加日均成本
        totalDailyCost += calcDailyCost(price, item.purchaseDate);

        // 状态计数
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;

        // 出售统计
        if (item.status === 'SOLD') {
          soldCount++;
          soldPurchaseTotal += price;
          if (item.soldPrice != null) {
            totalSoldIncome += toNumber(item.soldPrice);
          }
        }
      }

      // 出售回收率 = 出售总收入 / 已出售物品购入总价
      const soldRecoveryRate =
        soldCount > 0 && soldPurchaseTotal > 0
          ? Math.round((totalSoldIncome / soldPurchaseTotal) * 10000) / 100
          : null;

      const summary: SummaryData = {
        totalAssets: Math.round(totalAssets * 100) / 100,
        totalResaleValue: Math.round(totalResaleValue * 100) / 100,
        totalItems: items.length,
        totalDailyCost: Math.round(totalDailyCost * 100) / 100,
        statusCounts,
        totalSoldIncome: Math.round(totalSoldIncome * 100) / 100,
        soldCount,
        soldRecoveryRate,
      };

      return reply.send({ summary });
    },
  );
}
