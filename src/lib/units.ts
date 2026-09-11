// ─────────────────────────────────────────────────────────────────────────────
//  Appending a unit to a value someone typed.
//
//  Every one of these fields is free text, so the value may or may not already
//  carry its unit: a founder asked for "MoM growth (%)" types "10" or "10%"
//  with equal confidence, and someone asked for team size types "20" or
//  "20 people". Appending unconditionally is what produced "10%%%" and
//  "20 people people" on the company page.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a % unless the value already ends in one (or several — a value that has
 * already been through the old unconditional append is normalised here too).
 * Returns '' for an empty value, so callers can keep using falsiness to decide
 * whether to render the row at all.
 */
export function percent(value: string | number | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return `${raw.replace(/\s*%+\s*$/, '')}%`;
}

/**
 * Adds a unit word unless the value already ends with it, case-insensitively:
 * withUnit('20', 'people') and withUnit('20 people', 'people') both give
 * "20 people", and "20 People" is left as the person wrote it.
 */
export function withUnit(
  value: string | number | null | undefined,
  unit: string,
): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  // The value is nothing but the unit — leave it alone rather than making
  // "people people" out of it.
  if (raw.toLowerCase() === unit.toLowerCase()) return raw;

  const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Strips one or more trailing repetitions, so an already-doubled stored value
  // comes back single rather than growing again. Whitespace before the unit is
  // required, so a unit of "mo" does not eat the tail of "demo".
  const stripped = raw.replace(new RegExp(`(?:\\s+${escaped})+$`, 'i'), '').trim();
  return stripped ? `${stripped} ${unit}` : raw;
}

/**
 * Adds a currency-ish prefix unless the value already starts with a symbol or
 * a currency code. Free-text money fields arrive as "500000", "$500k" and
 * "₹5,00,000" alike, and only the first wants a prefix.
 */
export function withCurrencyPrefix(
  value: string | number | null | undefined,
  prefix = '$',
): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^[^\d\s]/.test(raw)) return raw;      // already starts with a symbol/code
  return `${prefix}${raw}`;
}
