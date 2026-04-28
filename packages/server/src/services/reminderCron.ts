import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

/** 提醒类型 */
type ReminderType = 'WARRANTY' | 'EXPIRY';
/** 提醒优先级 */
type ReminderPriority = 'NORMAL' | 'HIGH';

/**
 * 创建 SMTP 邮件传输器
 * 仅在配置了 SMTP_HOST 时创建，否则返回 null
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: (Number(process.env.SMTP_PORT) || 587) === 465,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
}

/**
 * 根据距到期天数判定提醒优先级
 * ≤7 天: HIGH, 8-30 天: NORMAL
 */
function getPriority(daysUntilDue: number): ReminderPriority {
  return daysUntilDue <= 7 ? 'HIGH' : 'NORMAL';
}

/**
 * 获取提醒类型对应的中文描述
 */
function getReminderTypeLabel(type: ReminderType): string {
  return type === 'WARRANTY' ? '保修到期' : '有效期到期';
}

/**
 * 扫描即将到期物品并生成提醒记录
 * 查询所有 warrantyDate 或 expiryDate 在未来 30 天内到期的物品
 */
async function scanAndCreateReminders(prisma: PrismaClient) {
  const now = new Date();
  const thirtyDaysLater = new Date(now);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  // 查询所有未删除且有到期日期在 30 天内的物品
  const items = await prisma.item.findMany({
    where: {
      isDeleted: false,
      OR: [
        {
          warrantyDate: {
            gte: now,
            lte: thirtyDaysLater,
          },
        },
        {
          expiryDate: {
            gte: now,
            lte: thirtyDaysLater,
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      userId: true,
      warrantyDate: true,
      expiryDate: true,
    },
  });

  const newReminders: Array<{
    userId: string;
    itemId: string;
    itemName: string;
    type: ReminderType;
    priority: ReminderPriority;
    dueDate: Date;
  }> = [];

  for (const item of items) {
    // 处理保修到期提醒
    if (item.warrantyDate && item.warrantyDate >= now && item.warrantyDate <= thirtyDaysLater) {
      const daysUntilDue = Math.ceil(
        (item.warrantyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // 按 itemId + type 去重，检查是否已存在
      const existing = await prisma.reminder.findFirst({
        where: { itemId: item.id, type: 'WARRANTY' },
      });

      if (!existing) {
        newReminders.push({
          userId: item.userId,
          itemId: item.id,
          itemName: item.name,
          type: 'WARRANTY',
          priority: getPriority(daysUntilDue),
          dueDate: item.warrantyDate,
        });
      } else if (existing.priority === 'NORMAL' && daysUntilDue <= 7) {
        // 已有 NORMAL 提醒但现在距到期 ≤7 天，升级为 HIGH
        await prisma.reminder.update({
          where: { id: existing.id },
          data: { priority: 'HIGH' },
        });
      }
    }

    // 处理有效期到期提醒
    if (item.expiryDate && item.expiryDate >= now && item.expiryDate <= thirtyDaysLater) {
      const daysUntilDue = Math.ceil(
        (item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const existing = await prisma.reminder.findFirst({
        where: { itemId: item.id, type: 'EXPIRY' },
      });

      if (!existing) {
        newReminders.push({
          userId: item.userId,
          itemId: item.id,
          itemName: item.name,
          type: 'EXPIRY',
          priority: getPriority(daysUntilDue),
          dueDate: item.expiryDate,
        });
      } else if (existing.priority === 'NORMAL' && daysUntilDue <= 7) {
        await prisma.reminder.update({
          where: { id: existing.id },
          data: { priority: 'HIGH' },
        });
      }
    }
  }

  // 批量创建新提醒
  if (newReminders.length > 0) {
    await prisma.reminder.createMany({ data: newReminders });
  }

  return newReminders.length;
}

/**
 * 为已开启邮件通知的用户发送提醒邮件
 * 仅发送 emailSent=false 的提醒，发送后标记为已发送
 */
async function sendReminderEmails(prisma: PrismaClient) {
  const transporter = createTransporter();
  if (!transporter) {
    return 0;
  }

  // 查询所有开启邮件通知且有未发送邮件的提醒的用户
  const users = await prisma.user.findMany({
    where: {
      emailEnabled: true,
      notifyEmail: { not: null },
      reminders: {
        some: { emailSent: false },
      },
    },
    include: {
      reminders: {
        where: { emailSent: false },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  let sentCount = 0;

  for (const user of users) {
    if (!user.notifyEmail || user.reminders.length === 0) continue;

    // 构建邮件内容
    const reminderLines = user.reminders.map((r) => {
      const typeLabel = getReminderTypeLabel(r.type as ReminderType);
      const priorityLabel = r.priority === 'HIGH' ? '【紧急】' : '';
      const dueDateStr = r.dueDate.toISOString().split('T')[0];
      return `${priorityLabel}${r.itemName} - ${typeLabel}（${dueDateStr}）`;
    });

    const mailContent = [
      '您好，以下物品即将到期，请及时处理：',
      '',
      ...reminderLines,
      '',
      '— 归物 · Tally',
    ].join('\n');

    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER || 'noreply@tally.app',
        to: user.notifyEmail,
        subject: `归物提醒：您有 ${user.reminders.length} 件物品即将到期`,
        text: mailContent,
      });

      // 标记这些提醒的邮件已发送
      const reminderIds = user.reminders.map((r) => r.id);
      await prisma.reminder.updateMany({
        where: { id: { in: reminderIds } },
        data: { emailSent: true },
      });

      sentCount += user.reminders.length;
    } catch (err) {
      // 邮件发送失败，记录错误但不中断其他用户的发送
      console.error(`发送提醒邮件失败 (${user.notifyEmail}):`, err);
    }
  }

  return sentCount;
}

/**
 * 启动提醒定时任务
 * 每天凌晨 2:00 扫描即将到期物品，生成提醒并发送邮件
 */
export function startReminderCron(prisma: PrismaClient) {
  // 每天凌晨 2:00 执行
  cron.schedule('0 2 * * *', async () => {
    console.log('[提醒定时任务] 开始执行...');

    try {
      const newCount = await scanAndCreateReminders(prisma);
      console.log(`[提醒定时任务] 新增 ${newCount} 条提醒`);

      const sentCount = await sendReminderEmails(prisma);
      console.log(`[提醒定时任务] 发送 ${sentCount} 封提醒邮件`);
    } catch (err) {
      console.error('[提醒定时任务] 执行失败:', err);
    }

    console.log('[提醒定时任务] 执行完毕');
  });

  console.log('[提醒定时任务] 已注册，每天 02:00 执行');
}
