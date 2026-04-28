import { Link } from 'react-router';
import type { LocalItem } from '../db/index';
import { calculateDailyCost } from '../utils/dailyCost';
import StatusBadge from './StatusBadge';
import './ItemCard.css';

interface ItemCardProps {
  item: LocalItem;
}

/**
 * 物品卡片组件
 * 展示缩略图占位、名称、日均成本、状态徽章
 * 点击跳转到物品详情页
 */
export default function ItemCard({ item }: ItemCardProps) {
  const dailyCost = calculateDailyCost(item.purchasePrice, item.purchaseDate);

  return (
    <Link to={`/items/${item.id}`} className="card item-card">
      {/* 缩略图占位（图片功能后续任务实现） */}
      <div className="item-card-thumb">
        <span className="item-card-thumb-placeholder">📦</span>
      </div>

      <div className="item-card-body">
        <span className="item-card-name" title={item.name}>
          {item.name}
        </span>
        <div className="item-card-footer">
          <span className="item-card-cost">¥{dailyCost.toFixed(2)}/天</span>
          <StatusBadge status={item.status} />
        </div>
      </div>
    </Link>
  );
}
