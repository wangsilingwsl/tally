import { describe, it, expect } from 'vitest';
import { determineReminderPriority } from './reminder';

describe('determineReminderPriority', () => {
  const now = new Date('2024-06-15');

  it('距到期超过 30 天，返回 null', () => {
    // 2024-07-16 距 6-15 = 31 天
    expect(determineReminderPriority('2024-07-16', now)).toBe(null);
  });

  it('距到期恰好 31 天，返回 null', () => {
    expect(determineReminderPriority('2024-07-16', now)).toBe(null);
  });

  it('距到期恰好 30 天，返回 NORMAL', () => {
    // 2024-07-15 距 6-15 = 30 天
    expect(determineReminderPriority('2024-07-15', now)).toBe('NORMAL');
  });

  it('距到期 15 天，返回 NORMAL', () => {
    // 2024-06-30 距 6-15 = 15 天
    expect(determineReminderPriority('2024-06-30', now)).toBe('NORMAL');
  });

  it('距到期 8 天，返回 NORMAL', () => {
    // 2024-06-23 距 6-15 = 8 天
    expect(determineReminderPriority('2024-06-23', now)).toBe('NORMAL');
  });

  it('距到期恰好 7 天，返回 HIGH', () => {
    // 2024-06-22 距 6-15 = 7 天
    expect(determineReminderPriority('2024-06-22', now)).toBe('HIGH');
  });

  it('距到期 3 天，返回 HIGH', () => {
    // 2024-06-18 距 6-15 = 3 天
    expect(determineReminderPriority('2024-06-18', now)).toBe('HIGH');
  });

  it('距到期 1 天，返回 HIGH', () => {
    // 2024-06-16 距 6-15 = 1 天
    expect(determineReminderPriority('2024-06-16', now)).toBe('HIGH');
  });

  it('到期日等于当前日期（0 天），返回 HIGH', () => {
    expect(determineReminderPriority('2024-06-15', now)).toBe('HIGH');
  });

  it('已过期 1 天，返回 HIGH', () => {
    // 2024-06-14 距 6-15 = -1 天
    expect(determineReminderPriority('2024-06-14', now)).toBe('HIGH');
  });

  it('已过期很久，返回 HIGH', () => {
    expect(determineReminderPriority('2024-01-01', now)).toBe('HIGH');
  });

  it('距到期远超 30 天，返回 null', () => {
    expect(determineReminderPriority('2025-06-15', now)).toBe(null);
  });

  it('不传 now 参数时使用当前时间', () => {
    // 使用一个足够远的未来日期，确保返回 null
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 1);
    expect(determineReminderPriority(farFuture.toISOString())).toBe(null);
  });

  it('不传 now 参数，使用已过期日期返回 HIGH', () => {
    expect(determineReminderPriority('2020-01-01')).toBe('HIGH');
  });
});
