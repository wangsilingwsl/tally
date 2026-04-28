import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateDailyCost } from './dailyCost';

/** 固定 Date.now 到指定日期，方便测试 */
function mockNow(dateStr: string) {
  vi.spyOn(Date, 'now').mockReturnValue(new Date(dateStr).getTime());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('calculateDailyCost', () => {
  it('购买日期等于当前日期时，日均成本 = 购买价格', () => {
    mockNow('2024-06-15');
    expect(calculateDailyCost(999, '2024-06-15')).toBe(999);
  });

  it('购买 1 天前，日均成本 = 价格 ÷ 1', () => {
    mockNow('2024-06-16');
    expect(calculateDailyCost(100, '2024-06-15')).toBe(100);
  });

  it('购买 10 天前，日均成本 = 价格 ÷ 10', () => {
    mockNow('2024-06-25');
    expect(calculateDailyCost(100, '2024-06-15')).toBe(10);
  });

  it('购买 100 天前，日均成本 = 价格 ÷ 100', () => {
    mockNow('2024-09-23');
    expect(calculateDailyCost(100, '2024-06-15')).toBe(1);
  });

  it('精确到小数点后两位', () => {
    mockNow('2024-06-18');
    // 100 ÷ 3 = 33.333... → 33.33
    expect(calculateDailyCost(100, '2024-06-15')).toBe(33.33);
  });

  it('精确到小数点后两位（四舍五入）', () => {
    mockNow('2024-06-21');
    // 100 ÷ 6 = 16.666... → 16.67
    expect(calculateDailyCost(100, '2024-06-15')).toBe(16.67);
  });

  it('未来购买日期，日均成本 = 购买价格', () => {
    mockNow('2024-06-15');
    expect(calculateDailyCost(500, '2024-07-01')).toBe(500);
  });

  it('购买价格为 0 时，日均成本为 0', () => {
    mockNow('2024-06-25');
    expect(calculateDailyCost(0, '2024-06-15')).toBe(0);
  });

  it('大额购买价格计算正确', () => {
    mockNow('2024-06-22');
    // 99999.99 ÷ 7 = 14285.7128... → 14285.71
    expect(calculateDailyCost(99999.99, '2024-06-15')).toBe(14285.71);
  });

  it('购买 365 天前', () => {
    mockNow('2025-06-15');
    // 3650 ÷ 365 = 10
    expect(calculateDailyCost(3650, '2024-06-15')).toBe(10);
  });
});
