// The Create QR code colours (the app's qrInks / qrBackgrounds in src/theme/tokens.ts): printed, so the same in both
// themes. English keys (shown through t()); `to` is the gradient's second colour.
export const QR_INKS = [
  { label: 'Black', value: '#111111', to: '#3F7D1C' },
  { label: 'Green', value: '#2E6B12', to: '#0F766E' },
  { label: 'Navy', value: '#1E3A8A', to: '#6D28D9' },
  { label: 'Maroon', value: '#7F1D1D', to: '#C2410C' },
  { label: 'Purple', value: '#5B21B6', to: '#BE185D' },
  { label: 'Teal', value: '#115E59', to: '#1D4ED8' },
] as const;

export const QR_BACKGROUNDS = [
  { label: 'White', value: '#FFFFFF' },
  { label: 'Cream', value: '#FFF8E7' },
  { label: 'Light lime', value: '#F1F8DC' },
  { label: 'Light blue', value: '#EAF3FF' },
] as const;
