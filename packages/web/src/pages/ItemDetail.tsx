import { useParams, useNavigate, Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index';
import { calculateDailyCost } from '../utils/dailyCost';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import ImageGallery from '../components/ImageGallery';
import { useState, useEffect } from 'react';
import './ItemDetail.css';

/** 物品状态中文映射 */
const STATUS_LABEL: Record<string, string> = {
  IN_USE: '使用中',
  IDLE: '闲置',
  SOLD: '已出售',
  DISCARDED: '已丢弃',
};

/**
 * 保修状态判定
 * - 保修中：距到期 > 30 天
 * - 即将到期：距到期 ≤ 30 天
 * - 已过期：已超过到期日期
 */
function getWarrantyStatus(warrantyDate: string): {
  label: string;
  className: string;
} | null {
  if (!warrantyDate) return null;

  const now = new Date();
  const warranty = new Date(warrantyDate);
  const diffMs = warranty.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: '已过期', className: 'warranty-expired' };
  }
  if (diffDays <= 30) {
    return { label: '即将到期', className: 'warranty-expiring' };
  }
  return { label: '保修中', className: 'warranty-active' };
}

/** 格式化日期为 YYYY-MM-DD */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return dateStr.slice(0, 10);
}

/** 格式化金额 */
function formatPrice(price?: number): string {
  if (price == null) return '—';
  return `¥${price.toFixed(2)}`;
}

/**
 * 物品详情页面
 * 展示物品全部信息，支持编辑和删除操作
 */
export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 响应式查询物品数据
  const item = useLiveQuery(() => {
    if (!id) return undefined;
    return db.items.get(id);
  }, [id]);

  // 响应式查询分类名称
  const category = useLiveQuery(() => {
    if (!item?.categoryId) return undefined;
    return db.categories.get(item.categoryId);
  }, [item?.categoryId]);

  // 物品不存在或已删除时重定向
  useEffect(() => {
    // item === undefined 表示查询尚未完成，不做处理
    // item === null 表示查询完成但未找到
    if (item === null || (item && item.isDeleted)) {
      navigate('/', { replace: true });
    }
  }, [item, navigate]);

  // 加载中
  if (item === undefined) {
    return (
      <div className="item-detail-page">
        <p className="text-secondary">加载中...</p>
      </div>
    );
  }

  // 未找到（防止闪烁，useEffect 会处理重定向）
  if (!item || item.isDeleted) {
    return null;
  }

  const dailyCost = calculateDailyCost(item.purchasePrice, item.purchaseDate);
  const warrantyStatus = item.warrantyDate ? getWarrantyStatus(item.warrantyDate) : null;

  /** 执行软删除 */
  async function handleDelete() {
    if (!id) return;
    const now = new Date().toISOString();
    await db.items.update(id, {
      isDeleted: true,
      syncStatus: 'pending',
      updatedAt: now,
    });
    navigate('/', { replace: true });
  }

  return (
    <div className="item-detail-page">
      {/* 页面头部 */}
      <div className="item-detail-header">
        <div className="item-detail-header-left">
          <Link to="/" className="item-detail-back">← 返回列表</Link>
          <h2>{item.name}</h2>
        </div>
        <div className="item-detail-header-actions">
          <Link to={`/items/${id}/edit`}>
            <button className="btn-secondary">编辑</button>
          </Link>
          <button className="btn-danger" onClick={() => setShowDeleteDialog(true)}>
            删除
          </button>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="item-detail-overview card">
        <div className="item-detail-overview-row">
          <div className="item-detail-stat">
            <span className="item-detail-stat-label">购买价格</span>
            <span className="item-detail-stat-value">{formatPrice(item.purchasePrice)}</span>
          </div>
          <div className="item-detail-stat">
            <span className="item-detail-stat-label">日均成本</span>
            <span className="item-detail-stat-value item-detail-stat-brand">¥{dailyCost.toFixed(2)}/天</span>
          </div>
          <div className="item-detail-stat">
            <span className="item-detail-stat-label">物品状态</span>
            <span className="item-detail-stat-value">
              <StatusBadge status={item.status} />
            </span>
          </div>
          {warrantyStatus && (
            <div className="item-detail-stat">
              <span className="item-detail-stat-label">保修状态</span>
              <span className={`item-detail-warranty-badge ${warrantyStatus.className}`}>
                {warrantyStatus.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 图片画廊 */}
      <div className="item-detail-gallery">
        <ImageGallery itemId={id!} />
      </div>

      {/* 详细信息 */}
      <div className="item-detail-info card">
        <h3>详细信息</h3>
        <div className="item-detail-fields">
          <div className="item-detail-field">
            <span className="item-detail-field-label">名称</span>
            <span className="item-detail-field-value">{item.name}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">品牌</span>
            <span className="item-detail-field-value">{item.brand || '—'}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">型号</span>
            <span className="item-detail-field-value">{item.model || '—'}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">购买日期</span>
            <span className="item-detail-field-value">{formatDate(item.purchaseDate)}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">购买价格</span>
            <span className="item-detail-field-value">{formatPrice(item.purchasePrice)}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">购买渠道</span>
            <span className="item-detail-field-value">{item.purchaseChannel || '—'}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">预估二手回收价格</span>
            <span className="item-detail-field-value">{formatPrice(item.resalePrice)}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">物品状态</span>
            <span className="item-detail-field-value">{STATUS_LABEL[item.status] ?? item.status}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">保修到期日期</span>
            <span className="item-detail-field-value">{formatDate(item.warrantyDate)}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">有效期到期日期</span>
            <span className="item-detail-field-value">{formatDate(item.expiryDate)}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">分类</span>
            <span className="item-detail-field-value">{category?.name || '未分类'}</span>
          </div>
          <div className="item-detail-field">
            <span className="item-detail-field-label">标签</span>
            <span className="item-detail-field-value">
              {item.tags.length > 0 ? (
                <span className="item-detail-tags">
                  {item.tags.map((tag) => (
                    <span key={tag} className="item-detail-tag">{tag}</span>
                  ))}
                </span>
              ) : '—'}
            </span>
          </div>
        </div>

        {/* 备注 */}
        {item.note && (
          <div className="item-detail-note">
            <h4>备注</h4>
            <p>{item.note}</p>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="确认删除"
        message={`确定要删除「${item.name}」吗？删除后可通过同步恢复。`}
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
