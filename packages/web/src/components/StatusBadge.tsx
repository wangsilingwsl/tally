import type { ItemStatus } from '../db/index';
import './StatusBadge.css';

/** 状态配置：中文标签 + 样式类名 */
const STATUS_MAP: Record<ItemStatus, { label: string; className: string }> = {
  IN_USE: { label: '使用中', className: 'status-badge--active' },
  IDLE: { label: '闲置', className: 'status-badge--warning' },
  SOLD: { label: '已出售', className: 'status-badge--gray' },
  DISCARDED: { label: '已丢弃', className: 'status-badge--danger' },
};

interface StatusBadgeProps {
  status: ItemStatus;
}

/** 物品状态标签组件 */
export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.IN_USE;

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}
