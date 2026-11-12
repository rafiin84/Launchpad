import { useId } from 'react';
import {
  Area, AreaChart, Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AXIS, FILLS, GRID, STROKES } from './reportTheme';

export interface ChartDatum { label: string; value: number; count?: number }

interface TipProps {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: ChartDatum }>;
  format: (n: number) => string;
  countLabel?: (n: number) => string;
}

function ChartTooltip({ active, payload, format, countLabel }: TipProps) {
  const p = payload?.[0];
  if (!active || !p || p.value === undefined) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-800">{p.payload?.label}</p>
      <p className="text-gray-500 tabular-nums">{format(p.value)}</p>
      {p.payload?.count !== undefined && countLabel && <p className="text-gray-400">{countLabel(p.payload.count)}</p>}
    </div>
  );
}

/** Soft donut with the total in the middle and a legend beside it. */
export function DonutChart({
  data, format, centerLabel, centerValue, countLabel,
}: {
  data: ChartDatum[]; format: (n: number) => string; centerLabel: string; centerValue: string; countLabel?: (n: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const slices = total > 0 ? data.filter(d => d.value > 0) : data.map(d => ({ ...d, value: 1 }));
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-44 h-44 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="96%" paddingAngle={slices.length > 1 ? 3 : 0}
              cornerRadius={8} stroke="none" startAngle={90} endAngle={-270} animationDuration={500}>
              {slices.map((d, i) => <Cell key={d.label} fill={FILLS[i % FILLS.length]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip format={format} countLabel={countLabel} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] text-gray-400">{centerLabel}</span>
          <span className="text-base font-bold text-gray-900 tabular-nums">{centerValue}</span>
        </div>
      </div>
      <ul className="flex-1 min-w-0 w-full space-y-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: FILLS[i % FILLS.length] }} />
            <span className="text-gray-700 truncate flex-1">{d.label}</span>
            <span className="text-gray-400 tabular-nums">{format(d.value)}</span>
            <span className="text-gray-900 font-medium tabular-nums w-10 text-right">{total > 0 ? `${Math.round((d.value / total) * 100)}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rounded pastel columns with the value above each. */
export function ColumnChart({
  data, format, countLabel, height = 220,
}: { data: ChartDatum[]; format: (n: number) => string; countLabel?: (n: number) => string; height?: number }) {
  const gid = useId().replace(/:/g, '');
  return (
    <div style={{ height }} role="img" aria-label={data.map(d => `${d.label} ${format(d.value)}`).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c7d2fe" />
              <stop offset="100%" stopColor="#e0e7ff" />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fontSize: 11, fill: AXIS }} />
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip cursor={{ fill: '#f8fafc' }} content={<ChartTooltip format={format} countLabel={countLabel} />} />
          <Bar dataKey="value" fill={`url(#${gid})`} radius={[12, 12, 4, 4]} maxBarSize={44} animationDuration={500}>
            <LabelList dataKey="value" position="top" formatter={(v: unknown) => format(Number(v))} style={{ fontSize: 11, fill: '#64748b' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal pastel bars, one colour per row, with the value at the end. */
export function HBarChart({
  data, format, countLabel,
}: { data: ChartDatum[]; format: (n: number) => string; countLabel?: (n: number) => string }) {
  const height = Math.max(110, data.length * 38 + 10);
  return (
    <div style={{ height }} role="img" aria-label={data.map(d => `${d.label} ${format(d.value)}`).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip cursor={{ fill: '#f8fafc' }} content={<ChartTooltip format={format} countLabel={countLabel} />} />
          <Bar dataKey="value" radius={[4, 12, 12, 4]} barSize={16} animationDuration={500} background={{ fill: '#f8fafc', radius: 12 }}>
            {data.map((d, i) => <Cell key={d.label} fill={FILLS[i % FILLS.length]} />)}
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => format(Number(v))} style={{ fontSize: 11, fill: '#64748b' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A small soft area line — one valuation history. */
export function AreaSpark({ points, color = 0, label }: { points: Array<{ label: string; value: number }>; color?: number; label: string }) {
  const gid = useId().replace(/:/g, '');
  const stroke = STROKES[color % STROKES.length];
  return (
    <div className="h-16" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={2.5} fill={`url(#${gid})`}
            dot={points.length === 1 ? { r: 4, fill: stroke, stroke: '#fff', strokeWidth: 2 } : false} activeDot={{ r: 4 }} animationDuration={500} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
