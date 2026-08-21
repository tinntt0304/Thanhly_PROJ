# Handoff: hifen Logo & Favicon

## Overview
Brand mark for "hifen" — a liquidation/clearance site for baby & pet products (đồ mẹ & bé, thú cưng thanh lý). Icon: two rounded shapes joined by a pill-shaped horizontal bar (a literal "hyphen"), symbolizing the connection between the two product categories, plus a small accent dot.

## About the Design Files
The files here are **design references created in HTML/SVG** — not production code to copy directly. Recreate the mark in your app's existing environment (React, native, etc.) using its own asset pipeline; the SVGs are safe to use as-is since they're already flat vector artwork.

## Fidelity
**High-fidelity.** Final colors, shapes and proportions — implement pixel-for-pixel.

## Design Tokens
- Background pill / badge fill: `--color-accent-2-100` → `#e9ecdf` (approx, sage tint 100)
- Bar (hyphen shape): `--color-accent-2-600` → sage 600, hex `#5c6a44`
- Accent dot: `--color-accent-500` → terracotta 500, hex `#c67139`
- Badge corner radius: 20 on a 64×64 box (≈31%) — keep this ratio if you rescale
- Wordmark typeface: Caprasimo (display), set in the Organic design system's `--font-heading`
- Tagline typeface: Figtree (body), `--font-body`
- Wordmark color: `--color-text` (#201e1d)
- Tagline color: `--color-neutral-700`

Exact hex values above are the Organic design system's tokens at the time of this handoff — pull the live values from the design system's `styles.css` if you have it, rather than hardcoding these.

## Assets
- `hifen-icon.svg` — icon mark alone, 64×64 viewBox, flat SVG, transparent background outside the badge shape.
- `hifen-favicon.svg` — identical artwork, intended for `<link rel="icon">`. Works at 16px and 32px without redrawing (shapes are simple enough to stay legible).
- For platforms needing PNG/ICO (e.g. Apple touch icon, older browsers), rasterize `hifen-favicon.svg` at 16, 32, 180, 512px.

## Logo Lockup (icon + wordmark)
- Layout: icon left, wordmark stack right, `gap: 24px`, vertically centered.
- Icon size in lockup: 72×72px.
- Wordmark: "hifen" lowercase, Caprasimo, ~44px, line-height 1.
- Tagline directly below wordmark: "đồ mẹ & bé · thú cưng thanh lý", Figtree ~15px, letter-spacing 0.02em, color `--color-neutral-700`, 4px gap from wordmark.
- Minimum clear space around the lockup: half the icon's height on all sides.

## Color Variants (see reference file)
1. **Primary** — sage-tinted badge, sage bar, terracotta dot (light backgrounds).
2. **Reversed** — dark sage badge fill, cream bar, light terracotta dot (for dark/sage-colored backgrounds).
3. **Monochrome** — near-black badge, cream bar and dot (for single-color print/stamping contexts).

## Files
- `Hifen Logo.dc.html` — the interactive reference showing the full lockup, icon variants, and favicon-in-tab mockup.
- `hifen-icon.svg`, `hifen-favicon.svg` — production-ready vector assets.
