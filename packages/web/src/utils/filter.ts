/**
 * 物品筛选纯函数
 * 支持按名称搜索、分类筛选、状态筛选、标签筛选，多条件 AND 组合
 */

import type { LocalItem, ItemStatus } from '../db/index';

/** 筛选条件 */
export interface FilterCriteria {
  search?: string;
  categoryId?: string;
  status?: ItemStatus;
  tag?: string;
}

/**
 * 按条件筛选物品列表
 * 每个条件可选，多个条件之间为 AND 关系
 */
export function filterItems(items: LocalItem[], criteria: FilterCriteria): LocalItem[] {
  const { search, categoryId, status, tag } = criteria;

  return items.filter((item) => {
    // 按名称搜索（不区分大小写）
    if (search) {
      const keyword = search.toLowerCase();
      if (!item.name.toLowerCase().includes(keyword)) {
        return false;
      }
    }

    // 按分类筛选
    if (categoryId) {
      if (item.categoryId !== categoryId) {
        return false;
      }
    }

    // 按状态筛选
    if (status) {
      if (item.status !== status) {
        return false;
      }
    }

    // 按标签筛选
    if (tag) {
      if (!item.tags.includes(tag)) {
        return false;
      }
    }

    return true;
  });
}
