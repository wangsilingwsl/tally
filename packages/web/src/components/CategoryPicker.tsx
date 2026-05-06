import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalCategory } from '../db/index';
import ConfirmDialog from './ConfirmDialog';
import './CategoryPicker.css';

interface CategoryPickerProps {
  /** 当前选中的分类 ID */
  value: string | undefined;
  /** 分类变更回调 */
  onChange: (categoryId: string | undefined) => void;
}

/** 新建分类的特殊选项值 */
const CREATE_NEW_VALUE = '__create_new__';

/** 预置分类列表 */
const DEFAULT_CATEGORIES = [
  '电子产品',
  '服饰鞋包',
  '家用电器',
  '家具家居',
  '运动户外',
  '图书文具',
  '食品保健',
  '美妆护肤',
  '交通出行',
  '其他',
];

const CATEGORY_ORDER = new Map(DEFAULT_CATEGORIES.map((name, index) => [name, index]));

function sortCategories(categories: LocalCategory[]): LocalCategory[] {
  return [...categories].sort((a, b) => {
    const orderA = CATEGORY_ORDER.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const orderB = CATEGORY_ORDER.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** 防止重复初始化的模块级标记 */
let seeded = false;

/**
 * 初始化预置分类（整个应用生命周期内只执行一次）
 * 同时清理已存在的重复分类记录
 */
async function seedDefaultCategories(): Promise<void> {
  if (seeded) return;
  seeded = true;

  // 清理重复分类：按名称去重，保留最早创建的那条
  const all = await db.categories.filter((c) => !c.isDeleted).toArray();
  const seen = new Map<string, string>(); // name → id (最早的)
  const duplicateIds: string[] = [];

  // 按 createdAt 升序排列，保留最早的
  all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const cat of all) {
    if (seen.has(cat.name)) {
      duplicateIds.push(cat.id);
    } else {
      seen.set(cat.name, cat.id);
    }
  }
  if (duplicateIds.length > 0) {
    await db.categories.bulkDelete(duplicateIds);
  }

  // 如果已有分类（去重后），不再插入预置数据
  const count = await db.categories.count();
  if (count > 0) return;

  const now = new Date().toISOString();
  const records: LocalCategory[] = DEFAULT_CATEGORIES.map((name) => ({
    id: crypto.randomUUID(),
    name,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  }));

  await db.categories.bulkAdd(records);
}

/**
 * 分类选择器组件
 * 支持选择已有分类、新建分类、编辑/删除分类
 */
export default function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [showManage, setShowManage] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LocalCategory | null>(null);

  // 响应式查询所有未删除分类
  const categories = useLiveQuery(
    () => db.categories.filter((cat) => !cat.isDeleted).toArray(),
    [],
  );
  const sortedCategories = categories ? sortCategories(categories) : undefined;

  // 首次加载时初始化预置分类
  useEffect(() => {
    seedDefaultCategories().catch(() => {});
  }, []);

  /** 下拉框变更 */
  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === CREATE_NEW_VALUE) {
      setShowCreate(true);
      setNewName('');
      setCreateError('');
    } else {
      setShowCreate(false);
      onChange(val || undefined);
    }
  }

  /** 创建新分类 */
  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateError('请输入分类名称');
      return;
    }

    // 检查重复
    const existing = categories?.find(
      (cat) => cat.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      setCreateError('分类名称已存在');
      return;
    }

    try {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      await db.categories.add({
        id,
        name: trimmed,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
      });
      onChange(id);
      setShowCreate(false);
      setNewName('');
      setCreateError('');
    } catch {
      setCreateError('创建失败，请重试');
    }
  }

  /** 新建输入框按键处理 */
  function handleCreateKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      setShowCreate(false);
      setNewName('');
      setCreateError('');
    }
  }

  /** 开始编辑分类 */
  function startEdit(cat: LocalCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditError('');
  }

  /** 保存编辑 */
  async function saveEdit() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('分类名称不能为空');
      return;
    }

    // 检查重复（排除自身）
    const existing = categories?.find(
      (cat) => cat.id !== editingId && cat.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      setEditError('分类名称已存在');
      return;
    }

    try {
      const now = new Date().toISOString();
      await db.categories.update(editingId, {
        name: trimmed,
        updatedAt: now,
        syncStatus: 'pending',
      });
      setEditingId(null);
      setEditName('');
      setEditError('');
    } catch {
      setEditError('保存失败，请重试');
    }
  }

  /** 编辑输入框按键处理 */
  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditError('');
    }
  }

  /** 确认删除分类 */
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const now = new Date().toISOString();

    // 将该分类下所有物品的 categoryId 设为 undefined
    const itemsInCategory = await db.items
      .where('categoryId')
      .equals(deleteTarget.id)
      .toArray();

    await db.transaction('rw', [db.categories, db.items], async () => {
      // 软删除分类
      await db.categories.update(deleteTarget.id, {
        isDeleted: true,
        updatedAt: now,
        syncStatus: 'pending',
      });
      // 清除物品的分类关联
      for (const item of itemsInCategory) {
        await db.items.update(item.id, {
          categoryId: undefined,
          updatedAt: now,
          syncStatus: 'pending',
        });
      }
    });

    // 如果当前选中的就是被删除的分类，重置为未分类
    if (value === deleteTarget.id) {
      onChange(undefined);
    }
    setDeleteTarget(null);
  }

  return (
    <div className="category-picker">
      {/* 选择器行 */}
      <div className="category-picker-row">
        <select
          value={showCreate ? CREATE_NEW_VALUE : (value ?? '')}
          onChange={handleSelectChange}
          aria-label="选择分类"
        >
          <option value="">未分类</option>
          {sortedCategories?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
          <option value={CREATE_NEW_VALUE}>+ 新建分类</option>
        </select>
        {categories && categories.length > 0 && (
          <button
            type="button"
            className="category-picker-manage-btn"
            onClick={() => setShowManage(!showManage)}
            title="管理分类"
            aria-label="管理分类"
          >
            ⚙
          </button>
        )}
      </div>

      {/* 新建分类输入 */}
      {showCreate && (
        <div className="category-picker-create">
          <input
            type="text"
            placeholder="输入新分类名称"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setCreateError('');
            }}
            onKeyDown={handleCreateKeyDown}
            autoFocus
          />
          <button type="button" className="btn-primary" onClick={handleCreate}>
            添加
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setShowCreate(false);
              setNewName('');
              setCreateError('');
            }}
          >
            取消
          </button>
        </div>
      )}
      {createError && <span className="category-picker-error">{createError}</span>}

      {/* 分类管理面板 */}
      {showManage && sortedCategories && sortedCategories.length > 0 && (
        <div className="category-manage-panel">
          <div className="category-manage-panel-title">分类管理</div>
          <div className="category-manage-list">
            {sortedCategories.map((cat) => (
              <div key={cat.id} className="category-manage-item">
                {editingId === cat.id ? (
                  <>
                    <div className="category-manage-item-edit">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          setEditError('');
                        }}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                      />
                    </div>
                    <div className="category-manage-item-actions">
                      <button
                        type="button"
                        className="category-manage-action-btn"
                        onClick={saveEdit}
                        title="保存"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="category-manage-action-btn"
                        onClick={() => {
                          setEditingId(null);
                          setEditError('');
                        }}
                        title="取消"
                      >
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="category-manage-item-name">{cat.name}</span>
                    <div className="category-manage-item-actions">
                      <button
                        type="button"
                        className="category-manage-action-btn"
                        onClick={() => startEdit(cat)}
                        title="编辑"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="category-manage-action-btn danger"
                        onClick={() => setDeleteTarget(cat)}
                        title="删除"
                      >
                        🗑
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          {editError && <span className="category-picker-error">{editError}</span>}
        </div>
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除分类"
        message={`确定要删除分类「${deleteTarget?.name ?? ''}」吗？该分类下的物品将变为"未分类"。`}
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
