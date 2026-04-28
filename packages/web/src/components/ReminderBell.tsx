import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalReminder } from '../db/index';
import './ReminderBell.css';

/** 提醒类型中文映射 */
const TYPE_LABEL: Record<string, string> = {
  WARRANTY: '保修',
  EXPIRY: '有效期',
};

/** 格式化到期日期为 YYYY-MM-DD */
function formatDueDate(dateStr: string): string {
  return dateStr.slice(0, 10);
}

/**
 * 提醒通知铃铛组件
 * - 显示未读提醒数量徽章
 * - 点击展开提醒下拉列表
 * - 支持标记单条已读、全部已读
 * - 点击提醒项跳转到物品详情页
 */
export default function ReminderBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // 查询未读提醒数量
  const unreadCount = useLiveQuery(
    () => db.reminders.where('isRead').equals(0).count(),
    [],
    0,
  );

  // 查询所有提醒，按到期日期升序
  const reminders = useLiveQuery(
    () => db.reminders.orderBy('dueDate').toArray(),
    [],
    [] as LocalReminder[],
  );

  /** 点击外部关闭下拉面板 */
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, handleClickOutside]);

  /** 切换下拉面板 */
  function toggleDropdown() {
    setOpen((prev) => !prev);
  }

  /** 标记单条已读并跳转到物品详情 */
  async function handleClickReminder(reminder: LocalReminder) {
    if (!reminder.isRead) {
      await db.reminders.update(reminder.id, { isRead: true });
    }
    setOpen(false);
    navigate(`/items/${reminder.itemId}`);
  }

  /** 全部标记已读 */
  async function handleReadAll() {
    await db.reminders.where('isRead').equals(0).modify({ isRead: true });
  }

  return (
    <div className="reminder-bell" ref={bellRef}>
      <button
        className="reminder-bell-btn"
        aria-label="提醒通知"
        title="提醒通知"
        onClick={toggleDropdown}
      >
        🔔
        {unreadCount > 0 && (
          <span className="reminder-bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="reminder-dropdown">
          {/* 头部 */}
          <div className="reminder-dropdown-header">
            <span className="reminder-dropdown-title">提醒通知</span>
            {unreadCount > 0 && (
              <button className="reminder-read-all-btn" onClick={handleReadAll}>
                全部已读
              </button>
            )}
          </div>

          {/* 提醒列表 */}
          <div className="reminder-list">
            {reminders.length === 0 ? (
              <div className="reminder-empty">暂无提醒</div>
            ) : (
              reminders.map((reminder) => (
                <button
                  key={reminder.id}
                  className={`reminder-item ${reminder.isRead ? '' : 'unread'}`}
                  onClick={() => handleClickReminder(reminder)}
                >
                  <span
                    className={`reminder-unread-dot ${reminder.isRead ? 'read' : ''}`}
                  />
                  <div className="reminder-content">
                    <div className="reminder-item-name">{reminder.itemName}</div>
                    <div className="reminder-meta">
                      <span className="reminder-type">
                        {TYPE_LABEL[reminder.type] ?? reminder.type}
                      </span>
                      <span className={`reminder-priority ${reminder.priority.toLowerCase()}`}>
                        {reminder.priority === 'HIGH' ? '紧急' : '普通'}
                      </span>
                      <span className="reminder-due">
                        {formatDueDate(reminder.dueDate)}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
