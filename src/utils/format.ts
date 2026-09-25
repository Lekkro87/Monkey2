const integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimalFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '–';
  if (digits === 0) return integerFormat.format(Math.round(value));
  if (digits === 1) return decimalFormat.format(value);
  if (digits === 2) return twoDecimalFormat.format(value);
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Vollständiger Eurobetrag, z. B. „1.250.000 €“. */
export function formatMoney(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '–';
  return `${formatNumber(value, digits)} €`;
}

/** Kompakte Darstellung, z. B. „1,2 Mio. €“ oder „3,4 Mrd. €“. */
export function formatMoneyCompact(value: number): string {
  if (!Number.isFinite(value)) return '–';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${formatNumber(abs / 1e12, 2)} Bio. €`;
  if (abs >= 1e9) return `${sign}${formatNumber(abs / 1e9, abs >= 1e11 ? 0 : 1)} Mrd. €`;
  if (abs >= 1e6) return `${sign}${formatNumber(abs / 1e6, abs >= 1e8 ? 0 : 1)} Mio. €`;
  if (abs >= 1e4) return `${sign}${formatNumber(abs / 1e3, 0)} Tsd. €`;
  return `${sign}${formatNumber(abs)} €`;
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '–';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${formatNumber(abs / 1e9, 1)} Mrd.`;
  if (abs >= 1e6) return `${sign}${formatNumber(abs / 1e6, 1)} Mio.`;
  if (abs >= 1e4) return `${sign}${formatNumber(abs / 1e3, 0)} Tsd.`;
  return `${sign}${formatNumber(abs)}`;
}

/** Anteil (0–1) als Prozent, z. B. 0.084 → „8,4 %“. */
export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '–';
  if (ratio > 0 && ratio < 0.001 && digits <= 1) return '< 0,1 %';
  return `${formatNumber(ratio * 100, digits)} %`;
}

export function formatSignedPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '–';
  const sign = ratio > 0 ? '+' : ratio < 0 ? '−' : '±';
  return `${sign}${formatNumber(Math.abs(ratio) * 100, digits)} %`;
}

export function formatSignedMoney(value: number): string {
  if (!Number.isFinite(value)) return '–';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${formatMoneyCompact(Math.abs(value))}`;
}

export function formatScore(value: number): string {
  return formatNumber(value, 0);
}

export function formatRating(value: number): string {
  return `${formatNumber(value, 1)} / 10`;
}
