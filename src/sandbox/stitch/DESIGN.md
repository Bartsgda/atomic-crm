---
name: Luxury Gold
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393d'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b1f'
  surface-container: '#1e1f23'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343539'
  on-surface: '#e3e2e7'
  on-surface-variant: '#d0c5af'
  inverse-surface: '#e3e2e7'
  inverse-on-surface: '#2f3034'
  outline: '#99907c'
  outline-variant: '#4d4635'
  surface-tint: '#e9c349'
  primary: '#f2ca50'
  on-primary: '#3c2f00'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#735c00'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#d0cecd'
  on-tertiary: '#313030'
  tertiary-container: '#b5b2b2'
  on-tertiary-container: '#464545'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c9c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474646'
  background: '#121317'
  on-background: '#e3e2e7'
  surface-variant: '#343539'
typography:
  display-lg:
    fontFamily: Noto Serif
    fontSize: 64px
    fontWeight: '400'
    lineHeight: 72px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Noto Serif
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Noto Serif
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: 0em
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.08em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1200px
  gutter: 24px
  margin-x: 64px
  stack-sm: 16px
  stack-md: 32px
  stack-lg: 64px
---

## Brand & Style

This design system is engineered to evoke feelings of exclusivity, heritage, and uncompromising quality. It targets a high-net-worth demographic and industries where trust and prestige are paramount, such as private banking, luxury real estate, and boutique horology.

The visual style is a blend of **Minimalism** and **Glassmorphism**. We utilize expansive negative space (darkness) to allow content to breathe, emphasizing the "less is more" philosophy of premium brands. Subtle tactile elements—such as microscopic 1px borders and soft radial gradients—mimic the way light catches expensive materials like brushed metal and polished obsidian. The result is a UI that feels heavy, quiet, and profoundly expensive.

## Colors

The palette is anchored by "Metallic Gold" (#d4af37), used intentionally as a spotlight color rather than a primary fill. The background architecture utilizes a tiered dark strategy: pure black for the deepest foundations and charcoal for interactive surfaces.

- **Primary (Gold):** Reserved for high-value actions, brand moments, and critical focal points.
- **Surface (Charcoal):** Used for cards and navigation elements to create separation from the background.
- **Background (Black):** The base canvas, providing infinite depth.
- **Accents:** Linear gradients moving from #d4af37 to #f9e29b are used to simulate the luster of physical gold under light.

## Typography

Typography in this design system follows an editorial rhythm. We pair the timeless, authoritative serifs of **Noto Serif** for headlines with the modern, technical precision of **Manrope** for functional text.

Headlines should utilize generous tracking for a more relaxed, confident appearance. Body text is optimized for legibility against dark backgrounds, using slightly increased line heights and weight to prevent "haloing" or text bleed. Labels and small captions are set in all-caps with wide letter-spacing to mimic the engravings found on luxury goods.

## Layout & Spacing

The layout utilizes a **Fixed Grid** model to ensure a curated, gallery-like experience. Central content is housed within a 1200px container, while decorative elements and background gradients may bleed to the edges of the viewport.

Spacing is intentionally generous. We avoid crowding elements, favoring "Stack" patterns that use 64px or 80px gaps to signal a change in narrative or section. The 8px base unit ensures mathematical harmony, but designers are encouraged to over-index on whitespace to maintain the premium feel.

## Elevation & Depth

Depth is conveyed through **Tonal Layers** and **Subtle Outlines** rather than aggressive shadows. 

1.  **Base (Level 0):** Pure #000000.
2.  **Surface (Level 1):** #121212. Used for the main UI sections.
3.  **Overlay (Level 2):** #1a1a1a. Used for modals and floating menus.

To define edges, this design system uses "Gold Dust" outlines—1px borders with a 10-15% opacity gold tint. When an element is elevated (like a hovered card), a subtle, extra-diffused shadow with a slight #d4af37 tint (5% opacity) is applied to create a "inner glow" effect rather than a traditional drop shadow.

## Shapes

The shape language is disciplined and professional. We use **Soft** rounding (Level 1) to take the edge off the digital experience without feeling playful or "bubbly." 

- Standard components (Buttons, Inputs): 4px radius.
- Large containers (Cards, Sections): 8px radius.
- Imagery: Should always maintain sharp or 4px corners to preserve the architectural feel of the brand. 

Avoid full pill-shapes or high-radius circles unless used for specific profile avatars.

## Components

### Buttons
Primary buttons use a subtle vertical gradient of Gold (#d4af37 to #b38f2d) with black text. Secondary buttons are ghost-style with a 1px gold border and gold text. All buttons feature a 200ms transition on hover, where the gold luminance increases slightly.

### Cards
Cards are built using the Charcoal surface color with a 1px border (#ffffff at 5% opacity). On hover, the border color shifts to a muted gold.

### Input Fields
Inputs are minimalist, featuring only a bottom-border in a neutral grey. Upon focus, the border transitions to gold and a very subtle radial gradient glows from the bottom of the field.

### Chips & Tags
Chips are small, rectangular, and use the "Label-sm" typography. They feature a dark grey background with light grey text to remain secondary to the main gold-themed actions.

### Additional Components
- **Dividers:** Use a 1px line with a linear gradient (Transparent -> Gold at 20% -> Transparent) to create an elegant break between sections.
- **Scrollbars:** Custom-styled to be ultra-thin (4px) in a dark charcoal, turning gold only when active.