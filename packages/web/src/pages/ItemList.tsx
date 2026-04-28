import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ItemStatus, type LocalCategory } from '../db/index';
import { useAuthStore } from '../stores/authStore';
import { filterItems } from '../utils/filter';
import ItemCard from '../components/ItemCard';
import './ItemList.css';

/** 状态筛选选项 */
const STATUS_OPTIONS: { value: '' | ItemStatus; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'IN_USE', label: '使用中' },
  { value: 'IDLE', label: '闲置' },
  { value: 'SOLD', label: '已出售' },
  { value: 'DISCARDED', label: '已丢弃' },
];

/**
 * 物品列表页面
 * 使用 Dexie liveQuery 响应式查询 IndexedDB，支持搜索和筛选
 */
export default function ItemList() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<'' | ItemStatus>('');
  const [tagFilter, setTagFilter] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭导出菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // 自动清除提示信息
  useEffect(() => {
    if (!exportMsg) return;
    const timer = setTimeout(() => setExportMsg(''), 3000);
    return () => clearTimeout(timer);
  }, [exportMsg]);

  /**
   * 导出物品数据
   * 直接使用 fetch 发送 POST 请求，处理 Blob 文件下载
   */
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

      // 后端无数据时返回 JSON 提示
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        setExportMsg(data?.message || '暂无数据可导出');
        return;
      }

      if (!response.ok) {
        setExportMsg('导出失败，请稍后重试');
        return;
      }

      // 接收 Blob 并触发浏览器下载
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

  // 响应式查询所有未删除物品
  const allItems = useLiveQuery(
    () => db.items.filter((item) => !item.isDeleted).toArray(),
    [],
  );

  // 响应式查询所有未删除分类
  const categories = useLiveQuery(
    () => db.categories.filter((cat) => !cat.isDeleted).toArray(),
    [],
  );

  // 提取所有唯一标签用于筛选
  const allTags = allItems
    ? Array.from(new Set(allItems.flatMap((item) => item.tags))).sort()
    : [];

  // 应用筛选条件
  const filteredItems = allItems
    ? filterItems(allItems, {
        search: search || undefined,
        categoryId: categoryId || undefined,
        status: (status as ItemStatus) || undefined,
        tag: tagFilter || undefined,
      })
    : [];

  return (
    <div className="item-list-page">
      {/* 页面头部 */}
      <div className="item-list-header">
        <h2>物品列表</h2>
        <div className="item-list-actions">
          {/* 导出下拉菜单 */}
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

      {/* 导出提示信息 */}
      {exportMsg && (
        <div className="export-message">
          {exportMsg}
        </div>
      )}

      {/* 筛选栏 */}
      <div className="item-list-filters">
        <input
          type="text"
          placeholder="搜索物品名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">全部分类</option>
          {categories?.map((cat: LocalCategory) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | ItemStatus)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="">全部标签</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 物品网格 */}
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
        <div className="item-list-grid">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
