import type { TranslationKeys } from '../../i18n';

export type InvText = TranslationKeys['investments'];

export function statusLabel(t: InvText, status: string): string {
  return (t.statuses as Record<string, string>)[status] ?? (status || '—');
}

export function flowLabel(t: InvText, type: string): string {
  return (t.flowTypes as Record<string, string>)[type] ?? (type || '—');
}
