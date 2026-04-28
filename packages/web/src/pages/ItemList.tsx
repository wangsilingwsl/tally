import { useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ItemStatus, type LocalCategory } from '../db/index';
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
        <Link to="/items/new">
          <button className="btn-primary">新增物品</button>
        </Link>
      </div>

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
