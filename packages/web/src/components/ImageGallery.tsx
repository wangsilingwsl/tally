import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index';
import ConfirmDialog from './ConfirmDialog';
import './ImageGallery.css';

interface ImageGalleryProps {
  /** 关联的物品 ID */
  itemId: string;
}

/**
 * 图片画廊组件
 * 缩略图网格展示 + 点击放大查看原图 + 删除功能
 */
export default function ImageGallery({ itemId }: ImageGalleryProps) {
  const images = useLiveQuery(
    () => db.images.where('itemId').equals(itemId).toArray(),
    [itemId],
  );

  // 当前查看原图的图片 ID
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  // 原图 Blob URL
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // 缩略图 URL 缓存
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  // 删除确认
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /** 生成缩略图 URL */
  useEffect(() => {
    if (!images) return;

    const newUrls: Record<string, string> = {};
    const toRevoke: string[] = [];

    images.forEach((img) => {
      if (thumbUrls[img.id]) {
        newUrls[img.id] = thumbUrls[img.id]!;
      } else {
        newUrls[img.id] = URL.createObjectURL(img.thumbnailBlob);
      }
    });

    // 回收已删除图片的 URL
    Object.keys(thumbUrls).forEach((id) => {
      if (!newUrls[id]) {
        toRevoke.push(thumbUrls[id]!);
      }
    });
    toRevoke.forEach(URL.revokeObjectURL);

    setThumbUrls(newUrls);

    // 组件卸载时回收所有 URL
    return () => {
      Object.values(newUrls).forEach(URL.revokeObjectURL);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  /** 打开原图灯箱 */
  const openLightbox = useCallback(async (imageId: string) => {
    const image = await db.images.get(imageId);
    if (!image) return;
    const url = URL.createObjectURL(image.originalBlob);
    setLightboxId(imageId);
    setLightboxUrl(url);
  }, []);

  /** 关闭灯箱 */
  const closeLightbox = useCallback(() => {
    if (lightboxUrl) {
      URL.revokeObjectURL(lightboxUrl);
    }
    setLightboxId(null);
    setLightboxUrl(null);
  }, [lightboxUrl]);

  /** 删除图片 */
  async function handleDelete() {
    if (!deleteId) return;
    await db.images.delete(deleteId);
    setDeleteId(null);
    // 如果正在查看被删除的图片，关闭灯箱
    if (lightboxId === deleteId) {
      closeLightbox();
    }
  }

  // 加载中
  if (!images) {
    return null;
  }

  // 无图片
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="image-gallery">
      <h4 className="image-gallery-title">物品图片</h4>

      {/* 缩略图网格 */}
      <div className="image-gallery-grid">
        {images.map((img) => (
          <div key={img.id} className="image-gallery-item">
            <img
              src={thumbUrls[img.id]}
              alt="物品图片"
              className="image-gallery-thumb"
              onClick={() => openLightbox(img.id)}
            />
            <button
              className="image-gallery-delete"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteId(img.id);
              }}
              aria-label="删除图片"
              title="删除图片"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 原图灯箱 */}
      {lightboxUrl && (
        <div
          className="image-lightbox-overlay"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="查看原图"
        >
          <button
            className="image-lightbox-close"
            onClick={closeLightbox}
            aria-label="关闭"
          >
            ×
          </button>
          <img
            src={lightboxUrl}
            alt="原图"
            className="image-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteId !== null}
        title="确认删除"
        message="确定要删除这张图片吗？此操作不可撤销。"
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
