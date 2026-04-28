import { useSyncStore } from '../stores/syncStore';
import { performSync } from '../db/sync';
import { useState } from 'react';
import './Settings.css';

/**
 * 设置页面
 * 展示同步状态、最近同步时间、手动同步按钮
 * 后续任务中补充邮件通知配置等功能
 */
export default function Settings() {
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const syncing = useSyncStore((s) => s.syncing);
  const online = useSyncStore((s) => s.online);
  const [manualSyncing, setManualSyncing] = useState(false);

  /** 格式化同步时间 */
  function formatSyncTime(iso: string | null): string {
    if (!iso) return '尚未同步';
    try {
      const date = new Date(iso);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '尚未同步';
    }
  }

  /** 手动触发同步 */
  async function handleManualSync() {
    setManualSyncing(true);
    try {
      await performSync();
    } finally {
      setManualSyncing(false);
    }
  }

  const isBusy = syncing || manualSyncing;

  return (
    <div className="settings-page">
      <h1 className="page-title">设置</h1>

      {/* 同步状态卡片 */}
      <section className="settings-section card">
        <h2 className="settings-section-title">数据同步</h2>

        <div className="settings-row">
          <span className="settings-label">网络状态</span>
          <span className={`settings-value ${online ? 'text-success' : 'text-muted'}`}>
            {online ? '在线' : '离线'}
          </span>
        </div>

        <div className="settings-row">
          <span className="settings-label">最近同步时间</span>
          <span className="settings-value">{formatSyncTime(lastSyncAt)}</span>
        </div>

        <div className="settings-row">
          <span className="settings-label">同步操作</span>
          <button
            className="btn-primary"
            onClick={handleManualSync}
            disabled={isBusy || !online}
          >
            {isBusy ? '同步中...' : '立即同步'}
          </button>
        </div>
      </section>

      {/* 占位：后续任务补充邮件通知配置、账户信息等 */}
      <section className="settings-section card">
        <h2 className="settings-section-title">邮件通知</h2>
        <p className="settings-placeholder">此功能将在后续任务中实现</p>
      </section>
    </div>
  );
}
