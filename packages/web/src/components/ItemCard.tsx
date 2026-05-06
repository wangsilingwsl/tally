import { Link } from 'react-router';
import type { LocalItem } from '../db/index';
import { calculateDailyCost } from '../utils/dailyCost';
import StatusBadge from './StatusBadge';
import './ItemCard.css';

interface ItemCardProps {
  item: LocalItem;
  categoryName?: string;
}

/** 格式化金额 */
function formatCurrency(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDaysUsed(purchaseDate: string): number {
  return Math.max(0, Math.floor(
    (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24),
  ));
}

/**
 * 物品列表行组件
 * 展示名称、分类、状态、价格、日均成本与使用天数
 * 点击跳转到物品详情页
 */
export default function ItemCard({ item, categoryName }: ItemCardProps) {
  const dailyCost = calculateDailyCost(item.purchasePrice, item.purchaseDate);
  const daysUsed = getDaysUsed(item.purchaseDate);
  const purchasedAt = new Date(item.purchaseDate).toLocaleDateString('zh-CN');

  return (
    <Link to={`/items/${item.id}`} className="item-card">
      <div className="item-card-main">
        <span className="item-card-name" title={item.name}>
          {item.name}
        </span>
        <span className="item-card-meta">
          {categoryName || '未分类'} · {purchasedAt}
          {item.brand ? ` · ${item.brand}` : ''}
        </span>
        {item.tags.length > 0 && (
          <span className="item-card-tags">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="item-card-tag">{tag}</span>
            ))}
          </span>
        )}
      </div>

      <div className="item-card-cell item-card-price">
        <span className="item-card-cell-label">购买价格</span>
        <span className="item-card-cell-value">{formatCurrency(item.purchasePrice)}</span>
      </div>

      <div className="item-card-cell">
        <span className="item-card-cell-label">日均成本</span>
        <span className="item-card-cost">{formatCurrency(dailyCost)}/天</span>
      </div>

      <div className="item-card-cell">
        <span className="item-card-cell-label">已使用</span>
        <span className="item-card-cell-value">{daysUsed} 天</span>
      </div>

      <div className="item-card-status">
        <StatusBadge status={item.status} />
      </div>
    </Link>
  );
}
