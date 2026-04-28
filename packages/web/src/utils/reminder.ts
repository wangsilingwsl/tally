/**
 * 保修提醒扫描引擎
 * 纯函数 + IndexedDB 扫描，实现离线提醒生成
 */

import { db, type LocalItem } from '../db';

/** 提醒优先级类型 */
export type ReminderPriority = 'NORMAL' | 'HIGH' | null;

/** 提醒类型 */
export type ReminderType = 'WARRANTY' | 'EXPIRY';

/**
 * 判定提醒优先级（纯函数）
 * - 距到期超过 30 天：不生成提醒（返回 null）
 * - 距到期 8~30 天：NORMAL 优先级
 * - 距到期 7 天及以内（含已过期）：HIGH 优先级
 */
export function determineReminderPriority(
  dueDate: string,
  now?: Date,
): ReminderPriority {
  const current = now ?? new Date();
  const currentDay = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const daysRemaining = Math.floor(
    (dueDay.getTime() - currentDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysRemaining > 30) return null;
  if (daysRemaining <= 7) return 'HIGH';
  return 'NORMAL';
}

/**
 * 生成提醒 ID（基于 itemId + type 去重）
 */
function buildReminderId(itemId: string, type: ReminderType): string {
  return `${itemId}_${type}`;
}

/**
 * 扫描 IndexedDB 中所有物品，生成或更新提醒
 * - 查询所有未删除物品
 * - 对 warrantyDate / expiryDate 分别判定优先级
 * - 按 itemId + type 去重，新增或更新提醒记录
 */
export async function scanAndGenerateReminders(): Promise<void> {
  const items = await db.items.filter((item) => !item.isDeleted).toArray();

  for (const item of items) {
    await processItemDate(item, 'WARRANTY', item.warrantyDate);
    await processItemDate(item, 'EXPIRY', item.expiryDate);
  }
}

/**
 * 处理单个物品的某个日期字段，生成或更新提醒
 */
async function processItemDate(
  item: LocalItem,
  type: ReminderType,
  dateStr: string | undefined,
): Promise<void> {
  const reminderId = buildReminderId(item.id, type);

  if (!dateStr) {
    // 日期为空，删除已有提醒
    await db.reminders.delete(reminderId);
    return;
  }

  const priority = determineReminderPriority(dateStr);

  if (priority === null) {
    // 不需要提醒，删除已有记录
    await db.reminders.delete(reminderId);
    return;
  }

  const existing = await db.reminders.get(reminderId);

  if (existing) {
    // 已有提醒，仅在优先级变化时更新
    if (existing.priority !== priority) {
      await db.reminders.update(reminderId, { priority });
    }
  } else {
    // 新增提醒
    await db.reminders.put({
      id: reminderId,
      itemId: item.id,
      itemName: item.name,
      type,
      priority,
      dueDate: dateStr,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }
}
