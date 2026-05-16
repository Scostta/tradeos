# TradeOS — Design System

## Typography

### Font stack
| Role | Font | Variable |
|---|---|---|
| UI — labels, body, headings | Geist Sans | `font-sans` |
| Numbers, values, badges, timestamps | JetBrains Mono | `font-mono` / `mono` utility |

All P&L values, prices, quantities, timestamps, and metric values **must** use `font-mono` (or the `mono` utility, which also sets `tabular-nums` and `tracking-mono`).

---

### Text size scale

| Class | Size | Usage |
|---|---|---|
| `text-xxs` | 9px | Chart axis labels, table `<th>` |
| `text-xs` | 10px | Version strings, timestamps, badge text |
| `text-sm` | 11px | Table cell content, sub-labels, pagination |
| `text-base` | 12px | Inputs, secondary body, filter text |
| `text-md` | 13px | Primary body, nav items |
| `text-lg` | 14px | Mono values in spec grids |
| `text-xl` | 18px | Page titles (TopBar `<h1>`), P&L medium |
| `text-2xl` | 22px | Instrument names, drawer dates |
| `text-3xl` | 28px | Metric card primary values |
| `text-4xl` | 32px | Trade hero P&L |
| `text-5xl` | 40px | Reserved — maximum emphasis |

> **Rule**: never use `text-[Xpx]` arbitrary values. Pick the closest step from this scale.

---

### Tracking (letter-spacing)

| Class | Value | Usage |
|---|---|---|
| `tracking-tight` | −0.02em | Large numbers (`text-3xl` and above) |
| `tracking-mono` | −0.01em | Monospace inline values |
| `tracking-normal` | 0 | Default body text |
| `tracking-wide` | 0.04em | Version strings, metadata |
| `tracking-wider` | 0.08em | Direction badges (LONG / SHORT) |
| `tracking-caps` | 0.1em | Uppercase section headers (`label-caps`) |
| `tracking-widest` | 0.12em | Smallest-label variants |

> **Rule**: never use `tracking-[Xem]` arbitrary values.

---

## Border radius

| Class | Size | Usage |
|---|---|---|
| `rounded-xs` | 1px | Hairline indicators (active nav bar) |
| `rounded-sm` | 4px | Buttons (`btn-accent`, `btn-ghost`), inputs |
| `rounded` | 4px | Nav item hover background |
| `rounded-md` | 6px | Cards (`card`), logo badge, icon badge |
| `rounded-lg` | 8px | Panels, drawers, modals |
| `rounded-full` | 9999px | Avatar / pill elements |

> **Rule**: never use `rounded-[Xpx]` arbitrary values.

---

### Font weights
- `font-normal` (400) — body text
- `font-medium` (500) — active nav, labels, caps headers
- `font-semibold` (600) — headings, large values, CTAs

---

## Colors

### Backgrounds / surfaces
| Tailwind class | Value | Usage |
|---|---|---|
| `bg-bg` | `#0a0a0f` | Page background |
| `bg-surface` | `#111118` | Cards, sidebar |
| `bg-surface-2` | `#15151f` | Hover / active states, inputs |

### Borders
| Tailwind class | Value | Usage |
|---|---|---|
| `border-border` | `#1e1e2e` | Default border |
| `border-border-hi` | `#2a2a3d` | Hover border |

### Text
| Tailwind class | Value | Usage |
|---|---|---|
| `text-text` | `#e5e7eb` | Primary |
| `text-text-dim` | `#9ca3af` | Secondary |
| `text-text-mute` | `#6b7280` | Labels, muted |

### Semantic
| Tailwind class | Value | Usage |
|---|---|---|
| `text-accent` / `bg-accent` | `#a3e635` | Brand, CTAs, active nav indicator |
| `text-profit` | `#22c55e` | Positive P&L, win indicators |
| `text-loss` | `#ef4444` | Negative P&L, drawdown |
| `text-long` | `#3b82f6` | LONG direction badge |
| `text-short` | `#f59e0b` | SHORT direction badge |

Accent glow: `box-shadow: 0 0 16px var(--accent-glow)` — used on logo and primary CTA buttons.

---

## Utility classes

| Class | What it does |
|---|---|
| `card` | `bg-surface` + `border border-border` + `rounded-md` |
| `label-caps` | 9px · uppercase · `tracking-caps` · `text-text-mute` · `font-medium` |
| `mono` | JetBrains Mono + `tabular-nums` + `tracking-mono` |
| `btn-accent` | Lime CTA: `bg-accent text-bg font-semibold` + glow |
| `btn-ghost` | Ghost: `border border-border text-text-dim` |
| `icon-btn` | 30×30 ghost icon button |
| `page-pad` | 28px uniform padding (`1.75rem`) |
