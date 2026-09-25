import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, DIVERGING, SERIES } from './theme';

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
}

type Row = Record<string, string | number | null>;

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Row;
}

function ChartTooltip({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number; format: (v: number) => string; labelFormat?: (v: string | number) => string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-line px-3 py-2 text-xs shadow-xl" style={{ background: CHART.tooltipBg }}>
      <div className="mb-1 font-medium text-muted">{labelFormat && label !== undefined ? labelFormat(label) : label}</div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted">{entry.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular text-ink">{typeof entry.value === 'number' ? format(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color ?? SERIES[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

interface TimeSeriesProps {
  data: Row[];
  xKey: string;
  series: SeriesDef[];
  kind?: 'line' | 'area';
  height?: number;
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  labelFormat?: (value: string | number) => string;
}

/** Zeitverlauf mit einer gemeinsamen Achse, Fadenkreuz und Tooltip. */
export function TimeSeriesChart({ data, xKey, series, kind = 'line', height = 220, format, axisFormat, labelFormat }: TimeSeriesProps) {
  const ChartComponent = kind === 'area' ? AreaChart : LineChart;
  return (
    <div>
      <Legend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey={xKey} stroke={CHART.axis} tick={{ fill: CHART.tick, fontSize: 11 }} tickLine={false} minTickGap={24} />
            <YAxis stroke={CHART.axis} tick={{ fill: CHART.tick, fontSize: 11 }} tickLine={false} axisLine={false} width={84} tickFormatter={axisFormat ?? format} />
            <Tooltip content={<ChartTooltip format={format} labelFormat={labelFormat} />} cursor={{ stroke: CHART.tick, strokeWidth: 1 }} />
            {series.map((s, i) =>
              kind === 'area' ? (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color ?? SERIES[i]}
                  fill={s.color ?? SERIES[i]}
                  fillOpacity={0.14}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color ?? SERIES[i]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
                  connectNulls
                />
              ),
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Balken mit Vorzeichen (divergierend: blau = positiv, rot = negativ). */
export function SignedBarChart({ data, xKey, valueKey, label, height = 200, format, axisFormat, labelFormat }: { data: Row[]; xKey: string; valueKey: string; label: string; height?: number; format: (v: number) => string; axisFormat?: (v: number) => string; labelFormat?: (v: string | number) => string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey={xKey} stroke={CHART.axis} tick={{ fill: CHART.tick, fontSize: 11 }} tickLine={false} minTickGap={24} />
          <YAxis stroke={CHART.axis} tick={{ fill: CHART.tick, fontSize: 11 }} tickLine={false} axisLine={false} width={84} tickFormatter={axisFormat ?? format} />
          <ReferenceLine y={0} stroke={CHART.axis} />
          <Tooltip content={<ChartTooltip format={format} labelFormat={labelFormat} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey={valueKey} name={label} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((row, index) => (
              <Cell key={index} fill={Number(row[valueKey] ?? 0) >= 0 ? DIVERGING.positive : DIVERGING.negative} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontale Balken für eine Serie (z. B. eigener Marktanteil je Kategorie). */
export function HorizontalBars({ items, format, color = SERIES[0], max }: { items: { label: string; value: number; hint?: string }[]; format: (v: number) => string; color?: string; max?: number }) {
  const top = max ?? Math.max(1e-9, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} title={item.hint} className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-xs">
          <span className="truncate text-muted">{item.label}</span>
          <div className="h-2.5 rounded-full bg-white/5">
            <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (item.value / top) * 100)}%`, background: color }} />
          </div>
          <span className="text-right font-semibold tabular">{format(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export interface ShareSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** 100-%-Stapelbalken (Anteile) mit 2px-Lücken, Tooltip pro Segment. */
export function StackedShareBar({ segments, height = 14 }: { segments: ShareSegment[]; height?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return <div className="rounded-full bg-white/5" style={{ height }} />;
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-md" style={{ height }}>
      {segments
        .filter((s) => s.value > 0)
        .map((segment) => (
          <div
            key={segment.key}
            title={`${segment.label}: ${((segment.value / total) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`}
            className="h-full first:rounded-l-md last:rounded-r-md"
            style={{ width: `${(segment.value / total) * 100}%`, background: segment.color, minWidth: 2 }}
          />
        ))}
    </div>
  );
}

export function Sparkline({ values, width = 80, height = 24, color = SERIES[0] }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * (width - 2) + 1},${height - 2 - ((v - min) / range) * (height - 4)}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Karte mit Umschalter Diagramm ↔ Tabelle (barrierearme Tabellenansicht). */
export function ChartPanel({ chart, table, tableTitle = 'Tabelle' }: { chart: ReactNode; table: { columns: string[]; rows: (string | number)[][] }; tableTitle?: string }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div>
      <div className="mb-1 flex justify-end">
        <button type="button" onClick={() => setShowTable((v) => !v)} className="text-[11px] text-muted hover:text-ink">
          {showTable ? 'Diagramm' : tableTitle}
        </button>
      </div>
      {showTable ? (
        <div className="max-h-64 overflow-auto rounded-lg border border-line/60">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel-2 text-muted">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-left font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i} className={clsx('border-t border-line/40')}>
                  {row.map((cell, j) => (
                    <td key={j} className={clsx('px-2 py-1 tabular', j > 0 && 'text-right')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        chart
      )}
    </div>
  );
}
