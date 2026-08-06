# Consumption (Live Data) page — net/hedge chart, tooltips, click-to-scroll, date column design spec

Date: 2026-08-06
Status: Approved for planning

## 1. Goal

Replace the existing "Consumption & production" chart (bars + line) on
`Customer Portal - Consumption (Live Data).html` with a net-usage /
hedge-volume chart that visualizes coverage the way the original Customer
Portal mockup's "Consumption vs. block cover" chart does — two lines with
the gap between them filled in, colored by whether that gap is uncovered
or surplus. Add real hover tooltips, change hover-vs-click semantics
(hover previews, click commits the table scroll/highlight), add a Date
column to the table, and add a `delta` value (tooltip-only).

This modifies the existing generated page in place — same
`generate_consumption_data.py` / `consumption-calc.js` triad, no new files.

## 2. Reference material check

The exact "Consumption vs. block cover — 15-minute intervals" chart in
`Customer Portal - Preview.html` is rendered by an opaque design-system
component (`PeakPowerDesignSystem_7164da.DayChart`) — there is no literal
SVG source for it in the file to copy. Two things *are* directly
inspectable and inform this design:

- The Day tab's legend, defining the color convention:
  `Uncovered — bought at day-ahead` (orange, `opacity:.55`) and
  `Surplus — sold at day-ahead` (cyan, `opacity:.3`).
- The Month tab's chart, which *is* hand-drawn SVG: daily bars plus a
  dashed indigo step-line (`stroke="#4f46e5"`) for block cover — the
  closest actual code precedent for "a bar series plus a distinctly-styled
  line series" in this codebase.

This spec's chart is built from scratch using that color/style language,
not ported from existing markup.

## 3. Calculation additions (`consumption-calc.js`)

`computeIntervalSeries`'s return value gains two fields (its 6-argument
signature is unchanged):

- `netKwh[]` — `(consumption[i] - production[i]) * 0.25` per interval.
  Already computed internally for `netCost`/`uncovered`, now also
  returned directly so the chart can plot it (previously only the
  derived `netCost`/`uncovered` were exposed, not the raw energy value).
  **Can be negative** — a solar/CHP-heavy site's production can exceed
  its consumption in an interval (per `CLAUDE.md`'s own profile
  descriptions for `logistics_hub`/`greenhouse`), so the chart's scale
  must handle a bipolar range, not just 0-to-max (see §5).
- `delta[]` — `netCost[i] - hedgeCost[i]`. Tooltip-only per the approved
  design; not a stat card, not a table column.

`computeDayStats` is untouched (its day/month-total fields don't need a
delta or netKwh total — nothing downstream asked for those aggregates).

## 4. The new chart (replaces the old one, Day and Month both)

Per interval:
- **Net usage line** — solid teal (`--pp-teal-700`), plotting `netKwh[]`.
- **Hedge volume line** — dashed indigo (`--pp-indigo`, `stroke-dasharray`),
  plotting `hedgeVolume[]`.
- **Uncovered/surplus bar** — one vertical bar per interval spanning from
  the net-line's y to the hedge-line's y at that x position:
  - `uncovered[i] >= 0` (net above hedge — under-hedged) → **orange**,
    opacity 0.55 — "uncovered, bought at day-ahead."
  - `uncovered[i] < 0` (net below hedge — over-hedged) → **cyan**,
    opacity 0.3 — "surplus, sold at day-ahead."
  - Bar geometry: `top = min(y(net[i]), y(hedge[i]))`,
    `height = |y(net[i]) - y(hedge[i])|` — same x/width placement the old
    consumption bars used (day: `barW` per interval; month: thin
    `stepX`-spaced bars across the horizontally-scrollable width).

Consumption and production are no longer plotted on any chart — both
remain in the table and in their existing stat cards, unaffected.

A new `--pp-orange:#ea580c` CSS token is added to `:root` (matching the
mockup's own orange) — the current page has no orange token yet, only
teal/green/red/cyan/indigo.

**Legend** replaces "Consumption"/"Production" with: Net usage (teal line
swatch), Hedge volume (dashed indigo line swatch), Uncovered — bought at
day-ahead (orange swatch), Surplus — sold at day-ahead (cyan swatch).

## 5. Bipolar Y-scale (new — the old chart never needed this)

The old chart assumed every value was ≥ 0 (consumption/production are
non-negative by construction) and mapped `[0, maxVal]` to the plot height
with the x-axis fixed at the bottom. `netKwh` can be negative, so this
chart needs a real bipolar scale:

```
minVal = min(0, min(netKwh[]), min(hedgeVolume[]))   // hedgeVolume ≥ 0 always,
maxVal = max(0, max(netKwh[]), max(hedgeVolume[]))   // so this only matters via netKwh
range  = maxVal - minVal  (guarded: if minVal === maxVal, widen by 1 to avoid ÷0)
y(val) = padTop + (maxVal - val) / range * plotH
```

A zero baseline is drawn at `y(0)` explicitly, using the same line style
the old chart used for its always-at-the-bottom axis line (`stroke:
#dbe3ec`) — just repositioned to `y(0)` instead of a fixed bottom edge,
since those two positions now differ whenever `minVal < 0`. For the large
majority of site/date combinations `netKwh` never goes negative, so
`minVal` is `0` and the chart looks identical in shape to a 0-based scale
— the bipolar math is a correctness fix for the sites/days where it
isn't, not a visual change for the common case.

## 6. Tooltip

One shared tooltip element (reused by both Day and Month charts, since
only one is visible at a time), `position: fixed`, positioned a small
fixed offset from the cursor (e.g. `clientX + 14px, clientY - 14px`, no
viewport-edge clamping — a deliberate simplification for this POC; the
tooltip can run off-screen very close to the right/bottom edge, not
worth the extra layout math here), `pointer-events: none` so it never
intercepts mouse events from the chart underneath it.

**Content** — the full row, per your approved preview:

```
5 Aug 2026 · 14:30
Consumption   612,4 kW
Production      0,0 kW
Net           612,4 kW
EPEX        0,0891 €/kWh
Net Cost       13,65 €
Hedge Volume   500,0 kWh
Hedge Price   0,0825 €/kWh
Hedge Cost     41,25 €
Uncovered      53,1 kWh
Delta         −27,60 €
```

Same decimal precision as the table (kW/kWh: 1, €/kWh: 4, €: 2), same
`formatNL` NL-style formatting. No sign-based color-coding inside the
tooltip — it's a compact informational popup, not the primary data
surface (that's still the table), so it stays plain text for simplicity.
Date header uses a new short format, "5 Aug 2026" (day, no leading zero +
3-letter month + year) — distinct from the crumb's existing long format
("Wednesday 5 August 2026") and the table's new Date column (below),
which both keep their own established/most-useful formats.

## 7. Hover vs. click (behavior change)

| Event | Old behavior | New behavior |
|---|---|---|
| `mousemove` over chart | crosshair + **auto highlight+scroll table row** | crosshair + **show/update tooltip** (no table scroll) |
| `mouseleave` | hide crosshair, **clear row highlight** | hide crosshair **and tooltip**; row highlight is left alone |
| `click` on chart | *(nothing)* | **highlight + scroll to** that interval's table row |

The click-selected row highlight is now independent of mouse movement —
it persists until the next click (on either chart) picks a different row,
or until the next `render()` call (switching site/date/month) clears it,
since a highlight pointing at stale data from a previous view is
misleading. This applies uniformly to both the Day and Month charts (one
shared interaction-wiring function, same as today's shared
`attachHoverHandler` — extended, not duplicated, to carry a click handler
alongside the existing hover handler).

## 8. Table: new Date column

One new column, first position, in both Day and Month table modes.
Format: the same short "5 Aug 2026" style as the tooltip header (day, no
leading zero, 3-letter month, year) — one shared `formatDateShort()`
helper used by both. In Day mode every row repeats the same date (cheap,
harmless, and requested without a Day/Month qualifier); in Month mode
this is the column that actually varies row-to-row and disambiguates the
repeating `HH:MM` values across days — the original motivating case.

## 9. Non-goals (explicitly out of scope, not oversights)

- No stat card or table column for `delta` — tooltip-only, per your answer.
- No hedge-cover line drawn *in addition to* the old consumption/production
  series — this chart replaces that series entirely, it doesn't overlay.
- No changes to `computeDayStats`, the stat cards, the hedge data model,
  or Month view's month-selection/partial-month mechanics — all untouched.
- No persistence of the click-selected row across a `render()` call
  (switching site/date/month always clears it) — see §7.

## 10. Verification plan

- Extend `consumption-calc.test.js`: assert `computeIntervalSeries` now
  also returns correct `netKwh`/`delta` arrays, including a case where
  `netKwh` is negative (production > consumption) to exercise the bipolar
  scale's real trigger condition, and a case verifying
  `delta[i] === netCost[i] - hedgeCost[i]` exactly.
- No new Python-side check is needed — the chart/tooltip/click logic is
  page-rendering glue with no new data-shape dependency; `netKwh`/`delta`
  are derived entirely from series already verified by
  `verify_consumption_page.py`.
- Manual QA (same rationale as prior specs — no headless-browser tooling
  in this project): open the page, confirm the new chart renders lines +
  colored bars with a visible zero-baseline; hover shows a tooltip that
  doesn't scroll the table; clicking a bar/line scrolls to and highlights
  the matching row; the Date column shows correctly in both Day and Month
  modes; pick a solar-heavy site/date where production can exceed
  consumption and confirm the net line dips below the zero-baseline
  correctly rather than clipping or distorting the scale.
