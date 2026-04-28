import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateAssetStatistics, getExpiringItems } from './statistics';
import type { LocalItem } from '../db';

/** 创建测试用物品数据 */
function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    id: 'test-id',
    name: '测试物品',
    purchaseDate: '2024-01-01',
    purchasePrice: 1000,
    status: 'IN_USE',
    tags: [],
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    syncStatus: 'synced',
    ...overrides,
  };
}

/** 固定 Date.now 到指定日期 */
function mockNow(dateStr: string) {
  vi.spyOn(Date, 'now').mockReturnValue(new Date(dateStr).getTime());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('calculateAssetStatistics', () => {
  it('空列表返回全零统计', () => {
    const result = calculateAssetStatistics([]);
    expect(result.totalAssets).toBe(0);
    expect(result.totalDailyCost).toBe(0);
    expect(result.totalResaleValue).toBe(0);
    expect(result.statusCounts).toEqual({
      IN_USE: 0,
      IDLE: 0,
      SOLD: 0,
      DISCARDED: 0,
    });
  });

  it('总资产金额 = 所有物品购买价格之和', () => {
    const items = [
      makeItem({ id: '1', purchasePrice: 100 }),
      makeItem({ id: '2', purchasePrice: 200 }),
      makeItem({ id: '3', purchasePrice: 300 }),
    ];
    const result = calculateAssetStatistics(items);
    expect(result.totalAssets).toBe(600);
  });

  it('已删除物品不纳入统计', () => {
    const items = [
      makeItem({ id: '1', purchasePrice: 100 }),
      makeItem({ id: '2', purchasePrice: 200, isDeleted: true }),
    ];
    const result = calculateAssetStatistics(items);
    expect(result.totalAssets).toBe(100);
  });

  it('总资产估值仅包含已填写回收价格的物品', () => {
    const items = [
      makeItem({ id: '1', resalePrice: 80 }),
      makeItem({ id: '2', resalePrice: undefined }),
      makeItem({ id: '3', resalePrice: 50 }),
    ];
    const result = calculateAssetStatistics(items);
    expect(result.totalResaleValue).toBe(130);
  });

  it('resalePrice 为 0 不纳入估值', () => {
    const items = [
      makeItem({ id: '1', resalePrice: 0 }),
      makeItem({ id: '2', resalePrice: 100 }),
    ];
    const result = calculateAssetStatistics(items);
    expect(result.totalResaleValue).toBe(100);
  });

  it('按状态分组统计数量', () => {
    const items = [
      makeItem({ id: '1', status: 'IN_USE' }),
      makeItem({ id: '2', status: 'IN_USE' }),
      makeItem({ id: '3', status: 'IDLE' }),
      makeItem({ id: '4', status: 'SOLD' }),
      makeItem({ id: '5', status: 'DISCARDED', isDeleted: true }),
    ];
    const result = calculateAssetStatistics(items);
    expect(result.statusCounts).toEqual({
      IN_USE: 2,
      IDLE: 1,
      SOLD: 1,
      DISCARDED: 0,
    });
  });

  it('整体日均成本 = 各物品日均成本之和', () => {
    mockNow('2024-01-11');
    // 物品1: 1000 ÷ 10 = 100
    // 物品2: 500 ÷ 10 = 50
    const items = [
      makeItem({ id: '1', purchasePrice: 1000, purchaseDate: '2024-01-01' }),
      makeItem({ id: '2', purchasePrice: 500, purchaseDate: '2024-01-01' }),
    ];
    const result = calculateAssetStatistics(items);
    expect(result.totalDailyCost).toBe(150);
  });
});

describe('getExpiringItems', () => {
  it('空列表返回空数组', () => {
    expect(getExpiringItems([])).toEqual([]);
  });

  it('筛选出 30 天内到期的物品', () => {
    mockNow('2024-06-01');
    const items = [
      makeItem({ id: '1', name: '物品A', warrantyDate: '2024-06-15' }),
      makeItem({ id: '2', name: '物品B', warrantyDate: '2024-08-01' }),
    ];
    const result = getExpiringItems(items);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('物品A');
    expect(result[0]!.daysRemaining).toBe(14);
  });

  it('包含已过期物品（负数天数）', () => {
    mockNow('2024-06-15');
    const items = [
      makeItem({ id: '1', name: '已过期', warrantyDate: '2024-06-10' }),
      makeItem({ id: '2', name: '即将到期', warrantyDate: '2024-06-20' }),
    ];
    const result = getExpiringItems(items);
    expect(result).toHaveLength(2);
    expect(result[0]!.daysRemaining).toBe(-5);
    expect(result[1]!.daysRemaining).toBe(5);
  });

  it('按到期日期升序排列', () => {
    mockNow('2024-06-01');
    const items = [
      makeItem({ id: '1', name: '后到期', warrantyDate: '2024-06-20' }),
      makeItem({ id: '2', name: '先到期', warrantyDate: '2024-06-10' }),
      makeItem({ id: '3', name: '中间', warrantyDate: '2024-06-15' }),
    ];
    const result = getExpiringItems(items);
    expect(result.map((i) => i.name)).toEqual(['先到期', '中间', '后到期']);
  });

  it('已删除物品不纳入', () => {
    mockNow('2024-06-01');
    const items = [
      makeItem({ id: '1', name: '正常', warrantyDate: '2024-06-15' }),
      makeItem({ id: '2', name: '已删除', warrantyDate: '2024-06-10', isDeleted: true }),
    ];
    const result = getExpiringItems(items);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('正常');
  });

  it('无保修日期的物品不纳入', () => {
    mockNow('2024-06-01');
    const items = [
      makeItem({ id: '1', name: '有保修', warrantyDate: '2024-06-15' }),
      makeItem({ id: '2', name: '无保修' }),
    ];
    const result = getExpiringItems(items);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('有保修');
  });

  it('自定义天数范围', () => {
    mockNow('2024-06-01');
    const items = [
      makeItem({ id: '1', name: '7天内', warrantyDate: '2024-06-05' }),
      makeItem({ id: '2', name: '超出范围', warrantyDate: '2024-06-15' }),
    ];
    const result = getExpiringItems(items, 7);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('7天内');
  });
});
