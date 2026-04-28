/**
 * 资产统计计算纯函数
 * 用于资产总览仪表盘的数据计算
 */

import type { LocalItem, ItemStatus } from '../db';
import { calculateDailyCost } from './dailyCost';

/** 资产统计数据 */
export interface AssetStatistics {
  /** 总资产金额 = Σ(purchasePrice) */
  totalAssets: number;
  /** 整体日均成本 = Σ(每件物品的日均成本) */
  totalDailyCost: number;
  /** 总资产估值 = Σ(resalePrice)，仅包含已填写回收价格的物品 */
  totalResaleValue: number;
  /** 按状态分组的物品数量 */
  statusCounts: Record<ItemStatus, number>;
}

/** 即将到期保修物品 */
export interface ExpiringItem {
  id: string;
  name: string;
  warrantyDate: string;
  /** 距到期剩余天数，负数表示已过期 */
  daysRemaining: number;
}

/**
 * 计算资产统计数据
 * 仅统计未删除的物品
 */
export function calculateAssetStatistics(items: LocalItem[]): AssetStatistics {
  const activeItems = items.filter((item) => !item.isDeleted);

  const statusCounts: Record<ItemStatus, number> = {
    IN_USE: 0,
    IDLE: 0,
    SOLD: 0,
    DISCARDED: 0,
  };

  let totalAssets = 0;
  let totalDailyCost = 0;
  let totalResaleValue = 0;

  for (const item of activeItems) {
    totalAssets += item.purchasePrice;
    totalDailyCost += calculateDailyCost(item.purchasePrice, item.purchaseDate);
    if (item.resalePrice != null && item.resalePrice > 0) {
      totalResaleValue += item.resalePrice;
    }
    statusCounts[item.status]++;
  }

  return {
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalDailyCost: Math.round(totalDailyCost * 100) / 100,
    totalResaleValue: Math.round(totalResaleValue * 100) / 100,
    statusCounts,
  };
}

/**
 * 获取即将到期的保修物品列表
 * @param items 物品列表
 * @param withinDays 到期天数范围，默认 30 天
 * @returns 按到期日期升序排列的物品列表，包含已过期物品
 */
export function getExpiringItems(
  items: LocalItem[],
  withinDays: number = 30,
): ExpiringItem[] {
  const now = new Date(Date.now());
  now.setHours(0, 0, 0, 0);
  const nowTime = now.getTime();

  return items
    .filter((item) => !item.isDeleted && item.warrantyDate)
    .map((item) => {
      const warranty = new Date(item.warrantyDate!);
      warranty.setHours(0, 0, 0, 0);
      const daysRemaining = Math.floor(
        (warranty.getTime() - nowTime) / (1000 * 60 * 60 * 24),
      );
      return {
        id: item.id,
        name: item.name,
        warrantyDate: item.warrantyDate!,
        daysRemaining,
      };
    })
    .filter((item) => item.daysRemaining <= withinDays)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}
