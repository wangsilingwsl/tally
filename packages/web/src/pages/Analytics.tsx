/**
 * 消费统计与分析页面
 * 包含趋势折线图、分类占比饼图、折旧分析列表、总资产估值
 */

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { db } from '../db';
import { calculateAssetStatistics } from '../utils/statistics';
import {
  calculateTrend,
  calculateCategoryRatio,
  calculateDepreciation,
  type PeriodType,
} from '../utils/analytics';
import './Analytics.css';

/** 时间维度选项 */
const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季' },
  { value: 'year', label: '年' },
];

/** 饼图暖色调色板 */
const PIE_COLORS = [
  '#c96442', '#d4845f', '#c49a3c', '#5a8a5e',
  '#6b8fa3', '#9a7b5e', '#b8704a', '#8b6e4e',
  '#a3856b', '#7d9e7f',
];

/** 格式化金额 */
function formatCurrency(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 自定义 Tooltip 内容 */
function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip-label">{label}</p>
      <p className="analytics-tooltip-value">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

/** 饼图自定义 Tooltip */
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip-label">{data.name}</p>
      <p className="analytics-tooltip-value">
        {formatCurrency(data.value)}（{data.payload.ratio}%）
      </p>
    </div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState<PeriodType>('month');

  const items = useLiveQuery(() => db.items.filter((item) => !item.isDeleted).toArray());
  const categories = useLiveQuery(() => db.categories.filter((cat) => !cat.isDeleted).toArray());

  /** 趋势数据 */
  const trendData = useMemo(() => {
    if (!items) return [];
    return calculateTrend(items, period);
  }, [items, period]);

  /** 分类占比数据 */
  const categoryData = useMemo(() => {
    if (!items || !categories) return [];
    return calculateCategoryRatio(items, categories);
  }, [items, categories]);

  /** 折旧分析数据 */
  const depreciationData = useMemo(() => {
    if (!items) return [];
    return calculateDepreciation(items);
  }, [items]);

  /** 资产统计 */
  const statistics = useMemo(() => {
    if (!items) return null;
    return calculateAssetStatistics(items);
  }, [items]);

  if (!items || !categories) {
    return <div className="analytics-loading">加载中...</div>;
  }

  return (
    <div className="analytics-page">
      <h2>消费统计</h2>

      {/* 总资产估值摘要 */}
      {statistics && (
        <div className="analytics-summary">
          <div className="analytics-summary-card">
            <span className="analytics-summary-label">总资产金额</span>
            <span className="analytics-summary-value">{formatCurrency(statistics.totalAssets)}</span>
          </div>
          <div className="analytics-summary-card">
            <span className="analytics-summary-label">总资产估值</span>
            <span className="analytics-summary-value">{formatCurrency(statistics.totalResaleValue)}</span>
          </div>
        </div>
      )}

      {/* 消费趋势折线图 */}
      <div className="analytics-section">
        <div className="analytics-section-header">
          <h3>消费趋势</h3>
          <div className="analytics-period-toggle">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`analytics-period-btn ${period === opt.value ? 'active' : ''}`}
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="analytics-chart-card">
          {trendData.length === 0 ? (
            <div className="analytics-empty">暂无消费数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                  tickFormatter={(v) => `¥${v}`}
                />
                <Tooltip content={<TrendTooltip />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#c96442"
                  strokeWidth={2}
                  dot={{ fill: '#c96442', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 分类消费占比饼图 */}
      <div className="analytics-section">
        <h3>分类消费占比</h3>
        <div className="analytics-chart-card">
          {categoryData.length === 0 ? (
            <div className="analytics-empty">暂无分类数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="amount"
                  nameKey="categoryName"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={({ categoryName, ratio }) => `${categoryName} ${ratio}%`}
                >
                  {categoryData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 折旧分析列表 */}
      <div className="analytics-section">
        <h3>折旧分析</h3>
        {depreciationData.length === 0 ? (
          <div className="analytics-empty">暂无物品数据</div>
        ) : (
          <div className="analytics-depreciation-table">
            <div className="depreciation-header">
              <span className="dep-col-name">物品名称</span>
              <span className="dep-col-num">购入价</span>
              <span className="dep-col-num">当前估值</span>
              <span className="dep-col-num">贬值率</span>
            </div>
            {depreciationData.map((item) => (
              <div key={item.id} className="depreciation-row">
                <span className="dep-col-name">{item.name}</span>
                <span className="dep-col-num">{formatCurrency(item.purchasePrice)}</span>
                <span className="dep-col-num">
                  {item.resalePrice !== null ? formatCurrency(item.resalePrice) : (
                    <span className="dep-pending">估值待填写</span>
                  )}
                </span>
                <span className="dep-col-num">
                  {item.depreciationRate !== null ? `${item.depreciationRate}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
