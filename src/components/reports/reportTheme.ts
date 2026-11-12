/** Soft pastel palette for the report charts — light fills, with slightly deeper strokes for lines. */
export const FILLS = ['#c7d2fe', '#a5f3fc', '#a7f3d0', '#fde68a', '#ddd6fe', '#fecdd3', '#fbcfe8', '#d9f99d'];
export const STROKES = ['#a5b4fc', '#67e8f9', '#6ee7b7', '#fcd34d', '#c4b5fd', '#fda4af', '#f9a8d4', '#bef264'];
export const GRID = '#f1f5f9';
export const AXIS = '#94a3b8';

export type Tone = 'indigo' | 'sky' | 'emerald' | 'amber' | 'violet' | 'rose';
export const TONES: Record<Tone, string> = {
  indigo: 'bg-indigo-50 text-indigo-400',
  sky: 'bg-sky-50 text-sky-400',
  emerald: 'bg-emerald-50 text-emerald-400',
  amber: 'bg-amber-50 text-amber-400',
  violet: 'bg-violet-50 text-violet-400',
  rose: 'bg-rose-50 text-rose-400',
};
