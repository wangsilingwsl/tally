/**
 * 资产总览仪表盘页面
 * 展示总资产、日均成本、估值、状态分组、即将到期保修物品
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { db } from '../db';
import {
  calculateAssetStatistics,
  getExpiringItems,
  type ExpiringItem,
} from '../utils/statistics';
import './Dashboard.css';

/** 状态中文映射 */
const STATUS_LABELS: Record<string, string> = {
  IN_USE: '使用中',
  IDLE: '闲置',
  SOLD: '已出售',
  DISCARDED: '已丢弃',
};

/** 格式化金额显示 */
function formatCurrency(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 获取到期状态徽章样式 */
function getExpiringBadge(daysRemaining: number): { className: string; label: string } {
  if (daysRemaining < 0) {
    return { className: 'badge-expired', label: `已过期 ${Math.abs(daysRemaining)} 天` };
  }
  if (daysRemaining <= 7) {
    return { className: 'badge-urgent', label: `剩余 ${daysRemaining} 天` };
  }
  return { className: 'badge-normal', label: `剩余 ${daysRemaining} 天` };
}

export default function Dashboard() {
  const items = useLiveQuery(() => db.items.filter((item) => !item.isDeleted).toArray());

  if (!items) {
    return <div className="dashboard-loading">加载中...</div>;
  }

  const statistics = calculateAssetStatistics(items);
  const expiringItems = getExpiringItems(items);

  return (
    <div className="dashboard-page">
      <h2>资产总览</h2>

      {/* 统计摘要卡片 */}
      <div className="dashboard-summary">
        <div className="dashboard-summary-card">
          <span className="dashboard-summary-label">总资产金额</span>
          <span className="dashboard-summary-value">{formatCurrency(statistics.totalAssets)}</span>
        </div>
        <div className="dashboard-summary-card">
          <span className="dashboard-summary-label">整体日均成本</span>
          <span className="dashboard-summary-value">{formatCurrency(statistics.totalDailyCost)}</span>
        </div>
        <div className="dashboard-summary-card">
          <span className="dashboard-summary-label">总资产估值</span>
          <span className="dashboard-summary-value">{formatCurrency(statistics.totalResaleValue)}</span>
        </div>
      </div>

      {/* 状态分组 */}
      <div className="dashboard-status">
        <h3>物品状态分布</h3>
        <div className="dashboard-status-grid">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="dashboard-status-card">
              <span className="dashboard-status-count">
                {statistics.statusCounts[key as keyof typeof statistics.statusCounts]}
              </span>
              <span className="dashboard-status-name">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 即将到期保修物品 */}
      <div className="dashboard-expiring">
        <h3>保修到期提醒</h3>
        {expiringItems.length === 0 ? (
          <div className="dashboard-expiring-empty">暂无即将到期的保修物品</div>
        ) : (
          <div className="dashboard-expiring-list">
            {expiringItems.map((item: ExpiringItem) => {
              const badge = getExpiringBadge(item.daysRemaining);
              return (
                <Link
                  key={item.id}
                  to={`/items/${item.id}`}
                  className="dashboard-expiring-item"
                >
                  <div className="dashboard-expiring-item-info">
                    <span className="dashboard-expiring-item-name">{item.name}</span>
                    <span className="dashboard-expiring-item-date">
                      保修到期：{item.warrantyDate}
                    </span>
                  </div>
                  <span className={`dashboard-expiring-badge ${badge.className}`}>
                    {badge.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
