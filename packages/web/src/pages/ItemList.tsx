import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ItemStatus, type LocalCategory } from '../db/index';
import { useAuthStore } from '../stores/authStore';
import { filterItems } from '../utils/filter';
import { calculateAssetStatistics, getExpiringItems, type ExpiringItem } from '../utils/statistics';
import ItemCard from '../components/ItemCard';
import './ItemList.css';

type SortOption =
  | 'updated-desc'
  | 'days-desc'
  | 'days-asc'
  | 'price-desc'
  | 'price-asc'
  | 'daily-cost-desc'
  | 'daily-cost-asc'
  | 'name-asc';

/** 状态筛选选项 */
const STATUS_OPTIONS: { value: '' | ItemStatus; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'IN_USE', label: '使用中' },
  { value: 'IDLE', label: '闲置' },
  { value: 'SOLD', label: '已出售' },
  { value: 'DISCARDED', label: '已丢弃' },
];

/** 状态中文映射 */
const STATUS_LABELS: Record<string, string> = {
  IN_USE: '使用中',
  IDLE: '闲置',
  SOLD: '已出售',
  DISCARDED: '已丢弃',
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated-desc', label: '最近更新' },
  { value: 'days-desc', label: '使用天数最长' },
  { value: 'days-asc', label: '使用天数最短' },
  { value: 'price-desc', label: '价格最高' },
  { value: 'price-asc', label: '价格最低' },
  { value: 'daily-cost-desc', label: '日均成本最高' },
  { value: 'daily-cost-asc', label: '日均成本最低' },
  { value: 'name-asc', label: '名称 A-Z' },
];

/** 格式化金额 */
function formatCurrency(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDaysUsed(purchaseDate: string): number {
  return Math.max(0, Math.floor(
    (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24),
  ));
}

/** 保修到期徽章 */
function getExpiringBadge(daysRemaining: number): { className: string; label: string } {
  if (daysRemaining < 0) return { className: 'badge-expired', label: `已过期 ${Math.abs(daysRemaining)} 天` };
  if (daysRemaining <= 7) return { className: 'badge-urgent', label: `剩余 ${daysRemaining} 天` };
  return { className: 'badge-normal', label: `剩余 ${daysRemaining} 天` };
}

/**
 * 物品主页
 * 顶部展示资产统计，下方为物品列表（搜索、筛选、网格）
 */
export default function ItemList() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<'' | ItemStatus>('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExpiring, setShowExpiring] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭导出菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // 自动清除提示信息
  useEffect(() => {
    if (!exportMsg) return;
    const timer = setTimeout(() => setExportMsg(''), 3000);
    return () => clearTimeout(timer);
  }, [exportMsg]);

  /** 导出物品数据 */
  async function handleExport(format: 'excel' | 'pdf') {
    setShowExportMenu(false);
    setExportLoading(true);
    setExportMsg('');
    try {
      const token = useAuthStore.getState().token;
      const body: Record<string, unknown> = {};
      if (categoryId) body.categoryId = categoryId;
      if (status) body.status = status;
      if (tagFilter) body.tags = [tagFilter];

      const response = await fetch(`/api/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        setExportMsg(data?.message || '暂无数据可导出');
        return;
      }
      if (!response.ok) { setExportMsg('导出失败，请稍后重试'); return; }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'excel' ? 'tally-export.xlsx' : 'tally-export.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setExportMsg('导出失败，请检查网络连接');
    } finally {
      setExportLoading(false);
    }
  }

  // 响应式查询
  const allItems = useLiveQuery(() => db.items.filter((item) => !item.isDeleted).toArray(), []);
  const categories = useLiveQuery(() => db.categories.filter((cat) => !cat.isDeleted).toArray(), []);

  const allTags = allItems ? Array.from(new Set(allItems.flatMap((item) => item.tags))).sort() : [];

  const filteredItems = allItems
    ? filterItems(allItems, {
        search: search || undefined,
        categoryId: categoryId || undefined,
        status: (status as ItemStatus) || undefined,
        tag: tagFilter || undefined,
      })
    : [];

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'days-desc':
        return getDaysUsed(b.purchaseDate) - getDaysUsed(a.purchaseDate);
      case 'days-asc':
        return getDaysUsed(a.purchaseDate) - getDaysUsed(b.purchaseDate);
      case 'price-desc':
        return b.purchasePrice - a.purchasePrice;
      case 'price-asc':
        return a.purchasePrice - b.purchasePrice;
      case 'daily-cost-desc':
        return (b.purchasePrice / Math.max(1, getDaysUsed(b.purchaseDate))) -
          (a.purchasePrice / Math.max(1, getDaysUsed(a.purchaseDate)));
      case 'daily-cost-asc':
        return (a.purchasePrice / Math.max(1, getDaysUsed(a.purchaseDate))) -
          (b.purchasePrice / Math.max(1, getDaysUsed(b.purchaseDate)));
      case 'name-asc':
        return a.name.localeCompare(b.name, 'zh-CN');
      case 'updated-desc':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  // 统计数据
  const statistics = allItems ? calculateAssetStatistics(allItems) : null;
  const expiringItems = allItems ? getExpiringItems(allItems) : [];

  return (
    <div className="item-list-page">

      {/* ── 资产统计区 ── */}
      {statistics && (
        <div className="item-list-stats">
          {/* 三张摘要卡片 */}
          <div className="stats-summary">
            <div className="stats-card">
              <span className="stats-label">总资产</span>
              <span className="stats-value">{formatCurrency(statistics.totalAssets)}</span>
            </div>
            <div className="stats-card">
              <span className="stats-label">日均成本</span>
              <span className="stats-value">{formatCurrency(statistics.totalDailyCost)}</span>
            </div>
            <div className="stats-card">
              <span className="stats-label">资产估值</span>
              <span className="stats-value">{formatCurrency(statistics.totalResaleValue)}</span>
            </div>
          </div>

          {/* 状态分布 + 保修提醒（紧凑行） */}
          <div className="stats-meta">
            <div className="stats-status-row">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <span key={key} className="stats-status-chip">
                  <span className="stats-status-count">
                    {statistics.statusCounts[key as keyof typeof statistics.statusCounts]}
                  </span>
                  <span className="stats-status-name">{label}</span>
                </span>
              ))}
            </div>

            {expiringItems.length > 0 && (
              <button
                className="stats-expiring-btn"
                onClick={() => setShowExpiring((v) => !v)}
              >
                ⚠️ {expiringItems.length} 件保修即将到期
                <span className="stats-expiring-arrow">{showExpiring ? '▲' : '▼'}</span>
              </button>
            )}
          </div>

          {/* 保修到期展开列表 */}
          {showExpiring && expiringItems.length > 0 && (
            <div className="stats-expiring-list">
              {expiringItems.map((item: ExpiringItem) => {
                const badge = getExpiringBadge(item.daysRemaining);
                return (
                  <Link key={item.id} to={`/items/${item.id}`} className="stats-expiring-item">
                    <span className="stats-expiring-name">{item.name}</span>
                    <span className="stats-expiring-date">{item.warrantyDate.slice(0, 10)}</span>
                    <span className={`stats-expiring-badge ${badge.className}`}>{badge.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 物品列表区 ── */}
      <div className="item-list-header">
        <h2>物品</h2>
        <div className="item-list-actions">
          <div className="export-dropdown" ref={exportMenuRef}>
            <button
              className="btn-secondary"
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={exportLoading}
            >
              {exportLoading ? '导出中...' : '导出'}
            </button>
            {showExportMenu && (
              <div className="export-dropdown-menu">
                <button className="export-dropdown-item" onClick={() => handleExport('excel')}>
                  📊 导出 Excel
                </button>
                <button className="export-dropdown-item" onClick={() => handleExport('pdf')}>
                  📄 导出 PDF
                </button>
              </div>
            )}
          </div>
          <Link to="/items/new">
            <button className="btn-primary">新增物品</button>
          </Link>
        </div>
      </div>

      {exportMsg && <div className="export-message">{exportMsg}</div>}

      {/* 筛选栏 */}
      <div className="item-list-filters">
        <input
          type="text"
          placeholder="搜索物品名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">全部分类</option>
          {categories?.map((cat: LocalCategory) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as '' | ItemStatus)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">全部标签</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        )}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          aria-label="物品排序"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 物品列表 */}
      {!allItems ? (
        <p className="text-secondary">加载中...</p>
      ) : filteredItems.length === 0 ? (
        <div className="item-list-empty">
          <div className="item-list-empty-icon">📦</div>
          <p>{allItems.length === 0 ? '还没有物品，快去添加吧' : '没有匹配的物品'}</p>
          {allItems.length === 0 && (
            <Link to="/items/new">
              <button className="btn-primary">新增物品</button>
            </Link>
          )}
        </div>
      ) : (
        <div className="item-list-table" aria-label="物品列表">
          {sortedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              categoryName={categories?.find((cat) => cat.id === item.categoryId)?.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
