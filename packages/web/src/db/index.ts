import Dexie, { Table } from 'dexie';

/** 物品状态枚举 */
export type ItemStatus = 'IN_USE' | 'IDLE' | 'SOLD' | 'DISCARDED';

/** 同步状态枚举 */
export type SyncStatus = 'synced' | 'pending' | 'conflict';

/** 本地物品数据结构 */
export interface LocalItem {
  id: string;              // UUID，本地生成
  name: string;
  brand?: string;
  model?: string;
  purchaseDate: string;    // ISO 日期字符串
  purchasePrice: number;
  purchaseChannel?: string;
  resalePrice?: number;
  soldPrice?: number;      // 实际出售价格（状态为 SOLD 时填写）
  status: ItemStatus;
  warrantyDate?: string;
  expiryDate?: string;
  note?: string;
  categoryId?: string;
  tags: string[];          // 标签名数组（前端扁平化存储）
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

/** 本地分类数据结构 */
export interface LocalCategory {
  id: string;
  name: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'synced' | 'pending';
}

/** 本地图片数据结构（Blob 存储原图和缩略图） */
export interface LocalImage {
  id: string;
  itemId: string;
  thumbnailBlob: Blob;     // 缩略图二进制数据
  originalBlob: Blob;      // 原图二进制数据
  mimeType: string;
  size: number;
  createdAt: string;
  syncStatus: 'synced' | 'pending';
}

/** 本地提醒数据结构 */
export interface LocalReminder {
  id: string;
  itemId: string;
  itemName: string;
  type: 'WARRANTY' | 'EXPIRY';
  priority: 'NORMAL' | 'HIGH';
  dueDate: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * Tally 本地数据库
 * 基于 Dexie.js 封装 IndexedDB，实现离线优先的数据持久化
 */
class TallyDatabase extends Dexie {
  items!: Table<LocalItem>;
  categories!: Table<LocalCategory>;
  images!: Table<LocalImage>;
  reminders!: Table<LocalReminder>;

  constructor() {
    super('tally-db');

    this.version(1).stores({
      // items: 主键 id，索引 name/status/categoryId/updatedAt/syncStatus，*tags 为 MultiEntry 索引
      items: 'id, name, status, categoryId, updatedAt, syncStatus, *tags',
      categories: 'id, name, syncStatus',
      images: 'id, itemId, syncStatus',
      reminders: 'id, itemId, isRead, dueDate',
    });
  }
}

/** 全局数据库单例 */
export const db = new TallyDatabase();
