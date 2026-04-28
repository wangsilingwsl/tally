import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import { performSync } from '../db/sync';
import { request, ApiRequestError } from '../utils/api';
import { useState, useEffect } from 'react';
import './Settings.css';

/** 用户设置响应类型 */
interface UserSettingsResponse {
  user: {
    id: string;
    email: string;
    notifyEmail: string | null;
    emailEnabled: boolean;
    createdAt: string;
  };
}

/**
 * 设置页面
 * 包含同步状态、邮件通知配置、账户信息三个模块
 */
export default function Settings() {
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const syncing = useSyncStore((s) => s.syncing);
  const online = useSyncStore((s) => s.online);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [manualSyncing, setManualSyncing] = useState(false);

  /* 邮件通知表单状态 */
  const [notifyEmail, setNotifyEmail] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailError, setEmailError] = useState('');

  /** 页面加载时从后端获取最新用户设置 */
  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await request<UserSettingsResponse>('/api/auth/me');
        setNotifyEmail(data.user.notifyEmail || '');
        setEmailEnabled(data.user.emailEnabled);
        // 同步更新 authStore 中的用户信息
        updateUser(data.user);
      } catch {
        // 获取失败时使用本地缓存数据
        if (user) {
          setNotifyEmail(user.notifyEmail || '');
          setEmailEnabled(user.emailEnabled || false);
        }
      }
    }
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** 格式化账户创建时间 */
  function formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '—';
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

  /** 校验提醒邮箱格式 */
  function validateEmail(email: string): boolean {
    if (!email.trim()) return true; // 允许为空（清除提醒邮箱）
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  /** 保存邮件通知设置 */
  async function handleSaveEmail() {
    setEmailError('');
    setSaveMsg(null);

    if (!validateEmail(notifyEmail)) {
      setEmailError('邮箱格式不正确');
      return;
    }

    setSaving(true);
    try {
      const data = await request<UserSettingsResponse>('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          notifyEmail: notifyEmail.trim() || null,
          emailEnabled,
        }),
      });
      updateUser(data.user);
      setSaveMsg({ type: 'success', text: '设置已保存' });
      // 3 秒后自动清除成功提示
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : '保存失败，请稍后重试';
      setSaveMsg({ type: 'error', text: message });
    } finally {
      setSaving(false);
    }
  }

  const isBusy = syncing || manualSyncing;

  return (
    <div className="settings-page">
      <h2>设置</h2>

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

      {/* 邮件通知配置卡片 */}
      <section className="settings-section card">
        <h2 className="settings-section-title">邮件通知</h2>

        <div className="settings-form-group">
          <label className="settings-form-label" htmlFor="notifyEmail">
            提醒邮箱地址
          </label>
          <input
            id="notifyEmail"
            type="email"
            className="settings-input"
            placeholder="接收保修到期提醒的邮箱"
            value={notifyEmail}
            onChange={(e) => {
              setNotifyEmail(e.target.value);
              setEmailError('');
              setSaveMsg(null);
            }}
          />
          {emailError && <span className="settings-field-error">{emailError}</span>}
          <p className="settings-hint">留空则使用登录邮箱接收提醒</p>
        </div>

        <div className="settings-row settings-toggle-row">
          <div>
            <span className="settings-label">开启邮件通知</span>
            <p className="settings-hint">开启后将在保修到期前通过邮件提醒</p>
          </div>
          <label className="settings-toggle" htmlFor="emailEnabled">
            <input
              id="emailEnabled"
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => {
                setEmailEnabled(e.target.checked);
                setSaveMsg(null);
              }}
            />
            <span className="settings-toggle-slider" />
          </label>
        </div>

        {saveMsg && (
          <div className={`settings-msg settings-msg-${saveMsg.type}`}>
            {saveMsg.text}
          </div>
        )}

        <div className="settings-actions">
          <button
            className="btn-primary"
            onClick={handleSaveEmail}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </section>

      {/* 账户信息卡片 */}
      <section className="settings-section card">
        <h2 className="settings-section-title">账户信息</h2>

        <div className="settings-row">
          <span className="settings-label">登录邮箱</span>
          <span className="settings-value">{user?.email || '—'}</span>
        </div>

        <div className="settings-row">
          <span className="settings-label">注册时间</span>
          <span className="settings-value">{formatDate(user?.createdAt)}</span>
        </div>
      </section>
    </div>
  );
}
