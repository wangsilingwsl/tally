import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { db, type ItemStatus } from '../db/index';
import { validateItemForm, isValid, type ItemFormData } from '../utils/validation';
import CategoryPicker from '../components/CategoryPicker';
import TagInput from '../components/TagInput';
import ImageUploader from '../components/ImageUploader';
import ImageGallery from '../components/ImageGallery';
import './ItemForm.css';

/** 物品状态选项 */
const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: 'IN_USE', label: '使用中' },
  { value: 'IDLE', label: '闲置' },
  { value: 'SOLD', label: '已出售' },
  { value: 'DISCARDED', label: '已丢弃' },
];

/** 表单初始值 */
function getInitialFormData(): ItemFormData {
  return {
    name: '',
    brand: '',
    model: '',
    purchaseDate: '',
    purchasePrice: '',
    purchaseChannel: '',
    resalePrice: '',
    status: 'IN_USE',
    warrantyDate: '',
    expiryDate: '',
    note: '',
  };
}

/**
 * 物品表单页面（新增 / 编辑）
 * - 新增模式：/items/new
 * - 编辑模式：/items/:id/edit
 */
export default function ItemForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<ItemFormData>(getInitialFormData);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  // 编辑模式：加载已有数据
  useEffect(() => {
    if (!id) return;

    async function loadItem() {
      try {
        const item = await db.items.get(id!);
        if (!item) {
          navigate('/items', { replace: true });
          return;
        }
        setFormData({
          name: item.name,
          brand: item.brand ?? '',
          model: item.model ?? '',
          purchaseDate: item.purchaseDate,
          purchasePrice: String(item.purchasePrice),
          purchaseChannel: item.purchaseChannel ?? '',
          resalePrice: item.resalePrice != null ? String(item.resalePrice) : '',
          status: item.status,
          warrantyDate: item.warrantyDate ?? '',
          expiryDate: item.expiryDate ?? '',
          note: item.note ?? '',
        });
        setCategoryId(item.categoryId);
        setTags(item.tags ?? []);
      } catch {
        navigate('/items', { replace: true });
      } finally {
        setLoading(false);
      }
    }

    loadItem();
  }, [id, navigate]);

  /** 更新表单字段 */
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // 清除该字段的错误提示
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  /** 提交表单 */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validateItemForm(formData);
    setErrors(validationErrors);
    if (!isValid(validationErrors)) return;

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const purchasePrice = Number(formData.purchasePrice);
      const resalePrice = formData.resalePrice !== '' ? Number(formData.resalePrice) : undefined;

      if (isEdit && id) {
        // 编辑模式：更新已有记录
        await db.items.update(id, {
          name: formData.name.trim(),
          brand: formData.brand.trim() || undefined,
          model: formData.model.trim() || undefined,
          purchaseDate: formData.purchaseDate,
          purchasePrice,
          purchaseChannel: formData.purchaseChannel.trim() || undefined,
          resalePrice,
          status: formData.status as ItemStatus,
          warrantyDate: formData.warrantyDate || undefined,
          expiryDate: formData.expiryDate || undefined,
          note: formData.note.trim() || undefined,
          categoryId,
          tags,
          updatedAt: now,
          syncStatus: 'pending',
        });
        navigate(`/items/${id}`, { replace: true });
      } else {
        // 新增模式：写入 IndexedDB
        const newId = crypto.randomUUID();
        await db.items.add({
          id: newId,
          name: formData.name.trim(),
          brand: formData.brand.trim() || undefined,
          model: formData.model.trim() || undefined,
          purchaseDate: formData.purchaseDate,
          purchasePrice,
          purchaseChannel: formData.purchaseChannel.trim() || undefined,
          resalePrice,
          status: formData.status as ItemStatus,
          warrantyDate: formData.warrantyDate || undefined,
          expiryDate: formData.expiryDate || undefined,
          note: formData.note.trim() || undefined,
          categoryId,
          tags,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending',
        });
        navigate('/items', { replace: true });
      }
    } catch {
      setErrors({ general: '保存失败，请重试' });
    } finally {
      setSubmitting(false);
    }
  }

  /** 取消操作 */
  function handleCancel() {
    if (isEdit && id) {
      navigate(`/items/${id}`);
    } else {
      navigate('/items');
    }
  }

  if (loading) {
    return (
      <div className="item-form-page">
        <p className="text-secondary">加载中...</p>
      </div>
    );
  }

  return (
    <div className="item-form-page">
      <div className="item-form-header">
        <h2>{isEdit ? '编辑物品' : '新增物品'}</h2>
      </div>

      <div className="item-form-card card">
        <form className="item-form" onSubmit={handleSubmit} noValidate>
          {errors.general && (
            <div className="auth-error-banner">{errors.general}</div>
          )}

          {/* 名称 */}
          <div className={`form-field ${errors.name ? 'has-error' : ''}`}>
            <label htmlFor="name">名称 <span className="required">*</span></label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="请输入物品名称"
              value={formData.name}
              onChange={handleChange}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          {/* 品牌 + 型号 */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="brand">品牌</label>
              <input
                id="brand"
                name="brand"
                type="text"
                placeholder="请输入品牌"
                value={formData.brand}
                onChange={handleChange}
              />
            </div>
            <div className="form-field">
              <label htmlFor="model">型号</label>
              <input
                id="model"
                name="model"
                type="text"
                placeholder="请输入型号"
                value={formData.model}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* 购买日期 + 购买价格 */}
          <div className="form-row">
            <div className={`form-field ${errors.purchaseDate ? 'has-error' : ''}`}>
              <label htmlFor="purchaseDate">购买日期 <span className="required">*</span></label>
              <input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                value={formData.purchaseDate}
                onChange={handleChange}
              />
              {errors.purchaseDate && <span className="field-error">{errors.purchaseDate}</span>}
            </div>
            <div className={`form-field ${errors.purchasePrice ? 'has-error' : ''}`}>
              <label htmlFor="purchasePrice">购买价格 <span className="required">*</span></label>
              <input
                id="purchasePrice"
                name="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="请输入购买价格"
                value={formData.purchasePrice}
                onChange={handleChange}
              />
              {errors.purchasePrice && <span className="field-error">{errors.purchasePrice}</span>}
            </div>
          </div>

          {/* 购买渠道 + 预估二手回收价格 */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="purchaseChannel">购买渠道</label>
              <input
                id="purchaseChannel"
                name="purchaseChannel"
                type="text"
                placeholder="如：京东、淘宝、线下"
                value={formData.purchaseChannel}
                onChange={handleChange}
              />
            </div>
            <div className={`form-field ${errors.resalePrice ? 'has-error' : ''}`}>
              <label htmlFor="resalePrice">预估二手回收价格</label>
              <input
                id="resalePrice"
                name="resalePrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="选填"
                value={formData.resalePrice}
                onChange={handleChange}
              />
              {errors.resalePrice && <span className="field-error">{errors.resalePrice}</span>}
            </div>
          </div>

          {/* 物品状态 */}
          <div className={`form-field ${errors.status ? 'has-error' : ''}`}>
            <label htmlFor="status">物品状态 <span className="required">*</span></label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.status && <span className="field-error">{errors.status}</span>}
          </div>

          {/* 分类 */}
          <div className="form-field">
            <label>分类</label>
            <CategoryPicker value={categoryId} onChange={setCategoryId} />
          </div>

          {/* 标签 */}
          <div className="form-field">
            <label>标签</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          {/* 保修到期日期 + 有效期到期日期 */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="warrantyDate">保修到期日期</label>
              <input
                id="warrantyDate"
                name="warrantyDate"
                type="date"
                value={formData.warrantyDate}
                onChange={handleChange}
              />
            </div>
            <div className="form-field">
              <label htmlFor="expiryDate">有效期到期日期</label>
              <input
                id="expiryDate"
                name="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* 备注 */}
          <div className="form-field">
            <label htmlFor="note">备注</label>
            <textarea
              id="note"
              name="note"
              placeholder="选填，记录物品相关备注"
              value={formData.note}
              onChange={handleChange}
            />
          </div>

          {/* 操作按钮 */}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              取消
            </button>
          </div>
        </form>

        {/* 编辑模式：图片上传与画廊 */}
        {isEdit && id && (
          <div className="item-form-images">
            <h3>物品图片</h3>
            <ImageUploader itemId={id} />
            <ImageGallery itemId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
