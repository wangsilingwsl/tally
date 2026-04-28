import { db, LocalItem, LocalCategory } from './index';
import { request } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

/** localStorage 中最近同步时间的存储键名 */
const LAST_SYNC_KEY = 'tally_lastSyncAt';

/** 同步间隔：5 分钟 */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** 同步引擎内部状态 */
let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

/** 同步状态变更监听器 */
type SyncListener = (syncing: boolean) => void;
const listeners = new Set<SyncListener>();

/** 通知所有监听器 */
function notifySyncState(syncing: boolean) {
  isSyncing = syncing;
  listeners.forEach((fn) => fn(syncing));
}

/** 注册同步状态监听器，返回取消注册函数 */
export function onSyncStateChange(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 获取当前同步状态 */
export function getSyncingState(): boolean {
  return isSyncing;
}

/** 获取最近同步时间（ISO 字符串或 null） */
export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

/** 保存最近同步时间 */
function setLastSyncTime(time: string) {
  localStorage.setItem(LAST_SYNC_KEY, time);
}

/** Push 响应类型 */
interface PushResponse {
  applied: number;
  skipped: number;
  syncedAt: string;
}

/** Pull 响应类型 */
interface PullResponse {
  changes: PullChange[];
  syncedAt: string;
}

/** 拉取到的单条变更 */
interface PullChange {
  table: 'items' | 'categories';
  type: 'create' | 'update' | 'delete';
  id: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

/**
 * 收集本地待同步的变更记录
 * 查询 IndexedDB 中 syncStatus = 'pending' 的 items 和 categories
 */
async function collectPendingChanges() {
  const pendingItems = await db.items
    .where('syncStatus')
    .equals('pending')
    .toArray();

  const pendingCategories = await db.categories
    .where('syncStatus')
    .equals('pending')
    .toArray();

  const changes: Array<{
    table: 'items' | 'categories';
    type: 'create' | 'update' | 'delete';
    id: string;
    data: Record<string, unknown>;
    updatedAt: string;
  }> = [];

  for (const item of pendingItems) {
    changes.push({
      table: 'items',
      type: item.isDeleted ? 'delete' : 'update',
      id: item.id,
      data: {
        name: item.name,
        brand: item.brand ?? null,
        model: item.model ?? null,
        purchaseDate: item.purchaseDate,
        purchasePrice: item.purchasePrice,
        purchaseChannel: item.purchaseChannel ?? null,
        resalePrice: item.resalePrice ?? null,
        status: item.status,
        warrantyDate: item.warrantyDate ?? null,
        expiryDate: item.expiryDate ?? null,
        note: item.note ?? null,
        categoryId: item.categoryId ?? null,
        tags: item.tags,
        isDeleted: item.isDeleted,
      },
      updatedAt: item.updatedAt,
    });
  }

  for (const cat of pendingCategories) {
    changes.push({
      table: 'categories',
      type: cat.isDeleted ? 'delete' : 'update',
      id: cat.id,
      data: {
        name: cat.name,
        isDeleted: cat.isDeleted,
      },
      updatedAt: cat.updatedAt,
    });
  }

  return { changes, pendingItems, pendingCategories };
}

/**
 * 推送阶段：将本地 pending 记录推送到云端
 * 成功后将对应记录的 syncStatus 更新为 'synced'
 */
async function pushChanges(): Promise<string | null> {
  const { changes, pendingItems, pendingCategories } = await collectPendingChanges();

  if (changes.length === 0) return null;

  const lastSyncAt = getLastSyncTime() || new Date(0).toISOString();

  const result = await request<PushResponse>('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ lastSyncAt, changes }),
  });

  // 推送成功，更新本地记录状态为 synced
  const itemIds = pendingItems.map((i) => i.id);
  const catIds = pendingCategories.map((c) => c.id);

  if (itemIds.length > 0) {
    await db.items
      .where('id')
      .anyOf(itemIds)
      .modify({ syncStatus: 'synced' });
  }

  if (catIds.length > 0) {
    await db.categories
      .where('id')
      .anyOf(catIds)
      .modify({ syncStatus: 'synced' });
  }

  return result.syncedAt;
}

/**
 * 拉取阶段：从云端拉取变更，合并到本地 IndexedDB
 * 使用 Last-Write-Wins 策略处理冲突
 */
async function pullChanges(): Promise<string | null> {
  const lastSyncAt = getLastSyncTime() || new Date(0).toISOString();

  const result = await request<PullResponse>('/api/sync/pull', {
    method: 'POST',
    body: JSON.stringify({ lastSyncAt }),
  });

  for (const change of result.changes) {
    if (change.table === 'items') {
      await mergeItemChange(change);
    } else if (change.table === 'categories') {
      await mergeCategoryChange(change);
    }
  }

  return result.syncedAt;
}

/**
 * 合并单条 items 变更到本地
 * LWW：云端 updatedAt 更新时覆盖本地
 */
async function mergeItemChange(change: PullChange): Promise<void> {
  const { id, data, updatedAt } = change;
  const existing = await db.items.get(id);

  // 本地记录存在且本地更新时间更新，跳过（本地优先）
  if (existing && existing.updatedAt > updatedAt) {
    return;
  }

  const itemData: LocalItem = {
    id,
    name: (data.name as string) ?? '',
    brand: (data.brand as string) ?? undefined,
    model: (data.model as string) ?? undefined,
    purchaseDate: (data.purchaseDate as string) ?? new Date().toISOString(),
    purchasePrice: (data.purchasePrice as number) ?? 0,
    purchaseChannel: (data.purchaseChannel as string) ?? undefined,
    resalePrice: (data.resalePrice as number) ?? undefined,
    status: (data.status as LocalItem['status']) ?? 'IN_USE',
    warrantyDate: (data.warrantyDate as string) ?? undefined,
    expiryDate: (data.expiryDate as string) ?? undefined,
    note: (data.note as string) ?? undefined,
    categoryId: (data.categoryId as string) ?? undefined,
    tags: (data.tags as string[]) ?? [],
    isDeleted: (data.isDeleted as boolean) ?? false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt,
    syncStatus: 'synced',
  };

  await db.items.put(itemData);
}

/**
 * 合并单条 categories 变更到本地
 * LWW：云端 updatedAt 更新时覆盖本地
 */
async function mergeCategoryChange(change: PullChange): Promise<void> {
  const { id, data, updatedAt } = change;
  const existing = await db.categories.get(id);

  if (existing && existing.updatedAt > updatedAt) {
    return;
  }

  const catData: LocalCategory = {
    id,
    name: (data.name as string) ?? '',
    isDeleted: (data.isDeleted as boolean) ?? false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt,
    syncStatus: 'synced',
  };

  await db.categories.put(catData);
}

/**
 * 执行一次完整同步（推送 + 拉取）
 * 同步过程中设置 isSyncing 状态，防止并发同步
 */
export async function performSync(): Promise<void> {
  // 未登录不同步
  const token = useAuthStore.getState().token;
  if (!token) return;

  // 防止并发同步
  if (isSyncing) return;

  notifySyncState(true);

  try {
    // 先推送本地变更
    await pushChanges();

    // 再拉取云端变更
    const syncedAt = await pullChanges();

    // 记录同步时间
    if (syncedAt) {
      setLastSyncTime(syncedAt);
    }
  } catch (err) {
    // 同步失败静默处理，不打断用户操作
    console.warn('[Sync] 同步失败:', err);
  } finally {
    notifySyncState(false);
  }
}

/**
 * 网络恢复事件处理
 */
function handleOnline() {
  performSync();
}

/**
 * 启动同步引擎
 * 登录成功后调用，立即执行全量同步，并启动定时增量同步
 */
export function startSyncEngine(): void {
  // 避免重复启动
  stopSyncEngine();

  // 立即执行一次全量同步
  performSync();

  // 每 5 分钟自动增量同步
  syncTimer = setInterval(performSync, SYNC_INTERVAL_MS);

  // 监听网络恢复事件
  window.addEventListener('online', handleOnline);
}

/**
 * 停止同步引擎
 * 退出登录时调用，清除定时器和事件监听
 */
export function stopSyncEngine(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  window.removeEventListener('online', handleOnline);
}
