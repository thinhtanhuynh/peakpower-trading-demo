# CLAUDE.md

Project memory for `trading-poc` — read this before working in the folder.

## What this is

`trading-poc` is an early-stage proof-of-concept for **PeakPower**, an energy
trading platform. The folder currently holds three things:

1. **Two static HTML portal mockups** (self-contained, bundled preview
   pages — no build tooling, no source repo behind them yet). These stay
   pure design references — never hand-edit them.
2. **EPEX day-ahead tariff data plus generated large-consumer energy
   usage/production test data**, at 15-minute resolution, meant to back the
   *Prices* and *Consumption* screens of the Customer Portal mockup.
3. **A live, browser-calculated data-driven page** — `Customer Portal -
   Consumption (Live Data).html` — plus two pure JS modules,
   `consumption-calc.js` (stats/formatting) and `consumption-data-loader.js`
   (fetches and groups the raw source files), and their Node test suites
   (`consumption-calc.test.js`, `consumption-data-loader.test.js`). There is
   **no build step and no Python anywhere in this pipeline**: the page
   `fetch()`es `epex_tariffs_usage_combined_15_min_interval.json` and
   `hedge_blocks_2026.json` directly and does all grouping and calculation
   client-side, every time it loads — editing either source JSON file (e.g.
   adding a new hedge period) is picked up on the next page load with
   nothing to regenerate. Running the test suites only needs Node.js.

This folder is **Python-free by design** — there is no package.json either,
just two JS modules loaded straight into the browser via `<script src>`.
Because the page uses `fetch()`, it must be served over http(s) rather than
opened directly via `file://` (browsers block `fetch()` of local files) —
e.g. `npx http-server .` or `npx serve .` from this folder, then open the
page through that server's URL.

## Repository contents

| File | Size | What it is |
|---|---|---|
| `Customer Portal - Preview.html` | ~545 KB | Bundled static preview of the customer-facing portal |
| `Back Office Portal - Preview.html` | ~501 KB | Bundled static preview of the internal back-office portal |
| `EPEX tariffs 15 min interval.csv` | ~3.6 MB | Source EPEX day-ahead tariff export, 20,828 rows (15-min intervals) |
| `epex_tariffs_15_min_interval.json` | ~11.2 MB | Same tariff data as JSON (one object per row) |
| `epex_usage_15_min_interval.json` | ~66 MB | Generated consumption/production test data, 6 sites × 20,828 intervals = 124,968 rows |
| `epex_tariffs_usage_combined_15_min_interval.json` | ~75 MB | Tariff + usage merged into one record per site per interval, 124,968 rows. Fetched directly by the Consumption (Live Data) page at load time. |
| `hedge_blocks_2026.json` | ~16 KB | Test hedge/trade block data (Base & Peak shapes) per EAN — backs the hedge cost/coverage figures on the Consumption (Live Data) page (see below) and a future *Trading* screen — see "Hedge block test data" below. Hand-edited (no generator script); fetched directly by the Live Data page at load time. |
| `consumption-calc.js` | ~4 KB | Pure JS stat/formatting module used by the Consumption (Live Data) page (dual Node/browser module). Unit tested via `consumption-calc.test.js`. |
| `consumption-data-loader.js` | ~6 KB | Pure JS module that groups the two source JSON files above into the page's `{sites, byDate, bySite, hedge}` shape, plus a `fetch()`-based loader that runs the whole thing client-side on page load (dual Node/browser module). Unit tested via `consumption-data-loader.test.js`. |
| `Customer Portal - Consumption (Live Data).html` | ~31 KB | Standalone, hand-written page (loads `consumption-calc.js` and `consumption-data-loader.js` via `<script src>`) showing real 15-minute interval data for a selectable connection and date. Must be served over http(s), not opened via `file://`. |
| `PeakPowerTrading-CalculationSample.csv` | ~5 KB | Reference calculation sample (one day, 96 rows) the `consumption-calc.js` formulas (Usage Cost, Actual Usage, Base/Peak/Hedge Volume, Uncovered, Long, Short, Delta Cost) are validated against — see "Calculations" below. Not consumed by the page itself. |

The two large usage/combined JSON files are over the 30 MB chat-upload
limit — when regenerating and sending them through Claude, gzip first
(`gzip -9 -k file.json`) and unzip on arrival.

## Portal mockups

Both HTML files are single-file "bundled preview" exports (they reference
`PeakPowerDesignSystem_7164da.*` components via `x-import` tags and a small
custom templating runtime — not React/Vue source, just a rendered preview
bundle). Treat them as **design references**, not editable app code.

**Customer Portal** nav: `Dashboard, Connections, Consumption, Prices,
Trading, Wallet, Invoices`. "Connections" is where EANs (metering points)
get linked to the customer's account; "Consumption" and "Prices" are the
screens the generated test data below is meant to feed.

**Back Office Portal** nav: `Home, Trade desk, Customers, Wallets,
Invoicing, Data & feeds, Reference data, Audit`. Handles EAN
registration/resolution (matching incoming metering-point series against a
GLN/sender to a customer), customer management, wallet top-ups, and
invoicing.

## EPEX tariff data

Source file: `EPEX tariffs 15 min interval.csv` / `epex_tariffs_15_min_interval.json`.
20,828 rows, 2026-01-01 through 2026-08-05 (217 days), one row per 15-minute interval.

Fields: `id`, `day`, `day_of_week` (ISO: 1=Mon…7=Sun), `day_of_year`,
`delivery_day`, `epex` (EUR/kWh day-ahead price), `hour`, `hour_of_year`,
`is_dst`, `is_low_tariff_normal`, `is_low_tariff_south`, `month`,
`month_year`, `timestamp` (local delivery-interval start), `utctime`,
`year`, `hour_of_day` (1–24), `created_date`, `updated_date`, `isp`
(sequential 15-min slot number within the day, 1–96, DST days differ).

## Generated usage/production test data

`epex_usage_15_min_interval.json` and `epex_tariffs_usage_combined_15_min_interval.json`
carry every tariff-file field above **except** `epex`,
`is_low_tariff_normal`, `is_low_tariff_south` (combined file keeps those
too), plus:

- `EAN` — 18-digit metering-point code (NL grid-operator-style prefix
  `871687` + GS1 mod-10 check digit), one fixed EAN per organization.
- `organization_type` / `organization_name` — which site the row belongs to.
- `consumption` (kW) — average power draw during the interval.
- `production` (kW) — on-site generation during the interval (0 where none).

Data represents **6 large-consumer sites**, each with a distinct, realistic
load/generation shape rather than a generic profile. **EANs match the
`CONNECTIONS` list in `Customer Portal - Preview.html` exactly** (portal
EANs are stored there with spaces, e.g. `8716 8710 0000 0000 11`; the data
files store the same digits with no spaces, e.g. `871687100000000011`) so
that a future Connections/Consumption/Prices GUI can filter and chart
straight off these files by EAN:

| organization_type | EAN | Portal connection (id / name) | Profile |
|---|---|---|---|
| `data_centre` | 871687100000000011 | `rot` / Rotterdam DC | Near-flat 24/7 load ~2.4–2.6 MW, very low variance (redundant critical infra), slight summer cooling uptick. Small 300 kWp solar canopy. |
| `cold_store` | 871687100000000027 | `venlo` / Venlo cold store | Steady 24/7 refrigeration baseline ~450–650 kW (higher in summer from ambient heat load), plus 30-min defrost spikes (+150–220 kW) at 02:00/08:00/14:00/20:00. No on-site generation (roof used for cooling plant). |
| `logistics_hub` | 871687100000000043 | `tilburg` / Tilburg plant | Operating-hours load (05:00–23:00) ~500–650 kW, ~160 kW overnight. Large 700 kWp rooftop solar that can exceed the site's own daytime consumption on sunny days. |
| `office` | 871687100000000059 | `almere` / Almere office | **New 6th profile** (see below) — small office + server room. |
| `greenhouse` | 871687100000000061 | `unnamed` / — no name set — | Consumption driven by supplemental grow-lighting: target 18h photoperiod, ~850 kW lighting load switching on pre-dawn/post-dusk in low-daylight months, +110 kW baseline for climate control. **Production comes from CHP** (900 kW capacity) driven by heating demand, not sunlight — runs day *and* night, peaking in winter (~900 kW) and dropping in summer (~300–350 kW). |
| `manufacturer` | 871687100000000078 | `breda` / Breda warehouse | Two-shift weekday load ~1.6 MW (06:00–22:00), drops to ~420 kW overnight/weekend skeleton crew (~450 kW). Small 150 kWp rooftop solar. |

The portal's 7th connection, `tilburg-gas` (EAN `871687100000000092`,
Gas, "Not tradeable", no volume shown), intentionally has **no
corresponding usage rows** — it's a non-electricity, non-tradeable
connection in the mockup.

Mapping rationale: portal connection `description`/`name` fields were
matched to the closest existing profile (e.g. "Data centre — 3 halls" →
`data_centre`, "Freezer hall + dock 3 compressors" → `cold_store`,
"Logistics hub — 2 cold docks" → `logistics_hub`; Breda's 1.600 kW
contracted capacity lines up almost exactly with the manufacturer
profile's ~1.6 MW peak). `almere` ("Office + small server room", 800 kW
capacity) didn't fit any of the 5 original profiles, so it became a new
6th `office` profile. `unnamed` (no description) was assigned the
otherwise-unused `greenhouse` profile.

#### New `office` profile (Almere office)

Added to back the `almere` connection, generated with `random.Random(420608)`:

- Weekday business-hours load (~06:30 ramp-up, plateau 08:00–18:00,
  ~19:30 ramp-down) around 220–260 kW, with a +12 kW uptick in Jun/Jul/Aug
  for office AC.
- Off-hours/weekend baseline ~72–90 kW (small server room + standby
  systems running 24/7).
- Small 60 kWp rooftop solar array. Rather than re-deriving a separate
  weather/day-length model, production is scaled directly off the
  `logistics_hub` row for the same timestamp (`office = logistics_prod /
  700 kWp × 60 kWp`, plus small independent noise) — this keeps the new
  site's sunny/cloudy days consistent with the other solar sites without
  duplicating the irradiance model.

### Generation methodology / assumptions

- Deterministic, seeded random generation (`random.seed(42)` for
  consumption/production noise, a separate seeded RNG for EAN digits) so
  the dataset is reproducible.
- Solar-driven sites (manufacturer, data centre, logistics hub, plus the
  base tariff-independent EPEX curve) use a sinusoidal day-length model
  approximating ~52°N (Netherlands): day length ~8h at winter solstice to
  ~16.5h at summer solstice, sun-position irradiance curve within that
  window, zero production outside it.
- A single "weather" cloud factor per calendar day (`delivery_day`) is
  shared across all solar sites, drawn from a deterministic per-day RNG
  seeded on the date string — mimics regional weather without needing
  a real weather feed.
- Greenhouse CHP production is modeled separately from sunlight: a
  seasonal heating-demand factor (cosine curve, peak mid-January, trough
  mid-July) drives output, with ~6% of days having full CHP downtime
  (maintenance).
- No generation script for this data is checked into the repo (the
  Python used to produce/remap these files, including the original
  5-profile generator and the later `remap_eans.py` EAN/name remap, was
  run ad hoc in past Claude sessions and intentionally isn't kept — this
  folder is Python-free by design, see "What this is" above). If asked to
  regenerate or further extend the dataset (e.g. add a 7th site, change a
  profile, or extend the date range), rebuild the per-organization profile
  logic described above directly (in JS, or as a one-off ephemeral script
  that isn't checked in) rather than assuming an end-to-end generator
  exists here.

## Hedge block test data

`hedge_blocks_2026.json` is hand-maintained placeholder test data for a
future *Trading* screen: one row per EAN per shape per period, expressing
a hedge as a power (MW) held for a period, converted to energy (MWh) and
to kW/kWh equivalents. There is no generator script for this file (see
"What this is" above) — new rows are added directly to the JSON, matching
the schema and conversions documented below. The Consumption (Live Data)
page fetches this file directly and groups it by EAN client-side (see
`consumption-data-loader.js`'s `buildHedgeSection`), so any edit here
takes effect on the page's next load.

**Shapes:**
- `base` — held 24/7 across every day of the period.
- `peak` — held only Mon–Fri, 08:00–20:00, within the period.

**Conversion:** volume (MWh) = power (MW) × hours-in-period, where
hours-in-period is all wall-clock hours for `base` and only weekday
08:00–20:00 hours for `peak` (DST hour gain/loss is not currently
adjusted for — a simplification for this POC). `powerKw` / `volumeKwh` /
`priceKwh` are straight unit conversions (×1000 / ×1000 / ÷1000) of the
MW / MWh / €-per-MWh fields.

**Period fields** — the period is *not* a single free-text string; it's
an enum plus supporting fields, so MONTH/QUARTER/YEAR periods can all be
represented the same way:

| Field | Type | Notes |
|---|---|---|
| `periodType` | `"MONTH"` \| `"QUARTER"` \| `"YEAR"` | |
| `year` | number | always set |
| `month` | number (1–12) or `null` | set only when `periodType` is `MONTH` |
| `quarter` | number (1–4) or `null` | set only when `periodType` is `QUARTER` |
| `periodStart` / `periodEnd` | ISO date strings | inclusive first/last calendar day of the period |
| `periodLabel` | string | human-readable, matches the Customer Portal's existing block period style, e.g. `"Aug 2026"`, `"Q3 2026"`, `"2026"` |

The file currently contains three periods per EAN (36 rows total, 6 EANs ×
2 shapes × 3 periods):

| periodLabel | periodType | power (MW) base / peak | offered price (€/MWh) base / peak |
|---|---|---|---|
| `2026` (YEAR) | `YEAR` | 1.0 / 1.0 | 70.00 / 95.00 |
| `Q2 2026` (Apr–Jun) | `QUARTER` | 2.0 / 1.0 | 66.39 / 91.15 |
| `Jul 2026` | `MONTH` | 2.0 / 1.0 | 77.79 / 91.19 |

The original `YEAR`/`2026` row uses round placeholder numbers (€70/MWh
base, €95/MWh peak) so the volume math is easy to hand-verify; the `Q2
2026` and `Jul 2026` rows use a deliberately different base/peak power
split (2 MW base, 1 MW peak) and non-round prices to exercise the page's
handling of multiple simultaneously-active hedge periods per site with
differing shapes/prices. Adding another period (e.g. a `Q1 2027` row,
also referenced in the portal mockup's example trade blocks) means adding
6 EANs × 2 shapes = 12 more rows directly to the JSON, following the same
field shape and the volume conversion rules above. The gas connection
(`tilburg-gas`, EAN `871687100000000092`) is intentionally excluded —
"Not tradeable" in the portal mockup.

## Consumption (Live Data) page

`Customer Portal - Consumption (Live Data).html` is a standalone companion
to the Customer Portal mockup's *Consumption* screen — instead of the
mockup's seeded placeholder data, it reads real 15-minute
consumption/production/EPEX data straight from
`epex_tariffs_usage_combined_15_min_interval.json` for a connection and
date picked from dropdowns (all 6 electricity sites; any date 2026-01-01
through 2026-08-05), plus a **Day / Month** chart toggle (below). It
doesn't modify or depend on `Customer Portal - Preview.html` — that file
stays a pure design mockup.

**Scope:** Day and Month views (no Quarter view). `tilburg-gas` is
excluded — it has no usage rows and no hedge rows.

**Loading (fully client-side, no build step):** the page loads
`consumption-calc.js` and `consumption-data-loader.js` via `<script src>`,
then calls `ConsumptionDataLoader.loadConsumptionData()` on page load. That
function `fetch()`es `epex_tariffs_usage_combined_15_min_interval.json`
and `hedge_blocks_2026.json`, and groups them in the browser into the same
`{sites, byDate, bySite, hedge}` shape a Python pre-pass used to produce
ahead of time:

```jsonc
{
  "sites": [{ "id": "rot", "ean": "871687100000000011", "name": "Rotterdam DC" }, "... 6 total"],
  "byDate": { "2026-01-01": { "t": ["00:00", "..."], "p": [0.0896, "..."] }, "... 217 dates" },
  "bySite": { "rot": { "2026-01-01": { "c": [612.4, "..."], "g": [0.0, "..."] } }, "... 6 sites" },
  "hedge": { "rot": [{ "shape": "base", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.07 }, "... 6 blocks per site across YEAR/QUARTER/MONTH periods"], "... 6 sites" }
}
```

`byDate[date].t`/`.p` (local time-of-day, EPEX €/kWh) are stored once per
date and shared across sites; `bySite[id][date].c`/`.g` are per-site
consumption/production (kW), index-aligned with `byDate[date].t`. Array
length is 96 every day except 2026-03-29 (the spring-forward DST day),
which has 92. `hedge[id]` is a list of hedge blocks grouped straight from
`hedge_blocks_2026.json` (kept generic — period start/end per block — so
any mix of YEAR/QUARTER/MONTH hedge rows is picked up with no code
change). Because nothing is pre-baked, editing either source JSON file
(e.g. adding a new hedge period, or regenerating the usage dataset) takes
effect the next time the page is loaded — there's no regeneration step to
remember to run. The page shows a "Loading live data…" state (controls
disabled) until both fetches resolve, and an inline error card if a fetch
fails — most commonly because the page was opened via `file://` instead
of a local http(s) server (see "What this is" above).

**Calculations** (`consumption-calc.js`, unit tested via
`consumption-calc.test.js` against real rows from
`PeakPowerTrading-CalculationSample.csv`), per 15-minute interval — energy
values are converted from the source's kW to kWh (`× 0.25 h`) internally,
then everything below follows the sample column-for-column:

- **TUF** / **FDF** — small fixed grid fees layered on top of EPEX, not
  present in any source data file. Held constant across all sites for this
  POC: `ConsumptionCalc.DEFAULT_TUF = 0.01 €/kWh` (added when buying),
  `DEFAULT_FDF = 0.005 €/kWh` (added when feeding production into the
  grid). Both `computeIntervalRow`/`computeIntervalSeries`/`computeDayStats`
  accept optional `tuf`/`fdf` overrides for future per-site values.
- **Usage Cost** = `Consumption×(EPEX+TUF) − Production×(EPEX+FDF)` — the
  retail cost of the site's own metered flow, independent of the hedge.
- **Actual Usage** = `Consumption − Production` — can go negative on a
  solar/CHP-heavy interval where production exceeds consumption (a real,
  common case — e.g. `tilburg`'s midday solar output, not just a
  theoretical edge case).
- **Base Volume** / **Peak Volume** — summed separately across all
  simultaneously-active hedge blocks of each shape (`powerKw × 0.25` per
  block); a `peak` block only counts toward Peak Volume when the weekday is
  Mon–Fri **and** the time is 08:00 through 20:00 **inclusive of both
  endpoints** (the 20:00 interval is still peak, 20:15 is not — confirmed
  against the reference sample).
- **Hedge Volume** = Base Volume + Peak Volume.
- **Uncovered** = Actual Usage − Hedge Volume.
- **Long** = `max(0, −Uncovered)` — over-hedged; the unused hedge volume is
  effectively sold at spot. **Short** = `max(0, Uncovered)` — under-hedged;
  the shortfall must be bought at spot.
- **Delta Cost** (the key P&L figure — negative means revenue/savings,
  positive means additional cost):
  ```
  Delta Cost = Actual Usage < 0
    ? Usage Cost − (Hedge Volume × EPEX)      // net export: hedge unneeded, fully sold at spot
    : EPEX × (Actual Usage − Hedge Volume)    // covers both over- and under-hedged cases
  ```
  Delta Cost is computed from full-precision intermediate values (not the
  rounded, displayed Usage Cost), matching the reference sample exactly.

Note the fixed hedge contract price (`priceKwh` in `hedge_blocks_2026.json`)
does **not** appear in any of these formulas — Delta Cost measures the P&L
of the position against EPEX spot, not the hedge's own locked-in price.
Numbers display NL-style (comma decimal, period thousands separator).

**Stat cards:** deliberately trimmed to the trading-desk figures rather than
every column — Actual Usage, Long, Short, Base Volume, Peak Volume, Hedge
Volume, and total Delta Cost (day/month total, tone-colored: red when it's
an additional cost, green when it's savings/revenue). Consumption,
Production, Peak demand, Usage Cost, and Uncovered remain visible in the
table but are no longer surfaced as their own cards.

**Chart (Day and Month):** two lines — actual usage (solid teal) and hedge
volume (dashed indigo) — with the gap between them filled by one bar per
interval: orange (55% opacity) when Uncovered ≥ 0 ("Short — bought at
day-ahead"), cyan (30% opacity) when Uncovered < 0 ("Long — sold at
day-ahead") — the same color convention as the original Customer Portal
mockup's Day-tab legend. Consumption and production are no longer plotted;
the y-axis is bipolar (a proper zero baseline, not always at the bottom) to
correctly show intervals where Actual Usage goes negative.

**Hover vs. click:** hovering the chart shows a tooltip with just Actual
Usage, Long, Short, and Delta Cost for that interval (the rest of the
columns are available in the table below) plus a crosshair — it no longer
scrolls the table. Clicking the chart highlights and scrolls to that
interval's row instead; the selection persists until the next click or
until the view changes (switching site/date/month clears it). One shared
interaction function drives both
Day and Month charts, using a cursor-position → nearest-interval-index
calculation (not per-mark listeners), so it scales to the Month view's
~2,976 points.

**Table:** a Date column (short format, e.g. "5 Aug 2026") is the first
column in both Day and Month modes — in Day mode every row repeats the
same date; in Month mode it's what actually disambiguates the repeating
`HH:MM` values across days.

**Month view:** a second chart type (line + bars, not bars alone) plotting
every interval of a selected month in one horizontally-scrollable chart;
the month dropdown is derived from the data's actual coverage, so the
trailing partial month (August 2026, only 5 days) renders correctly with
no special-casing. The table below follows whichever mode (Day/Month) is
active.

**Running / testing:** there's nothing to regenerate. Serve this folder
over http(s) (e.g. `npx http-server .` or `npx serve .`) and open the page
through that server's URL — opening the HTML file directly via `file://`
will fail to load data, since browsers block `fetch()` of local files that
way. `node consumption-calc.test.js` and `node consumption-data-loader.test.js`
unit-test the two JS modules against fixture rows (grouping-by-site,
sorting-by-isp, rounding, hedge-block filtering/blending, multi-period
hedge stacking, etc.) without needing to fetch the real multi-MB source
files.

## Conventions

- Timestamps are local Netherlands delivery time in `timestamp`, UTC in
  `utctime`; `is_dst` flags summer-time intervals.
- All power values are **kW** (instantaneous average over the 15-min
  interval), not kWh.
- File naming is snake_case for generated JSON, but the two original
  source files (`EPEX tariffs 15 min interval.csv`, one JSON export) kept
  their original human-readable / snake_case names as first delivered —
  no strict convention enforced yet across the two source files.
- This folder intentionally contains **no Python files and no build
  step**. All data grouping and calculation for the Consumption (Live
  Data) page happens client-side in `consumption-calc.js` and
  `consumption-data-loader.js` when the page loads. If a task would
  otherwise call for a `.py` script (e.g. reshaping data, generating a new
  test dataset), prefer a JS solution — a dual Node/browser module if it's
  needed by the page, or a one-off ephemeral script (not checked in) if
  it's a pure data-prep task like the hedge/EAN generation described
  above.
