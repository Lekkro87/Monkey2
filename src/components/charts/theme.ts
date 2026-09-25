/**
 * Validierte kategoriale Palette (dunkler Modus, geprüft gegen die Panel-Fläche #111830).
 * Farben folgen der Entität – Slots werden in fester Reihenfolge vergeben, nie zyklisch.
 */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] as const;

/** Divergierendes Paar für Werte über/unter null (z. B. Gewinn/Verlust). */
export const DIVERGING = { positive: '#3987e5', negative: '#e66767', neutral: '#383835' } as const;

export const CHART = {
  grid: '#1f2744',
  axis: '#2c3558',
  tick: '#8b93b5',
  surface: '#111830',
  tooltipBg: '#0d1328',
  otherGray: '#5b6384',
} as const;

/** Feste Farbzuordnung für Marktteilnehmer (Farbe folgt der Entität). */
export const OWNER_COLORS: Record<string, string> = {
  player: SERIES[0],
  apex: SERIES[1],
  orion: SERIES[2],
  titan_systems: SERIES[3],
  vertex: SERIES[4],
  helios: SERIES[6],
  other: CHART.otherGray,
};
