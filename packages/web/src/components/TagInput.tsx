import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index';
import './TagInput.css';

interface TagInputProps {
  /** 当前标签列表 */
  tags: string[];
  /** 标签变更回调 */
  onChange: (tags: string[]) => void;
}

/**
 * 标签输入组件
 * 支持输入标签、自动补全、去重、删除
 */
export default function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 从 IndexedDB 中查询所有物品的标签，提取唯一值作为补全来源
  const allTags = useLiveQuery(async () => {
    const items = await db.items.filter((item) => !item.isDeleted).toArray();
    const tagSet = new Set<string>();
    for (const item of items) {
      for (const tag of item.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, []);

  // 根据输入过滤建议（排除已选标签）
  const suggestions = (allTags ?? []).filter(
    (tag) =>
      !tags.includes(tag) &&
      tag.toLowerCase().includes(input.trim().toLowerCase()) &&
      input.trim().length > 0,
  );

  // 点击外部关闭建议列表
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** 添加标签（去重、去空） */
  function addTag(tagName: string) {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput('');
    setShowSuggestions(false);
  }

  /** 移除标签 */
  function removeTag(tagName: string) {
    onChange(tags.filter((t) => t !== tagName));
  }

  /** 输入框按键处理 */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      // 输入为空时按退格删除最后一个标签
      const lastTag = tags[tags.length - 1];
      if (lastTag) removeTag(lastTag);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  /** 输入变更 */
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    // 逗号触发添加
    if (val.includes(',')) {
      const parts = val.split(',');
      for (const part of parts) {
        addTag(part);
      }
      return;
    }
    setInput(val);
    setShowSuggestions(val.trim().length > 0);
  }

  return (
    <div className="tag-input" ref={containerRef}>
      {/* 已选标签 */}
      {tags.length > 0 && (
        <div className="tag-input-tags">
          {tags.map((tag) => (
            <span key={tag} className="tag-input-chip">
              {tag}
              <button
                type="button"
                className="tag-input-chip-remove"
                onClick={() => removeTag(tag)}
                aria-label={`移除标签 ${tag}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 输入框 + 自动补全 */}
      <div className="tag-input-field">
        <input
          type="text"
          placeholder="输入标签，按回车或逗号添加"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (input.trim().length > 0) setShowSuggestions(true);
          }}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="tag-input-suggestions">
            {suggestions.map((tag) => (
              <div
                key={tag}
                className="tag-input-suggestion"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(tag);
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
