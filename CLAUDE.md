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
3. **A live, browser-calculated, multi-page customer portal** — `Customer
   Portal - Consumption (Live Data).html` — plus three pure JS modules,
   `consumption-calc.js` (stats/formatting), `consumption-data-loader.js`
   (fetches and groups the raw source files), and `portal-seed-data.js`
   (static seed/mock data for the screens that have no live backend), and
   Node test suites for the first two (`consumption-calc.test.js`,
   `consumption-data-loader.test.js`). Despite the filename (kept from when
   it only covered Consumption), this page is now the **functional stand-in
   for the whole `Customer Portal - Preview.html` mockup**: a working
   sidebar switches between native Dashboard/Connections/Consumption/
   Prices/Trading/Wallet/Invoices sections in one page (no iframe, no
   separate HTML files) — see "Customer Portal (Live Data) page" below for
   how each section sources its data. There is **no build step and no
   Python anywhere in this pipeline**: the page `fetch()`es
   `epex_tariffs_usage_combined_15_min_interval.json` and
   `hedge_blocks_2026.json` directly and does all grouping and calculation
   client-side, every time it loads — editing either source JSON file (e.g.
   adding a new hedge period) is picked up on the next page load with
   nothing to regenerate. Running the test suites only needs Node.js.

This folder is **Python-free by design** — there is no package.json either,
just three JS modules loaded straight into the browser via `<script src>`.
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
| `consumption-calc.js` | ~8 KB | Pure JS stat/formatting module used by the Consumption (Live Data) page (dual Node/browser module). Unit tested via `consumption-calc.test.js`. |
| `consumption-data-loader.js` | ~6 KB | Pure JS module that groups the two source JSON files above into the page's `{sites, byDate, bySite, hedge}` shape, plus a `fetch()`-based loader that runs the whole thing client-side on page load (dual Node/browser module). Unit tested via `consumption-data-loader.test.js`. |
| `portal-seed-data.js` | ~28 KB | Pure JS module (dual Node/browser) holding static seed/mock data ported from `Customer Portal - Preview.html` for the screens that have no live data source in this POC — Connections' descriptive metadata, Dashboard tiles/activity, Wallet ledger/top-ups (plus a `simulateTopup()` pure function), and Invoices. Not unit tested (no calculation logic, just data + one small formatter/simulator). |
| `Customer Portal - Consumption (Live Data).html` | ~108 KB | Standalone, hand-written multi-page portal (loads `consumption-calc.js`, `consumption-data-loader.js`, and `portal-seed-data.js` via `<script src>`) with a working Dashboard/Connections/Consumption/Prices/Trading/Wallet/Invoices sidebar — see "Customer Portal (Live Data) page" below. Must be served over http(s), not opened via `file://`. |
| `PeakPowerTrading-CalculationSample.csv` | ~8 KB | Reference calculation sample (one day, 96 rows) the `consumption-calc.js` formulas (Usage Cost, Actual Usage, Base/Peak/Hedge Volume, Uncovered, Long, Short, Delta Cost, Hedge Cost, Total Cost) are validated against — see "Calculations" below. Negative numbers are written in accounting parentheses, e.g. `(70)`, and `-` means zero/absent. Its hedge blocks are unpriced, so its Hedge Cost column is 0 throughout and Total Cost equals Delta Cost. Not consumed by the page itself. |

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

## Customer Portal (Live Data) page

`Customer Portal - Consumption (Live Data).html` started as a standalone
companion to just the Customer Portal mockup's *Consumption* screen, but is
now a full **native, functional rebuild of the whole Customer Portal
mockup's navigation** — Dashboard, Connections, Consumption, Prices,
Trading, Wallet, and Invoices are all real sections of this one page, with
a working sidebar (`goTo(page)` toggles `.page` containers and the active
nav link, no iframe, no separate HTML files per screen). It doesn't modify
or depend on `Customer Portal - Preview.html` — that file stays a pure
design mockup, read only for markup/data/CSS-token reference when this
page was built.

### Multi-page shell & per-screen data sources

Consumption is the only screen backed by real, calculated data (see
below, unchanged). The other six screens are a **faithful, verbatim port
of `Customer Portal - Preview.html`'s own CSS design tokens, layout, and
state machine** — that mockup is itself a static seeded demo (every one of
these six screens renders from hardcoded JS arrays/objects, not live
data), so matching it means matching its copy, numbers, and interaction
model exactly rather than deriving them from `hedge_blocks_2026.json` or
the real consumption dataset (an earlier design of this page did that;
it's superseded per explicit product direction to prioritize visual/
functional fidelity to the mockup for these six screens):

| Screen | Data source | Sub-views |
|---|---|---|
| **Dashboard** | `portal-seed-data.js` (`DASHBOARD_PRICE_TILES`, `DASHBOARD_RECENT_ACTIVITY`) + live wallet balance + a live mini chart | Single view. Balance/coverage/uncovered-volume/open-trades stat cards, an amber "offer received" banner for the one pending trade (`TRD-1078`) linking to its Trading detail, indicative price tiles, and a "latest day" mini chart that reuses real Rotterdam DC data via a dedicated `buildMiniChartSvg()` (kept separate from the Day chart's `buildChartSvg()` so the two `<svg>`s don't collide on the `#chart-crosshair` id or clobber each other's hover geometry). |
| **Connections** | `portal-seed-data.js` (`CONNECTIONS`) | **list** / **detail** (`state.connId`). List is a CSS-grid table with status badges and a coverage bar; detail shows editable-looking name/description fields, connection facts, a 14-day data-quality grid, and any block positions (each linking to its Trading detail). |
| **Consumption** | Fully real, unchanged from before — see below | Single view, filtered by an arbitrary From/To date range with Day/Month/Quarter presets and CSV export (see "Scope" and "Date-range filter" below). |
| **Prices** | `portal-seed-data.js` (`PRICES`) | Single view. Six indicative Base/Peak price cards (month/quarter/calendar-year) each with a "Request a price →" link that jumps straight into the Trading wizard (`startWizardFromPrice`), plus a synthetic 90-day trend chart. |
| **Trading** | `portal-seed-data.js` (`TRADES_SEED`, `WIZARD_CONNECTIONS`, `WIZARD_PERIODS`, `WIZARD_YEAR`) + in-memory `state.trades` | **list** / **detail** (`state.tradeId`) / **wizard** (`state.wizardStep` 0–2), via `state.tradingView`. Detail shows a dark firm-offer banner with a live mm:ss countdown for the one pending trade, a timeline of `events`, and `facts`/`linked` records. The 3-step wizard (product & period → volume per connection → review & submit) mirrors the mockup's flow, including its bar-chart period picker, a wallet-balance-sufficiency check gating step 2, and `submitWizard()` prepending a new `TRD-1079`-style row to the list — a real, working feature (not a stub), though it still hardcodes "Q1 2027" / "1,000 MW" for the submitted trade exactly like the mockup does. |
| **Wallet** | `portal-seed-data.js` (`WALLET_LEDGER`, `TOPUPS`, `BANK_DETAILS`) + in-memory `state.walletAvailable/Settled/Reserved` | **ledger** / **topup**, via `state.walletView`. Ledger is a stat-card row + full CSS-grid ledger table (trade/invoice references are clickable links into those screens' detail views). Top-up view has a working iDEAL amount input + preset chips + bank-transfer details; `performTopup()` mutates the in-memory balances and prepends a ledger + top-up-history row, matching the mockup's `performTopup()` transition — genuinely interactive, just not persisted across a page reload. |
| **Invoices** | `portal-seed-data.js` (`INVOICES`) | **list** / **detail** (`state.invoiceId`). Detail shows stat cards, a provisional-data banner where applicable, and a full line-item CSS-grid table with a volume-check/reconciliation footer. Static, ported line-for-line from the mockup; no live invoice generation exists in this POC. |

All six screens' "tables" are `display:grid` divs (`.grid-table`/`.gt-head`/
`.gt-row`, explicit per-screen `grid-template-columns`) rather than
`<table>` elements, matching the mockup's own markup — Consumption's own
real `<table>` is unchanged.

The mockup uses **two table densities**, and the rebuild mirrors that with a
`.dense` modifier on `.grid-table`:

| | head | row | gap | used by |
|---|---|---|---|---|
| default | `10px 16px` @10.5px | `13px 16px` @12.5px | 14px | top-level list tables: Connections, Trading, Invoices |
| `.dense` | `9px 12px` @10px | `11px 12px` @12px | 10px | tables nested inside a card: Wallet ledger & top-ups, invoice line items, connection block positions, wizard volumes |

Per-screen `grid-template-columns` are copied from the mockup verbatim (e.g.
Wallet ledger `0.9fr 1fr 1.8fr 1fr 1fr 0.8fr 0.8fr 1fr`, invoice line items
`0.3fr 2.6fr 1fr 1fr 1fr 1fr`) — don't "tidy" these into round numbers.

### Vertical spacing between sections — a footgun

`.page` is a flex column with `gap:16px`, but **only Consumption puts its
sections directly in `.page`**. The other six render everything into a single
`#<name>-body` wrapper, so `.page` has exactly one child and its gap applies
to nothing. Those wrappers therefore carry the gap themselves:

```css
#dashboard-body, #connections-body, #prices-body,
#trading-body, #wallet-body, #invoices-body { display:flex; flex-direction:column; gap:16px; }
#dashboard-body { gap:20px; }   /* the one screen the mockup spaces at 20px */
```

If a new screen renders into its own `-body` wrapper, add it to that list or
its sections will stack flush against each other. Setting the gap on `.page`
alone silently does nothing for these six. Detail sub-views (connection,
trade, invoice, wallet top-up) render into the same wrapper, so they inherit
it automatically.

### Design-system fidelity

`Customer Portal - Preview.html`'s `:root` defines **only color tokens** (36
of them) — no spacing/radius/typography scale. The rebuild's `--space-*`,
`--radius-*`, `--text-*` tokens are its own addition; all 36 shared **color**
tokens match the mockup exactly, so don't "fix" a color by hand.

The mockup's real component styles live in a gzip+base64 blob inside the
preview file (`PeakPowerDesignSystem_7164da`), not in its markup, so inline
`style=` attributes alone don't tell you what a `Card` or `Badge` looks like.
The rebuild's shared primitives are matched to that bundle:

- **Card** — `padding:18px 20px`, title `13.5px/700`, subtitle `11.5px` with
  `margin-bottom:14px` and no `margin-top`.
- **StatCard** — `padding:14px 16px`, `min-width:160px`, label `11px/600`
  `letter-spacing:.04em`, value `23px/700` `margin-top:8px`, sublabel `11px`
  faint `margin-top:6px`.
- **Badge** — `11px/600`, `padding:4px 12px`, pill radius, `line-height:1.2`,
  **no letter-spacing**, and every tone carries a real 1px border.
- **Button** — `13px/600`, `padding:10px 20px` (`.btn-sm` → `7px 14px`/12px),
  `border:1px solid` on *every* variant so primary and secondary are the same
  height. Primary is teal-600 on teal-600 with white text.

Two deliberate divergences, both to protect Consumption (which shares these
classes):

1. The design system's StatCard `critical` tone is **orange** (Dashboard's
   "Uncovered volume"). Consumption's Delta/Total cost cards need red, so
   they use a rebuild-only `.negative` tone and `.critical` stays DS-faithful.
2. `.stat-row` keeps a 16px gap; the mockup is internally inconsistent here
   (16/14/12px across screens), so there's no single correct value to match.

Note the design system already defines `.btn-ghost` (a transparent underlined
link for the dark firm-offer banner) — don't redefine that name for a
light-background button. The state machine (`state` object plus
`goTo`/`openConnection`/`openTrade`/`startWizard`/`topUpWallet`/
`performTopup`/`openInvoice`/etc. transition functions, all exposed via a
`window.PP` object so generated HTML can wire up `onclick`/`onchange`
handlers directly) and the CSS design tokens (`--pp-*`/`--text-*`/
`--space-*`/`--radius-*` custom properties) are ported verbatim from
`Customer Portal - Preview.html`'s bundled source. A `setInterval` ticks
the one pending trade's countdown once a second; the ring itself is
simplified to plain mm:ss text rather than an SVG ring, given this is a
POC.

**Scope:** the Consumption screen filters by an arbitrary **From/To date
range** (see "Date-range filter" below); the old fixed Day / Month mode
toggle is gone. `tilburg-gas` is excluded everywhere real usage data is
used — it has no usage rows (the seeded `CONNECTIONS` list still includes
it, marked `notTradeable`, matching the mockup).

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

- **Usage Cost** = `(Consumption − Production) × EPEX` — i.e. Actual Usage
  valued at spot; the cost of the site's own metered flow, independent of
  the hedge. There are **no grid fees in this model**: an earlier version
  layered fixed TUF/FDF fees on top of EPEX, but those were removed (along
  with the `DEFAULT_TUF`/`DEFAULT_FDF` constants and the optional
  `tuf`/`fdf` params) — every cost figure is now pure EPEX-based.
- **Actual Usage** = `Consumption − Production` — can go negative on a
  solar/CHP-heavy interval where production exceeds consumption (a real,
  common case — e.g. `tilburg`'s midday solar output, not just a
  theoretical edge case).
- **Base Volume** / **Peak Volume** — summed separately across all
  simultaneously-active hedge blocks of each shape (`powerKw × 0.25` per
  block); a `peak` block only counts toward Peak Volume when the weekday is
  Mon–Fri **and** the time is **08:15 through 20:00 inclusive**. Each
  interval's timestamp marks the *end* of its 15-minute window (e.g. "08:00"
  covers 07:45–08:00), so "08:00" itself is still before the block starts
  and is excluded; "08:15" (covering 08:00–08:15, the first window actually
  inside the block) is the first peak interval, and "20:00" (covering
  19:45–20:00) is still peak while "20:15" is not.
  `PeakPowerTrading-CalculationSample.csv` follows this same convention (its
  "8:00" row has no peak volume; "8:15" is the first peak interval) — an
  earlier revision of that file assumed a start-of-interval convention, and
  the code intentionally diverged from it until the sample was corrected.
- **Hedge Volume** = Base Volume + Peak Volume.
- **Uncovered** = Actual Usage − Hedge Volume.
- **Long** = `max(0, −Uncovered)` — over-hedged; the unused hedge volume is
  effectively sold at spot. **Short** = `max(0, Uncovered)` — under-hedged;
  the shortfall must be bought at spot.
- **Delta Cost** = `Uncovered × EPEX` — the spot P&L of the unhedged gap
  (negative means revenue/savings, positive means additional cost). This
  single expression covers over-hedged, under-hedged, **and** net-export
  intervals; an earlier version special-cased `Actual Usage < 0` with a
  separate `Usage Cost − Hedge Volume × EPEX` branch, which no longer
  exists. Computed from full-precision intermediates (not the rounded,
  displayed values), matching the reference sample exactly.
- **Hedge Cost** = `Base Volume × base block price/kWh + Peak Volume ×
  peak block price/kWh` — what the hedge itself costs at its locked-in
  contract price. Each active block is priced at its **own** `priceKwh`
  (from `hedge_blocks_2026.json`) and summed, so stacked blocks of the
  same shape at different prices are handled correctly.
- **Total Cost** = Delta Cost + Hedge Cost — the all-in figure.

`priceKwh` therefore feeds **only** Hedge Cost (and through it Total
Cost); Delta Cost still measures the position against EPEX spot alone.
Numbers display NL-style (comma decimal, period thousands separator).

**Stat cards:** deliberately trimmed to the trading-desk figures rather than
every column, and split across **two rows** — four volume figures (Actual
Usage, Long, Short, Hedge Volume) on the first, the three cost figures
(Delta Cost, Hedge Cost, Total Cost) grouped together on their own line
below. All are totals over the selected date range.

Card tones deliberately mirror the chart's own colors so the two read as
one system: **Long** uses the `.export` tone (`--pp-cyan`) and **Short**
the `.short` tone (`--pp-orange`), matching the cyan "sold at day-ahead"
and orange "bought at day-ahead" bar segments. Delta and Total Cost are
red when it's an additional cost, green when it's savings/revenue.

The `#stat-row` element is a `.stat-stack` flex column wrapping two
`.stat-row` divs — loading/no-data/error placeholders go through
`statusCardHtml()` so they keep the same wrapper. Base Volume and Peak
Volume no longer have their own cards (Hedge Volume already totals them),
and Consumption, Production, Peak demand, Usage Cost, and Uncovered are
likewise table-only — all six remain columns in the table and in the CSV
export.

**Chart (both single-day and multi-day):** two lines — actual usage (solid teal) and hedge
volume (dashed indigo) — with each interval rendered as a stacked bar from
the zero baseline: a light-yellow segment (20% opacity, deliberately muted
so it doesn't compete with the Short/Long segment above it) from zero up
to `MIN(Actual Usage, Hedge Volume)` — the portion of usage already covered
by the hedge — topped by the existing orange/cyan segment spanning the gap
between the two lines: orange (55% opacity) when Uncovered ≥ 0 ("Short —
bought at day-ahead"), cyan (30% opacity) when Uncovered < 0 ("Long — sold
at day-ahead") — the same color convention as the original Customer Portal
mockup's Day-tab legend. Consumption and production are no longer plotted;
the y-axis is bipolar (a proper zero baseline, not always at the bottom) to
correctly show intervals where Actual Usage goes negative.

**Hover vs. click:** hovering the chart shows a tooltip with just Actual
Usage, Long, Short, Delta Cost, Hedge Cost, and Total Cost for that
interval (the rest of the columns are available in the table below) plus a
crosshair — it no longer scrolls the table. Long and Short rows are
**omitted when their value is 0**: they're mutually exclusive per interval,
so at most one of the two ever appears. Clicking the chart highlights and scrolls to that
interval's row instead; the selection persists until the next click or
until the view changes (switching site or either date clears it). One
shared interaction function drives both charts, using a cursor-position →
nearest-interval-index calculation (not per-mark listeners), so it scales
to a wide range's interval count (a full quarter is ~8,700 points).

**Table:** a Date column (short format, e.g. "5 Aug 2026") is the first
column — on a single-day range every row repeats the same date; on a
multi-day range it's what disambiguates the repeating `HH:MM` values
across days.

**Date-range filter:** the controls row holds the site dropdown, a
**From** and a **To** `<input type="date">`, three **Day / Month /
Quarter** preset buttons, and an **Export CSV** button. From/To are the
single source of truth for everything rendered (stat cards, chart, table,
export); the presets are one-shot actions, not modes — each snaps the
range to the day, month, or quarter **containing the current To date**
(the anchor), clamped to the dataset's coverage, after which either date
can be edited freely to widen or narrow the range. A preset button
highlights only while the range happens to match it exactly, so a custom
range leaves all three unhighlighted. Both inputs' `min`/`max` come from
the data's actual coverage. A reversed range (From after To) is treated
as empty and says so, rather than being silently swapped — the inputs
always reflect what's on screen.

Chart selection follows the range's **day count**, not a mode flag: a
single day renders the fixed-width chart with time-of-day labels; any
multi-day range renders the horizontally-scrollable chart (line + bars)
with per-day gridlines and day-of-month labels. Because the range is
derived from the dataset's own dates, a partial trailing month (August
2026, only 5 days) needs no special-casing.

**CSV export:** the `Export CSV` button uses the ported design system's
`.btn-primary` class (green teal-600 fill, white text — the same primary
button the rest of the portal uses) rather than a bespoke style. It writes
exactly the table's 16
columns, in the table's own order, and every row of the current range —
the full filtered dataset, not just what's on screen — named
`consumption_<siteId>_<from>[_to_<to>].csv`. Values are written
**unformatted** — dot decimal, no thousands separators, rounded to 6
decimals — rather than in the NL display format, so the file parses in a
spreadsheet regardless of locale; a UTF-8 BOM is prepended so Excel
detects the encoding. `CSV_COLUMNS` in the page is the single list
driving the export, so a new table column means adding one entry there
(the `<thead>` markup is still separate — keep the two in sync). The
button is disabled whenever the range is empty.

**Running / testing:** there's nothing to regenerate. Serve this folder
over http(s) (e.g. `npx http-server .` or `npx serve .`) and open the page
through that server's URL — opening the HTML file directly via `file://`
will fail to load data, since browsers block `fetch()` of local files that
way. `node consumption-calc.test.js` and `node consumption-data-loader.test.js`
unit-test the two JS modules against fixture rows (grouping-by-site,
sorting-by-isp, rounding, hedge-block filtering/blending, multi-period
hedge stacking, etc.) without needing to fetch the real multi-MB source
files. `portal-seed-data.js` has no dedicated test suite (no calculation
logic to validate — it's ported static data plus one pure `simulateTopup()`
helper); the whole page's navigation (all 7 tabs, plus row-click detail
panels on Connections/Trading/Invoices and the Wallet top-up flow) has been
verified with a one-off jsdom + `http.server` smoke test rather than a
checked-in suite — re-run a similar script after changing the page shell
if in doubt, since there's no automated regression coverage for the
sidebar/page-switching logic itself.

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
