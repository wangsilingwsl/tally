/**
 * 消费统计分析工具函数
 * 用于趋势图、分类占比、折旧分析的数据计算
 */

import type { LocalItem } from '../db';
import type { LocalCategory } from '../db';

/** 趋势数据点 */
export interface TrendPoint {
  /** 时间段标签，如 "2024-01"、"2024-Q1"、"2024" */
  period: string;
  /** 该时间段消费金额 */
  amount: number;
}

/** 分类占比数据 */
export interface CategoryRatio {
  /** 分类名称 */
  categoryName: string;
  /** 消费金额 */
  amount: number;
  /** 占比百分比 */
  ratio: number;
}

/** 折旧分析数据 */
export interface DepreciationItem {
  id: string;
  name: string;
  /** 购入价 */
  purchasePrice: number;
  /** 当前估值（二手回收价），null 表示未填写 */
  resalePrice: number | null;
  /** 差额 = 购入价 - 当前估值 */
  difference: number | null;
  /** 贬值率 (0-100)，null 表示未填写估值 */
  depreciationRate: number | null;
}

/** 时间维度类型 */
export type PeriodType = 'month' | 'quarter' | 'year';

/**
 * 获取物品购买日期对应的时间段标签
 */
function getPeriodLabel(dateStr: string, period: PeriodType): string {
  const date = new Date(dateStr);
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
 * 计算消费金额趋势
 * 按购买日期分组，统计每个时间段的消费总额
 */
export function calculateTrend(items: LocalItem[], period: PeriodType): TrendPoint[] {
  const activeItems = items.filter((item) => !item.isDeleted);
  const map = new Map<string, number>();

  for (const item of activeItems) {
    const label = getPeriodLabel(item.purchaseDate, period);
    map.set(label, (map.get(label) ?? 0) + item.purchasePrice);
  }

  // 按时间段排序
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([p, amount]) => ({
      period: p,
      amount: Math.round(amount * 100) / 100,
    }));
}

/**
 * 计算分类消费占比
 * 按分类分组，统计每个分类的消费金额和占比
 */
export function calculateCategoryRatio(
  items: LocalItem[],
  categories: LocalCategory[],
): CategoryRatio[] {
  const activeItems = items.filter((item) => !item.isDeleted);
  if (activeItems.length === 0) return [];

  // 构建分类 ID → 名称映射
  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    if (!cat.isDeleted) {
      categoryMap.set(cat.id, cat.name);
    }
  }

  // 按分类分组求和
  const amountMap = new Map<string, number>();
  let total = 0;

  for (const item of activeItems) {
    const name = item.categoryId ? (categoryMap.get(item.categoryId) ?? '未分类') : '未分类';
    amountMap.set(name, (amountMap.get(name) ?? 0) + item.purchasePrice);
    total += item.purchasePrice;
  }

  if (total === 0) return [];

  return Array.from(amountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([categoryName, amount]) => ({
      categoryName,
      amount: Math.round(amount * 100) / 100,
      ratio: Math.round((amount / total) * 10000) / 100,
    }));
}

/**
 * 计算折旧分析
 * 每件物品的购入价、当前估值、差额、贬值率
 */
export function calculateDepreciation(items: LocalItem[]): DepreciationItem[] {
  return items
    .filter((item) => !item.isDeleted)
    .map((item) => {
      const hasResale = item.resalePrice != null && item.resalePrice >= 0;
      const resalePrice = hasResale ? item.resalePrice! : null;
      const difference = resalePrice !== null ? item.purchasePrice - resalePrice : null;
      let depreciationRate: number | null = null;

      if (difference !== null && item.purchasePrice > 0) {
        depreciationRate = Math.round((difference / item.purchasePrice) * 10000) / 100;
      }

      return {
        id: item.id,
        name: item.name,
        purchasePrice: item.purchasePrice,
        resalePrice,
        difference,
        depreciationRate,
      };
    });
}
