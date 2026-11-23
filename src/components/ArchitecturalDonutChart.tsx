import React, { useState } from 'react';
import { formatCurrency } from '../utils/calculations';

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  percent: number;
  color: string;
  sublabel?: string;
}

interface ArchitecturalDonutChartProps {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  centerSublabel?: string;
  emptyText?: string;
  size?: number;
}

export const ArchitecturalDonutChart: React.FC<ArchitecturalDonutChartProps> = ({
  slices,
  centerLabel,
  centerValue,
  centerSublabel,
  emptyText = 'Нет данных для отображения',
  size = 204,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const validSlices = slices.filter((s) => s.value > 0);
  const total = validSlices.reduce((acc, s) => acc + s.value, 0);

  if (validSlices.length === 0 || total <= 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="h-36 w-36 rounded-full border-2 border-dashed border-[#C5E6EC] bg-[#F2FAFC]" />
        <p className="mt-4 text-xs text-[#4C6D7C]">{emptyText}</p>
      </div>
    );
  }

  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gapPx = validSlices.length > 1 ? 3 : 0;

  let cumulativeOffset = 0;
  const segments = validSlices.map((slice) => {
    const ratio = slice.value / total;
    const rawLen = ratio * circumference;
    const dashLen = Math.max(1, rawLen - gapPx);
    const offset = -cumulativeOffset;
    cumulativeOffset += rawLen;
    return {
      ...slice,
      dashLen,
      offset,
    };
  });

  const activeSlice = hoveredId
    ? validSlices.find((s) => s.id === hoveredId) || null
    : null;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      {/* SVG Ring */}
      <div
        className="relative mx-auto shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 drop-shadow-[0_4px_12px_rgba(14,74,92,0.08)]"
          role="img"
          aria-label={centerLabel}
        >
          {/* Base Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E6F4F7"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg) => {
            const isActive = hoveredId === seg.id;
            const isDimmed = hoveredId !== null && !isActive;
            return (
              <circle
                key={seg.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${seg.dashLen} ${circumference}`}
                strokeDashoffset={seg.offset}
                className="cursor-pointer transition-all duration-150"
                style={{ opacity: isDimmed ? 0.35 : 1 }}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
            );
          })}
        </svg>

        {/* Centered Metric Readout */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div className="max-w-full truncate text-[10px] font-medium text-[#547585]">
            {activeSlice ? activeSlice.label : centerLabel}
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#0F2936]">
            {activeSlice ? formatCurrency(activeSlice.value) : centerValue}
          </div>
          <div className="mt-0.5 font-mono text-[11px] font-medium tabular-nums text-[#547585]">
            {activeSlice ? `${activeSlice.percent.toFixed(1)}%` : centerSublabel || ''}
          </div>
        </div>
      </div>

      {/* Frosted Glass Breakdown List */}
      <div className="min-w-0 flex-1 divide-y divide-[#0EA5E9]/10 rounded-2xl border border-[#0EA5E9]/14 bg-white/70 px-3 backdrop-blur-xs">
        {validSlices.map((slice) => {
          const isActive = hoveredId === slice.id;
          return (
            <div
              key={slice.id}
              onMouseEnter={() => setHoveredId(slice.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`flex cursor-default items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 text-xs transition-colors ${
                isActive ? 'bg-[#EFF9FC]' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-xs"
                  style={{ backgroundColor: slice.color }}
                />
                <div className="min-w-0">
                  <div className="truncate font-medium text-[#0F2936]">{slice.label}</div>
                  {slice.sublabel && (
                    <div className="truncate text-[11px] text-[#547585]">{slice.sublabel}</div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-baseline gap-3 font-mono tabular-nums">
                <span className="font-semibold text-[#0F2936]">
                  {formatCurrency(slice.value)}
                </span>
                <span className="w-11 text-right text-[11px] font-medium text-[#547585]">
                  {slice.percent.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
