/**
 * Charis Microfinance Bank — single source of truth for brand tokens.
 * Colours are sampled from the official logo (purple #40239A, green #38EF92).
 * The same values are mirrored as CSS custom properties in app/globals.css.
 */
export const brand = {
  name: 'Charis Microfinance Bank',
  product: 'Campaign Centre',
  tagline: 'Customer communications, done with care.',
  logo: '/charis-logo.png',
  icon: '/charis-icon.svg',
  colors: {
    primary: '#40239A',
    primaryDark: '#2A1670',
    primaryDeep: '#140A38',
    primarySoft: '#EDE9FB',
    accent: '#38EF92',
    accentDark: '#0F9F58',
    accentSoft: '#E6FCF1',
    ink: '#14102B',
    muted: '#5E5A78',
    border: '#E4E1F0',
    canvas: '#F7F6FC',
    success: '#0F7B4A',
    warning: '#9A5B00',
    danger: '#B42318'
  }
} as const;

/** Convert a stored status such as `pending_approval` to readable text. */
export const humanize = (value: string | null | undefined) =>
  (value || '').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';
/** Map workflow statuses to a consistent visual tone. */
export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'approved': case 'sent': case 'completed': case 'delivered': case 'granted': case 'active': case 'verified': return 'success';
    case 'pending_approval': case 'queued': case 'scheduled': case 'processing': case 'pending': return 'warning';
    case 'rejected': case 'failed': case 'denied': case 'cancelled': case 'suspended': return 'danger';
    case 'draft': case 'unknown': case 'archived': return 'neutral';
    default: return 'info';
  }
}
