---
name: Sahara
colors:
  surface: '#fff8f6'
  surface-dim: '#ead6cd'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1eb'
  surface-container: '#ffeae1'
  surface-container-high: '#f9e4db'
  surface-container-highest: '#f3ded6'
  on-surface: '#241914'
  on-surface-variant: '#574239'
  inverse-surface: '#3a2e28'
  inverse-on-surface: '#ffede6'
  outline: '#8a7267'
  outline-variant: '#dec1b4'
  surface-tint: '#9e4200'
  primary: '#9e4200'
  on-primary: '#ffffff'
  primary-container: '#c15814'
  on-primary-container: '#0e0200'
  inverse-primary: '#ffb691'
  secondary: '#865135'
  on-secondary: '#ffffff'
  secondary-container: '#fdb794'
  on-secondary-container: '#78462a'
  tertiary: '#006195'
  on-tertiary: '#ffffff'
  tertiary-container: '#007abc'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcb'
  primary-fixed-dim: '#ffb691'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#793100'
  secondary-fixed: '#ffdbcb'
  secondary-fixed-dim: '#fdb794'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#6a3a20'
  tertiary-fixed: '#cde5ff'
  tertiary-fixed-dim: '#95ccff'
  on-tertiary-fixed: '#001d32'
  on-tertiary-fixed-variant: '#004a75'
  background: '#fff8f6'
  on-background: '#241914'
  surface-variant: '#f3ded6'
typography:
  headline-lg:
    fontFamily: Eb Garamond
    fontSize: 48px
    fontWeight: '500'
    lineHeight: '1.1'
  headline-md:
    fontFamily: Eb Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
---

# Sahara — Warm Minimalism

## North Star: "Sun-Baked Simplicity"
Luxurious warmth meets disciplined minimalism. Golden tones, editorial serif headings, and abundant whitespace.

## Colors
- **Primary (`#c15814`):** Burnt sienna — rich, earthy CTAs and focus states.
- **Secondary (`#a3694b`):** Terracotta — warm, mid-tone support for secondary actions and iconography.
- **Background (`#faf5ee`):** Warm linen — never cold white.
- **Tertiary (`#0082c7`):** Oasis blue — a sharp, cool azure accent used sparingly for emphasis or specialized status indicators.
- Entire palette is warm-shifted, with the exception of the tertiary blue which provides a deliberate, refreshing contrast.

## Typography
- **Headlines:** EB Garamond — elegant, editorial serif. Large sizes with tight leading.
- **Body/Labels:** Manrope — geometric sans-serif, clean and modern contrast to the serif.
- The serif/sans pairing creates a luxury editorial feel.

## Elevation
- Ultra-soft shadows: `0 2px 16px rgba(132, 116, 109, 0.06)`. Barely visible, tinted with warm taupe.
- Prefer warm background tinting for hierarchy.
- Borders: thin and warm (`#84746d` at 40% opacity).

## Components
- **Buttons:** Primary = solid sienna (#c15814) fill, 8px radius. Secondary = outlined with warm taupe border. Text links underlined on hover.
- **Cards:** Warm white or `surface_container_low`, generous padding (28-32px). Minimal borders.
- **Inputs:** White background, warm taupe border, sienna focus state.

## Rules
- Whitespace is the primary design tool. When in doubt, add more.
- Content should feel curated, not cluttered. Limit items per section.
- Photography should be warm-toned. Use the tertiary blue only for small UI accents to maintain the desert aesthetic.