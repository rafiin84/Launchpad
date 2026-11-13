import { useId } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AXIS, GRID, STROKES, FILLS } from '../reports/reportTheme';

export interface SeriesDef { key: string; name: string }
export type SeriesRow = { label: string } & Record<string, number | string | null>;

function Tip({ active, payload, label, format }: {
  active?: boolean; label?: string; format: (n: number) => string;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs space-y-0.5">
      <p className="font-medium text-gray-800">{label}</p>
      {payload.map(p => p.value === undefined || p.value === null ? null : (
        <p key={p.name} className="text-gray-500 tabular-nums flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />{p.name}: {format(p.value)}
        </p>
      ))}
    </div>
  );
}

const compact = (format: (n: number) => string) => (v: unknown) => format(Number(v));

/** Light grouped columns, one pastel colour per series. */
export function GroupedBars({ data, series, format, height = 220 }: { data: SeriesRow[]; series: SeriesDef[]; format: (n: number) => string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={series.map(s => s.name).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fontSize: 11, fill: AXIS }} />
          <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: AXIS }} tickFormatter={compact(format)} />
          <Tooltip cursor={{ fill: '#f8fafc' }} content={<Tip format={format} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
          {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={FILLS[i % FILLS.length]} radius={[8, 8, 3, 3]} maxBarSize={28} animationDuration={500} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Soft gradient area lines (cash, profit). Handles negative values. */
export function AreaLines({ data, series, format, height = 220 }: { data: SeriesRow[]; series: SeriesDef[]; format: (n: number) => string; height?: number }) {
  const gid = useId().replace(/:/g, '');
  return (
    <div style={{ height }} role="img" aria-label={series.map(s => s.name).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${gid}${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STROKES[i % STROKES.length]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={STROKES[i % STROKES.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fontSize: 11, fill: AXIS }} />
          <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: AXIS }} tickFormatter={compact(format)} />
          <Tooltip content={<Tip format={format} />} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />}
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={STROKES[i % STROKES.length]} strokeWidth={2.5}
              fill={`url(#${gid}${i})`} connectNulls dot={{ r: 3, fill: STROKES[i % STROKES.length], stroke: '#fff', strokeWidth: 1.5 }} animationDuration={500} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Plain pastel lines for counts (customers, team). */
export function CountLines({ data, series, format, height = 220 }: { data: SeriesRow[]; series: SeriesDef[]; format: (n: number) => string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={series.map(s => s.name).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fontSize: 11, fill: AXIS }} />
          <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: AXIS }} tickFormatter={compact(format)} />
          <Tooltip content={<Tip format={format} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={STROKES[(i + 2) % STROKES.length]} strokeWidth={2.5}
              connectNulls dot={{ r: 3, fill: STROKES[(i + 2) % STROKES.length], stroke: '#fff', strokeWidth: 1.5 }} animationDuration={500} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
