import { describe, it, expect } from 'vitest';
import { filterItems } from './filter';
import type { LocalItem } from '../db/index';

/** 创建测试用物品 */
function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    id: crypto.randomUUID(),
    name: '测试物品',
    purchaseDate: '2024-01-01',
    purchasePrice: 100,
    status: 'IN_USE',
    tags: [],
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    syncStatus: 'synced',
    ...overrides,
  };
}

describe('filterItems', () => {
  const items: LocalItem[] = [
    makeItem({ name: 'MacBook Pro', status: 'IN_USE', categoryId: 'cat-1', tags: ['电子'] }),
    makeItem({ name: 'iPhone 15', status: 'IN_USE', categoryId: 'cat-1', tags: ['电子', '手机'] }),
    makeItem({ name: '书桌', status: 'IDLE', categoryId: 'cat-2', tags: ['家具'] }),
    makeItem({ name: '旧手机', status: 'SOLD', categoryId: 'cat-1', tags: ['电子', '手机'] }),
    makeItem({ name: '坏掉的耳机', status: 'DISCARDED', tags: [] }),
  ];

  it('无筛选条件时返回全部物品', () => {
    expect(filterItems(items, {})).toHaveLength(5);
  });

  it('按名称搜索（不区分大小写）', () => {
    expect(filterItems(items, { search: 'macbook' })).toHaveLength(1);
    expect(filterItems(items, { search: 'MACBOOK' })).toHaveLength(1);
    expect(filterItems(items, { search: '手机' })).toHaveLength(1);
  });

  it('按分类筛选', () => {
    expect(filterItems(items, { categoryId: 'cat-1' })).toHaveLength(3);
    expect(filterItems(items, { categoryId: 'cat-2' })).toHaveLength(1);
    expect(filterItems(items, { categoryId: 'cat-999' })).toHaveLength(0);
  });

  it('按状态筛选', () => {
    expect(filterItems(items, { status: 'IN_USE' })).toHaveLength(2);
    expect(filterItems(items, { status: 'IDLE' })).toHaveLength(1);
    expect(filterItems(items, { status: 'SOLD' })).toHaveLength(1);
    expect(filterItems(items, { status: 'DISCARDED' })).toHaveLength(1);
  });

  it('按标签筛选', () => {
    expect(filterItems(items, { tag: '电子' })).toHaveLength(3);
    expect(filterItems(items, { tag: '手机' })).toHaveLength(2);
    expect(filterItems(items, { tag: '家具' })).toHaveLength(1);
    expect(filterItems(items, { tag: '不存在' })).toHaveLength(0);
  });

  it('多条件 AND 组合', () => {
    // 名称含"手机" + 状态为使用中
    expect(filterItems(items, { search: '手机', status: 'IN_USE' })).toHaveLength(0);
    // 名称含"手机" + 状态为已出售
    expect(filterItems(items, { search: '手机', status: 'SOLD' })).toHaveLength(1);
    // 分类 cat-1 + 标签"手机"
    expect(filterItems(items, { categoryId: 'cat-1', tag: '手机' })).toHaveLength(2);
    // 分类 cat-1 + 状态使用中 + 标签"手机"
    expect(filterItems(items, { categoryId: 'cat-1', status: 'IN_USE', tag: '手机' })).toHaveLength(1);
  });

  it('空列表返回空数组', () => {
    expect(filterItems([], { search: '任意' })).toHaveLength(0);
  });
});
