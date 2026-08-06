# Consumption (Live Data) page — design spec

Date: 2026-08-06
Status: Approved for planning

## 1. Goal

Add a new, standalone page — a "Live Data" version of the Customer Portal's
**Consumption** screen — that shows real 15-minute interval data (from
`epex_tariffs_usage_combined_15_min_interval.json`) for a user-selected
connection (EAN) and date, instead of the existing mockup's seeded/random
placeholder data.

This is additive: it does not touch `Customer Portal - Preview.html` or
`Back Office Portal - Preview.html`, which stay as pure design mockups per
existing project convention.

## 2. Scope

**In scope:**
- Day-level view only: pick one connection + one date, see that day's 96 (or
  92, on the DST-short day) 15-minute intervals as a chart + full table.
- All 6 electricity connections (Rotterdam DC, Venlo cold store, Tilburg
  plant, Almere office, unnamed/greenhouse, Breda warehouse).
- Full date range present in the data: 2026-01-01 through 2026-08-05 (217
  days).
- Consumption, production, net (consumption − production), and EPEX
  day-ahead price per interval.

**Out of scope (explicitly deferred, not oversights):**
- Month/Quarter tabs from the original mockup.
- Block/hedge cover overlay (`hedge_blocks_2026.json`) — that data models a
  yearly hedge position, not a 15-min series, and wasn't asked for here.
- `tilburg-gas` connection — no usage rows exist for it (non-electricity,
  non-tradeable), so it's excluded from the connection selector.
- Editing/interactivity beyond selecting a connection and a date (no
  drill-down, no export, no annotations).

## 3. Data pipeline

New script `generate_consumption_data.py` (sibling to `gen_hedge.py`,
same style: re-runnable, documented, deterministic — no randomness of its
own, it's a pure transform of existing data).

**Input:** `epex_tariffs_usage_combined_15_min_interval.json` (124,968 rows).

**Output:** `consumption_live_data.json`, a compact structure scoped to only
what the page needs — this is what gets embedded into the HTML page:

```jsonc
{
  "sites": [
    { "id": "rot",    "ean": "871687100000000011", "name": "Rotterdam DC" },
    { "id": "venlo",  "ean": "871687100000000027", "name": "Venlo cold store" },
    { "id": "tilburg","ean": "871687100000000043", "name": "Tilburg plant" },
    { "id": "almere", "ean": "871687100000000059", "name": "Almere office" },
    { "id": "unnamed","ean": "871687100000000061", "name": "— no name set —" },
    { "id": "breda",  "ean": "871687100000000078", "name": "Breda warehouse" }
  ],
  "byDate": {
    "2026-01-01": { "t": ["00:00", "00:15", "..."], "p": [0.0896, "..."] },
    "...": "217 dates total"
  },
  "bySite": {
    "rot": {
      "2026-01-01": { "c": [612.4, "..."], "g": [0.0, "..."] },
      "...": "217 dates total"
    },
    "...": "6 sites total"
  }
}
```

- `byDate[date].t` / `.p` (local time-of-day labels + EPEX €/kWh) are stored
  **once per date**, shared across all 6 sites, since price and interval
  timing don't vary by site — avoids 6x duplication.
- `bySite[id][date].c` / `.g` are per-site consumption/production (kW),
  arrays aligned index-for-index with `byDate[date].t`.
- Values rounded before embedding: consumption/production to 1 decimal
  place (kW), EPEX price to 4 decimal places (€/kWh) — matches the source
  data's meaningful precision without bloating the embedded JSON.
- Array lengths vary per date (92 on 2026-03-29, the DST spring-forward day;
  96 every other day) — the page must not assume a fixed length of 96.
- Estimated embedded size: ~1.5–2 MB of JSON, inlined via a
  `<script type="application/json" id="consumption-data">` tag in the HTML
  — no `fetch()`, so the page works when opened directly as a local file
  (`file://`), with no server and no CORS concerns.

## 4. Page: `Customer Portal - Consumption (Live Data).html`

A single self-contained HTML file (inline `<style>` and `<script>`, no
external requests), visually consistent with the existing portal mockup but
hand-written — the mockup's `PeakPowerDesignSystem_7164da.*` components are
resolved by a design tool at export time and aren't available to a plain
browser, so equivalent markup/CSS is recreated directly using the same
design tokens (colors, spacing, type scale) pulled from the mockup's
embedded `:root` CSS variables (`--pp-teal-700`, `--pp-sidebar-bg`,
`--font-sans: 'Inter', ...`, etc.).

### 4.1 Chrome

- **Sidebar** (dark, `--pp-sidebar-bg`): the portal's 7 nav labels
  (Dashboard, Connections, Consumption, Prices, Trading, Wallet, Invoices),
  static/non-interactive, "Consumption" visually highlighted as active.
- **Topbar**: breadcrumb line `{site name} · {formatted date}` (e.g.
  "Rotterdam DC · Wednesday 5 August 2026"), title "Consumption", and an
  info-tone badge reading **"GENERATED TEST DATA"** (not "provisional data"
  like the mockup — this is honestly-labeled synthetic data, per
  `CLAUDE.md`'s framing of the dataset).

### 4.2 Controls

- Connection dropdown (`<select>`): the 6 sites, default **Rotterdam DC**.
- Date picker (`<input type="date" min="2026-01-01" max="2026-08-05">`),
  default **2026-08-05** (latest available day).
- Changing either control instantly re-renders stat cards, chart, and table
  from the already-embedded data (pure client-side JS, no loading state
  needed).

### 4.3 Stat cards

Computed client-side from the selected site+date's `c`/`g`/`p` arrays
(interval duration = 0.25 h for every interval, including the DST day):

| Card | Formula | Notes |
|---|---|---|
| CONSUMPTION | Σ(c[i] × 0.25) | kWh, total for the day |
| PRODUCTION | Σ(g[i] × 0.25) | kWh, total for the day |
| NET / IMPORT | Σ((c[i] − g[i]) × 0.25) | kWh; can be negative (net exporter) |
| PEAK DEMAND | max(c[i]) + its time-of-day | e.g. "2.612,4 kW at 14:30" |
| SPOT RESULT | Σ((c[i] − g[i]) × 0.25 × p[i]) | € indicative cost at day-ahead prices |

SPOT RESULT tone: default/critical styling when positive (net cost as a
buyer), success styling when negative (net credit as a seller that day).

### 4.4 Chart

Hand-built inline SVG (replacing the unavailable `DayChart` component,
same visual language):
- Teal bars (`--pp-teal-700`) for consumption, one per interval.
- Green line trace (`--pp-green`) connecting production values, same
  x-axis, shared y-scale = `max(max(c), max(g))` so both series are
  comparable.
- Legend: teal swatch "Consumption", green line swatch "Production
  (on-site generation)".
- X-axis: hour gridlines/labels (00, 04, 08, 12, 16, 20).

### 4.5 Table

Scrollable region (sticky header, max-height ~420px) listing every interval
for the selected day:

| TIME | CONSUMPTION (kW) | PRODUCTION (kW) | NET (kW) | EPEX (€/kWh) |
|---|---|---|---|---|

- Zebra-striped rows (`--pp-surface-zebra`), matching portal convention.
- NET column colored: default heading color when ≥ 0 (importing), teal/cyan
  (`--pp-cyan`) when negative (exporting/surplus) — mirrors the "surplus"
  color convention from the mockup's block-cover legend.
- Numbers formatted NL-style (comma decimal separator, e.g. "612,4 kW",
  "0,0896") to match the rest of the portal's existing formatting
  convention — this differs from the plain-decimal example shown during
  brainstorming, called out here as the actual convention to implement.

### 4.6 Fonts

Font stack falls back to system sans-serif (`-apple-system,
BlinkMacSystemFont, 'Segoe UI', sans-serif`) if `Inter` isn't installed
locally, rather than embedding the ~280 KB of woff2 font blobs extracted
from the mockup — a deliberate size/simplicity trade-off, not a visual
requirement.

## 5. Edge cases

- **DST day (2026-03-29, 92 intervals):** chart and table both read array
  length from the data, not a hardcoded 96 — this day must render correctly
  with 4 fewer rows and no gaps/crashes.
- **Zero production (e.g. Venlo cold store, all dates):** shown as plain
  "0,0", not an em-dash — it's real generated data (a site with no on-site
  generation), not missing/no-data, and the portal's em-dash convention is
  reserved for actually-missing values.
- **Out-of-range date:** the date input's `min`/`max` prevents selection
  outside 2026-01-01…2026-08-05, so no fallback/error state is needed.

## 6. Documentation

`CLAUDE.md`'s repository contents table gets two new rows for
`generate_consumption_data.py` and `Customer Portal - Consumption (Live
Data).html` (and the intermediate `consumption_live_data.json` it embeds),
following the existing documentation convention for every file in this
repo.

## 7. Verification plan

- Open the generated HTML directly in a browser (no server) and confirm:
  no console errors, no network requests fire.
- Default view (Rotterdam DC, 2026-08-05) renders stat cards, chart, and a
  96-row table.
- Switching the connection dropdown and the date picker each independently
  update stat cards, chart, and table.
- Selecting 2026-03-29 (Rotterdam DC) renders a 92-row table without error.
- Cross-check one stat card manually: recompute total CONSUMPTION for one
  site/date in a throwaway Python snippet against the source combined JSON
  and confirm it matches the value shown on the page (validates the ×0.25h
  kWh conversion end-to-end).
- Confirm the final HTML file size is in the low single-digit MB (embedded
  JSON dominates) and opens promptly.

## 8. Deliverables

1. `generate_consumption_data.py` — data pipeline script.
2. `consumption_live_data.json` — generated compact data file (embedded
   into the HTML at build time, also kept on disk for inspection/reuse).
3. `Customer Portal - Consumption (Live Data).html` — the new page.
4. `CLAUDE.md` updated with the three new files.
