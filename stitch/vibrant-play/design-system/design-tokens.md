---
name: Vibrant Play
colors:
  surface: '#fdf8ff'
  surface-dim: '#ddd8e4'
  surface-bright: '#fdf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f1fd'
  surface-container: '#f1ecf8'
  surface-container-high: '#ebe6f2'
  surface-container-highest: '#e5e0ec'
  on-surface: '#1c1b23'
  on-surface-variant: '#474554'
  inverse-surface: '#312f38'
  inverse-on-surface: '#f4effb'
  outline: '#787585'
  outline-variant: '#c9c4d6'
  surface-tint: '#5c47cd'
  primary: '#5a45cb'
  on-primary: '#ffffff'
  primary-container: '#7360e5'
  on-primary-container: '#fffbff'
  inverse-primary: '#c8bfff'
  secondary: '#ae285c'
  on-secondary: '#ffffff'
  secondary-container: '#fd6799'
  on-secondary-container: '#6a0031'
  tertiary: '#855000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a76500'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5deff'
  primary-fixed-dim: '#c8bfff'
  on-primary-fixed: '#190064'
  on-primary-fixed-variant: '#442bb5'
  secondary-fixed: '#ffd9e1'
  secondary-fixed-dim: '#ffb1c5'
  on-secondary-fixed: '#3f001a'
  on-secondary-fixed-variant: '#8d0644'
  tertiary-fixed: '#ffdcbb'
  tertiary-fixed-dim: '#ffb869'
  on-tertiary-fixed: '#2c1700'
  on-tertiary-fixed-variant: '#673d00'
  background: '#fdf8ff'
  on-background: '#1c1b23'
  surface-variant: '#e5e0ec'
typography:
  display-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 72px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.6'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.1em
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
  lg: 48px
  xl: 80px
  container-max: 1200px
  gutter: 24px
---

## Brand & Style

This design system is built on a foundation of **Neo-Brutalism mixed with Playful Modernism**. It targets a creative, youthful audience that values high-energy interactions and clear, impactful messaging. The brand personality is optimistic, quirky, and "low-stakes high-reward," making it ideal for micro-apps, educational tools, or creative portfolio sites.

The visual language is defined by thick, high-contrast borders, a "sticker-on-paper" aesthetic, and an unapologetic use of vibrant, saturated colors. It avoids the clinical "cleanliness" of corporate SaaS in favor of a tactile, expressive environment that feels built rather than manufactured.

## Colors

The palette is derived from high-chroma primary and secondary hues supported by secondary "vibe" colors (Teal and Yellow).

### Light Mode
In Light Mode, the system uses a very soft, off-white lavender tinted background (`#F8F7FF`) to make the saturated components "pop" without the harshness of pure white. Text and borders always utilize the Deep Navy (`#1B1B2F`) for maximum legibility.

### Dark Mode
In Dark Mode, the background shifts to a deep obsidian purple (`#16132D`). Surfaces use slightly lighter navy-purple tints to create depth, while accent colors remain high-vibrancy to ensure they maintain their "glow" against the dark backdrop.

**Accessibility Note:** Maintain a minimum 4.5:1 contrast ratio for all text elements. When using Yellow or Teal backgrounds, use the Deep Navy text color rather than white.

## Typography

Typography is a central design element. We use **Plus Jakarta Sans** for headlines to provide a friendly, rounded geometric feel that remains modern. For body copy, **Hanken Grotesk** offers superior legibility and a contemporary edge.

- **Contrast is key:** Use heavy weights (700+) for headlines to compete with the bold borders of the UI.
- **Micro-copy:** Use uppercase labels with increased letter spacing for small metadata or "overlines" above titles.
- **Color Blocks:** On vibrant background blocks, text should default to the neutral navy unless the background is specifically the primary purple, in which case white is preferred.

## Layout & Spacing

The layout follows a **Fluid Grid** model with generous safe-area margins.

- **The 8px Rule:** All spacing should be multiples of 8px to maintain a rhythmic vertical flow.
- **Containerization:** Content is grouped into distinct cards. Avoid "floating" elements that aren't contained within a bordered surface.
- **Responsive Behavior:**
  - **Desktop:** 12-column grid, 80px side margins.
  - **Tablet:** 8-column grid, 40px side margins.
  - **Mobile:** 4-column grid, 20px side margins.
- **Visual Weight:** Larger components (like Hero Cards) should use `lg` (48px) internal padding, while smaller utility cards use `md` (24px).

## Elevation & Depth

This system rejects ambient soft shadows in favor of **Hard Offsets** and **Tonal Layers**.

- **Hard Shadows:** Use a solid, 100% opacity offset shadow (usually 4px to 8px) in the neutral Navy color. This creates a "3D Sticker" effect.
- **Tonal Layering:** In Dark Mode, depth is achieved by placing lighter purple-tinted surfaces on the obsidian background.
- **Active States:** When a component is clicked or "pressed," the hard shadow should disappear and the element should translate (move) X and Y to occupy the space the shadow previously held, simulating a physical button press.
- **Outlines:** Every interactive surface must have a minimum 2px solid border in the neutral Navy color.

## Shapes

The shape language is consistently "Chunky."

- **Cards/Buttons:** Use `rounded-lg` (16px) for main containers to balance the "hard" brutalist borders with "soft" friendly corners.
- **Selection Controls:** Checkboxes and radio buttons should feel slightly oversized with 4px corner radii.
- **Icons:** Use thick-stroke (2pt or greater) icons with rounded caps to match the stroke weight of the UI borders.

## Components

### Buttons
- **Primary:** Vibrant Primary Purple background, Navy 2px border, Navy 4px hard-offset shadow, White text.
- **Secondary:** Accent Teal or Pink background, Navy 2px border, Navy 4px hard-offset shadow, Navy text.
- **Ghost:** No background, Navy border, no shadow until hover.

### Cards
Cards are the primary layout building block. They must always feature a 2px Navy border. For "featured" content, add a 6px-8px Navy hard-offset shadow.

### Input Fields
Inputs use a white (Light Mode) or very dark purple (Dark Mode) background with a 2px Navy border. On focus, the border color remains Navy but the card "lifts" by gaining a 4px hard-offset shadow.

### Chips / Badges
Chips are small, fully rounded (pill-shaped) elements. Use them for tags or status indicators. They should use a high-contrast background color from the accent palette (Yellow, Teal, Orange) with Navy text.

### Progress Streaks / Maps
Visualizing progress should use geometric circles with thick borders. Completed states use the Accent Teal, while empty states use a semi-transparent Navy stroke.
