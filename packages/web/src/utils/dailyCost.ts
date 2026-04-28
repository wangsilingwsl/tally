/**
 * 日均成本计算工具函数
 * 简易版本，供物品列表页使用；完整版本将在 task 5.1 中实现
 */

/**
 * 计算物品日均成本
 * - 已使用天数 > 0：日均成本 = 购买价格 ÷ 已使用天数，精确到小数点后两位
 * - 已使用天数 = 0（购买日期等于当前日期）：日均成本 = 购买价格本身
 */
export function calculateDailyCost(purchasePrice: number, purchaseDate: string): number {
  const days = Math.floor(
    (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return purchasePrice;
  return Math.round((purchasePrice / days) * 100) / 100;
}
