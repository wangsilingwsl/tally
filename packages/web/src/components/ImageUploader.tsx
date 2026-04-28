import { useState, useRef, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { db } from '../db/index';
import './ImageUploader.css';

/** 支持的图片格式 */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** 最大文件大小：5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface ImageUploaderProps {
  /** 关联的物品 ID */
  itemId: string;
  /** 上传完成回调 */
  onUpload?: () => void;
}

/**
 * 图片上传组件
 * 支持拖拽上传、格式/大小校验、压缩原图和生成缩略图
 */
export default function ImageUploader({ itemId, onUpload }: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 校验文件格式和大小 */
  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return '不支持的图片格式，仅支持 JPEG、PNG、WebP';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `文件大小超过 5MB 限制（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）`;
    }
    return null;
  }

  /** 处理文件上传 */
  const processFile = useCallback(async (file: File) => {
    // 校验
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // 压缩原图（最大 1920px 宽）
      const compressedOriginal = await imageCompression(file, {
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: file.type as string,
      });

      // 生成 300px 缩略图
      const thumbnail = await imageCompression(file, {
        maxWidthOrHeight: 300,
        useWebWorker: true,
        fileType: file.type as string,
      });

      // 存入 IndexedDB
      const imageId = crypto.randomUUID();
      await db.images.add({
        id: imageId,
        itemId,
        originalBlob: compressedOriginal,
        thumbnailBlob: thumbnail,
        mimeType: file.type,
        size: compressedOriginal.size,
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
      });

      // 显示预览
      const previewUrl = URL.createObjectURL(thumbnail);
      setPreview(previewUrl);

      // 2 秒后清除预览
      setTimeout(() => {
        URL.revokeObjectURL(previewUrl);
        setPreview(null);
      }, 2000);

      onUpload?.();
    } catch {
      setError('图片处理失败，请重试');
    } finally {
      setUploading(false);
    }
  }, [itemId, onUpload]);

  /** 拖拽进入 */
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  /** 拖拽离开 */
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  /** 拖拽放下 */
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }

  /** 点击选择文件 */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // 重置 input，允许重复选择同一文件
    e.target.value = '';
  }

  /** 点击上传区域触发文件选择 */
  function handleClick() {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  }

  return (
    <div className="image-uploader">
      <div
        className={`image-uploader-dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="上传图片"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      >
        {uploading ? (
          <div className="image-uploader-status">
            <span className="image-uploader-spinner" />
            <span>正在处理图片...</span>
          </div>
        ) : preview ? (
          <div className="image-uploader-preview">
            <img src={preview} alt="上传预览" />
            <span className="image-uploader-success">✓ 上传成功</span>
          </div>
        ) : (
          <div className="image-uploader-placeholder">
            <span className="image-uploader-icon">📷</span>
            <span className="image-uploader-text">拖拽图片到此处，或点击选择</span>
            <span className="image-uploader-hint">支持 JPEG、PNG、WebP，最大 5MB</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="image-uploader-input"
        aria-hidden="true"
        tabIndex={-1}
      />

      {error && (
        <div className="image-uploader-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
