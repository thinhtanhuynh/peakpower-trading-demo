# Consumption (Live Data) page — hedge columns, hover, and month view design spec

Date: 2026-08-06
Status: Approved for planning

## 1. Goal

Extend the existing `Customer Portal - Consumption (Live Data).html` (built
in the prior `2026-08-06-consumption-live-data-page-design.md` spec) with:

1. Per-interval hedge/cost figures, computed from `hedge_blocks_2026.json`,
   added to the day table and (aggregated) to the stat cards.
2. Hover-linked highlighting between the chart and the table.
3. A second chart type — a full-resolution **Month view** — alongside the
   existing **Day view**, with the table following whichever mode is active.

This is a modification of the existing generated page, not a new file: the
same `generate_consumption_data.py` / `consumption-calc.js` /
`Customer Portal - Consumption (Live Data).html` triad gets extended and
regenerated.

## 2. Hedge data model

`hedge_blocks_2026.json` (12 rows: 6 sites × 2 shapes, all currently
`periodType: "YEAR"`, `periodStart: "2026-01-01"`, `periodEnd:
"2026-12-31"`) is loaded by `generate_consumption_data.py` alongside the
combined usage file and folded into the compact dataset as a new top-level
`hedge` key, keyed by site id (not EAN, for consistency with `bySite`):

```jsonc
"hedge": {
  "rot": [
    {"shape":"base","periodStart":"2026-01-01","periodEnd":"2026-12-31","powerKw":1000.0,"priceKwh":0.07},
    {"shape":"peak","periodStart":"2026-01-01","periodEnd":"2026-12-31","powerKw":1000.0,"priceKwh":0.095}
  ],
  "venlo": [ ... ],
  "...": "6 sites total, 2 blocks each currently"
}
```

Deliberately generic (not hardcoded to "one YEAR block per shape"): each
site's value is a plain list of blocks, each with its own `periodStart`/
`periodEnd`/`shape`/`powerKw`/`priceKwh`. This means if
`hedge_blocks_2026.json` later gains MONTH/QUARTER rows (per its own
`gen_hedge.py` builders, already documented in `CLAUDE.md`), this page
picks them up on the next regeneration with no code change — the
per-interval matching logic (below) already operates over "all blocks
active for this site/date/time", not "the one yearly block."

`tilburg-gas` has no hedge rows (matches it having no usage rows) and is
already outside `SITE_META`, so it's excluded the same way usage data is.

## 3. Per-interval hedge/cost formulas

New pure function in `consumption-calc.js`, `computeIntervalHedge(dateStr,
timeStr, hedgeBlocks)`, returns `{hedgeVolumeKwh, hedgePriceKwh,
hedgeCostEur}` for one interval:

- A block is **active** for `(dateStr, timeStr)` if:
  - `dateStr` falls within `[block.periodStart, block.periodEnd]`
    (inclusive, ISO string comparison — valid since all dates are
    `YYYY-MM-DD`), **and**
  - if `block.shape === "peak"`: `dateStr`'s weekday is Mon–Fri **and**
    `timeStr`'s hour is in `[8, 20)` (08:00 through 19:45 inclusive) —
    matching `gen_hedge.py`'s `d.weekday() < 5` / "08:00–20:00" definition
    exactly (JS `Date.getDay()` 1–5 = Mon–Fri, same convention).
  - if `block.shape === "base"`: always active once the date is in-period
    (no time-of-day restriction).
- For each active block: `volume = block.powerKw × 0.25` (kWh) — the "1 MW
  → 250 kWh per 15-min interval" conversion, generalized to any `powerKw`.
- `hedgeVolumeKwh` = sum of active blocks' `volume`.
- `hedgeCostEur` = sum of active blocks' `volume × block.priceKwh`.
- `hedgePriceKwh` = `hedgeCostEur / hedgeVolumeKwh` if `hedgeVolumeKwh > 0`,
  else `0` (blended price across simultaneously-active shapes — e.g.
  weekday 08:00–20:00 with both base and peak active today blends to
  `(250×0.07 + 250×0.095) / 500 = 0.0825 €/kWh`; off-peak/weekend hours
  today are base-only, so it's just `0.07`).

Per-interval **net cost** (independent of hedging — this is intentional
per the user's own definition, not a bug: it answers "what would this
interval cost at spot price alone," while hedge cost/uncovered answer "what
have we locked in / what's left exposed"):

- `netCostEur = netKwh × epexPrice` where `netKwh = (consumption − production) × 0.25`
  — this is exactly today's per-interval contribution to the existing daily
  `spotResultEur` stat, now also surfaced as its own table column.

**Uncovered (kWh)** = `netKwh − hedgeVolumeKwh` — can be negative (hedge
volume exceeds net consumption that interval, i.e. over-hedged/surplus).

New function `computeIntervalSeries(dateStr, times, prices, consumption,
production, hedgeBlocks)` builds all five new per-interval series
(`netCost[]`, `hedgeVolume[]`, `hedgePrice[]`, `hedgeCost[]`,
`uncovered[]`) in one pass, reusing `computeIntervalHedge` per index, for
the table renderer to consume directly. `computeDayStats` (existing) is
extended to also return `hedgeCostEur` (day total) and `uncoveredKwh` (day
total) by summing the new series — no change to its existing fields
(`consumptionKwh`, `productionKwh`, `netKwh`, `peakKw`, `peakTime`,
`spotResultEur`) so nothing already relying on it breaks.

## 4. Stat cards

Existing 5 cards kept, with one rename for terminology consistency with
the new table column:

| Card | Change |
|---|---|
| CONSUMPTION | unchanged |
| PRODUCTION | unchanged |
| NET / IMPORT | unchanged |
| PEAK DEMAND | unchanged |
| ~~SPOT RESULT~~ → **NET COST** | same formula (`spotResultEur`), relabeled to match the table's "Net Cost" column — same value, same tone logic (critical if positive, success if negative) |

Two new cards appended:

| Card | Formula | Tone |
|---|---|---|
| HEDGE COST | day total `hedgeCostEur` | none (informational — this is a locked-in cost, not a variance signal) |
| UNCOVERED | day total `uncoveredKwh` | `export`-style (cyan) when negative (over-hedged that day), default otherwise |

## 5. Table

5 new columns appended to the existing 5 (Time, Consumption, Production,
Net, EPEX), in this order: **Net Cost (€)**, **Hedge Volume (kWh)**,
**Hedge Price (€/kWh)**, **Hedge Cost (€)**, **Uncovered (kWh)** — 10
columns total. The table's existing `.table-wrap { overflow: auto }`
already scrolls both axes, so no layout rework is needed for the extra
width.

- Net Cost: colored like the existing NET column convention (default when
  positive, cyan/`export`-style when negative — negative means that
  interval was a net seller at spot price).
- Uncovered: same negative-color convention (negative = over-hedged that
  interval).
- Each `<tr>` gets a `data-idx="<i>"` attribute (0-based index into that
  view's current arrays) so the hover mechanism (below) can address rows
  directly without re-deriving position from text content.
- Display precision, matching existing conventions: kWh/kW columns (Hedge
  Volume, Uncovered) — 1 decimal, same as Consumption/Production/Net;
  €/kWh columns (Hedge Price) — 4 decimals, same as EPEX; € cost columns
  (Net Cost, Hedge Cost) — 2 decimals, same as the existing "Spot result"
  stat card's formatting.

## 6. Hover → table row highlight

One shared JS helper, used by both Day and Month charts:

- A transparent full-plot-height `<rect>` overlay sits on top of the
  bars/line, listening for `mousemove`/`mouseleave`.
- On `mousemove`: compute `i = clamp(round((mouseX − padLeft) / (plotW /
  n)), 0, n − 1)` (same geometry the chart already uses to place bars/
  points — no new coordinate system).
- Draw/update a thin vertical crosshair line at that interval's x-position
  (visual feedback on the chart itself).
- Toggle a `.hovered` class onto `tr[data-idx="i"]` in the table (removing
  it from whichever row had it before) and call `.scrollIntoView({block:
  "nearest"})` on that row.
- On `mouseleave`: remove the crosshair and the `.hovered` class.

This avoids per-mark listeners entirely (important once Month view has up
to ~2,976 points) — one listener on one overlay element per chart,
independent of point count.

## 7. Month view (new chart type)

**Toggle:** two small pill buttons, "Day" / "Month", above the chart
(visually similar to the mockup's `Tabs` component, hand-styled to match
existing chart-card chrome — no new dependency).

**Month selector:** a `<select>` (shown only in Month mode) listing every
distinct `YYYY-MM` present across `Object.keys(DATA.byDate)` for the
current site — this naturally includes the trailing partial month
(2026-08, only 5 days of data) with no special-casing; its option label
reads e.g. "August 2026 (partial — through 5 Aug)" when the last day of
that month isn't present in the data, plain "August 2026" otherwise.
Default: the month containing `MAX_DATE`.

**Data:** built at render time by concatenating, in calendar order, the
existing per-date `t`/`p`/`c`/`g` arrays (from `byDate`/`bySite`) for every
date in the selected month already present in `DATA.byDate` — no new data
is embedded for this; it's a client-side concatenation of what's already
there.

**Chart type:** a **line/area chart** (distinct from Day view's bar+line),
since ~2,976 points as discrete bars in a fixed-width chart isn't legible.
Rendered in a horizontally-scrollable SVG whose width scales with interval
count (a few px per interval) inside an `overflow-x: auto` wrapper — so
each day is still visually distinguishable when scrolled, rather than
squeezed into the card's normal width. Plots consumption as a filled area
(teal, low opacity) with production as a green line on top, same color
language as Day view. Day-boundary gridlines + date labels (one per day)
replace Day view's hour gridlines.

**Table sync:** per your answer, in Month mode the table below switches to
list every interval in the selected month (all its rows now carry the 10
columns above, `data-idx` re-indexed 0..N−1 for that month), and the hover
mechanism addresses this longer table the same way. Switching back to Day
mode reverts the table to the single selected day.

## 8. Edge cases

- **Partial trailing month (August 2026, 5 days):** handled by deriving
  month options and their data from what's actually present in
  `DATA.byDate`, not from calendar knowledge of how many days a month
  "should" have.
- **DST day (2026-03-29, 92 intervals) inside a selected month:** already
  handled by the existing per-date array-length-agnostic design; Month
  view's concatenation just produces a slightly shorter day within the
  month's combined array, same as Day view already handles it standalone.
- **Zero hedge volume in an interval:** not possible under the current
  data (base is always active for every in-scope date), but the formulas
  above handle it safely (`hedgePriceKwh` guarded against divide-by-zero).
- **Uncovered/Net Cost/Hedge Cost negative values:** displayed with the
  existing negative-value color convention (cyan/`export`), consistent
  with the current NET column.

## 9. Non-goals (explicitly out of scope, not oversights)

- No hedge-cover line/overlay drawn on the chart itself (day or month) —
  the ask was for table columns + stat cards, not a visual overlay. Can be
  a follow-up if wanted later.
- No Quarter view — only Day and Month, per what was asked.
- No changes to the underlying `consumption_live_data.json` shape from the
  prior spec — only a new `hedge` key is added alongside it.

## 10. Verification plan

- Unit tests for `computeIntervalHedge` / `computeIntervalSeries` (Node,
  plain assert): base-only interval, base+peak overlapping interval
  (blended price), weekend interval (peak inactive despite being within
  the peak period), an interval outside a block's period (future
  extension case, even though no current data exercises it), and the
  divide-by-zero guard.
- Extend `computeDayStats`'s existing tests to assert the two new day-total
  fields.
- `verify_consumption_page.py` gets a new check: for a sampled site/date,
  recompute `hedgeVolumeKwh`/`hedgeCostEur` independently from the embedded
  `hedge` blocks and the known base/peak formulas, and assert it matches
  what a fresh evaluation of the embedded calc logic would produce for a
  known interval (e.g. a weekday-peak interval and an off-peak interval on
  the same day) — a numeric spot check, not a UI check.
- Manual QA (not automated, same rationale as the prior spec — no headless
  browser tooling in this project): open the regenerated HTML, confirm the
  5 new table columns render with sensible values, confirm hovering a Day
  chart bar highlights/scrolls the matching row, switch to Month view and
  confirm the table lists the whole month and hover still works, confirm
  the partial-August month option renders and behaves correctly.
