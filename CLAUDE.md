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
   Python anywhere in this pipeline**, and all calculation still happens
   client-side on every load. One thing did change when the site was
   published: the page used to `fetch()` the 75 MB
   `epex_tariffs_usage_combined_15_min_interval.json` and group it in the
   browser, which is fine locally but not over the public internet, so it
   now fetches **`consumption_compact_2026.json`** — the same grouped
   structure, pre-computed once (1.6 MB, ~420 KB gzipped). See
   "Regenerating consumption_compact_2026.json" below: this is the one
   artifact that must be rebuilt if the usage dataset changes.
   `hedge_blocks_2026.json` is deliberately **not** pre-computed — it is
   still fetched and grouped live, so editing a hedge period is still
   picked up on the next page load with nothing to regenerate. Running the
   test suites only needs Node.js.

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
| `usage-projection.js` | ~4 KB | Pure JS module (dual Node/browser) that projects a site's usage forward past the dataset's coverage, by averaging its own real consumption/production per time-of-day, weekday vs weekend, across all 217 measured days. Deliberately **not** seasonally adjusted — the data stops in August, so a November date has no same-month history; that limit is surfaced in the UI label, not just a comment. Unit tested via `usage-projection.test.js`. |
| `portal-seed-data.js` | ~28 KB | Pure JS module (dual Node/browser) holding static seed/mock data ported from `Customer Portal - Preview.html` for the screens that have no live data source in this POC — Connections' descriptive metadata, Dashboard tiles/activity, Wallet ledger/top-ups (plus a `simulateTopup()` pure function), and Invoices. Not unit tested (no calculation logic, just data + one small formatter/simulator). |
| `portal-terms-link.js` | ~9 KB | Pure JS module (dual Node/browser) carrying the **deposit percentage** the other way — Back Office sets it, Customer Portal obeys it — plus all the settlement maths (deposit/balance split, due date, overdue state). Unit tested via `portal-terms-link.test.js`. See "Deposit on a bought block" below. |
| `portal-trade-link.js` | ~17 KB | Pure JS module (dual Node/browser) carrying trades both ways between the Customer Portal and the Back Office Trade desk over `localStorage` — request out, priced offer back — see "Cross-portal trade requests" below. Unit tested via `portal-trade-link.test.js`. |
| `back-office-desk-data.js` | ~6 KB | Pure JS module (dual Node/browser): the Back Office mockup's own seeded `TRADES`/`QUEUE_META` ported verbatim, plus `buildQueues()`, which merges live Customer Portal requests into the seeded columns. |
| `customer-portal.html` | ~108 KB | Standalone, hand-written multi-page portal (loads `consumption-calc.js`, `consumption-data-loader.js`, `portal-seed-data.js`, `portal-trade-link.js` and `portal-terms-link.js` via `<script src>`) with a working Dashboard/Connections/Consumption/Prices/Trading/Wallet/Invoices sidebar — see "Customer Portal (Live Data) page" below. Must be served over http(s), not opened via `file://`. |
| `back-office-screens-data.js` | ~25 KB | Pure JS module (dual Node/browser): the Back Office mockup's own seeded data for **Home, Customers, Wallets, Invoicing and Data & feeds**, ported verbatim, plus the small `build*` helpers its `renderVals()` applies. `TAG_STYLE` is taken from `back-office-desk-data.js` rather than duplicated. |
| `back-office-portal.html` | ~82 KB | Functional stand-in for the **whole** Back Office mockup (loads `portal-trade-link.js`, `portal-terms-link.js`, `back-office-desk-data.js` and `back-office-screens-data.js`). Despite the filename, all six of the mockup's real screens are here — Home, Trade desk, Customers, Wallets, Invoicing and Data & feeds — with `Reference data` and `Audit` left as the mockup's own placeholder. Only the **Trade desk** is backed by live data (the cross-portal trade flow); Customers and Wallets are seeded but carry two live additions (the editable deposit % and outstanding balances — see "Deposit on a bought block"); the rest clone the mockup's static seeded screens. Also needs http(s). |
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

`customer-portal.html` started as a standalone
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
| **Trading** | `portal-seed-data.js` (`TRADES_SEED`, `WIZARD_CONNECTIONS`, `WIZARD_PERIODS`, `WIZARD_YEAR`) + in-memory `state.trades` | **list** / **detail** (`state.tradeId`) / **wizard** (`state.wizardStep` 0–2), via `state.tradingView`. Detail shows a dark firm-offer banner with a live mm:ss countdown for the one pending trade, a timeline of `events`, and `facts`/`linked` records. The 3-step wizard (product & period → **connection & volume** → review & submit) mirrors the mockup's flow, including its bar-chart period picker and a wallet-balance-sufficiency check gating step 2; `submitWizard()` publishes the wizard's real selections (see "Cross-portal trade flow") and prepends a new `TRD-1079`-style row. See "One block, one connection" below for how step 2 diverges from the mockup. |
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

### One block, one connection (trading wizard, step 2)

A block is traded against **exactly one** EAN/connection, which is a deliberate
divergence from the mockup (whose step 2 offers a volume field on every row and
splits one request across connections). Step 2 is therefore a **radio picker**
plus a single volume field:

- `state.wizard` carries `connId` + `volumeMw` rather than a `volumes` map.
  `PortalTradeLink.buildRequest()` still takes the map, so `wizardVolumes()`
  derives a one-entry map at submit time — the link module needed no change,
  and a published request simply has `connections.length === 1`.
- Volume is a real `<input type="number">` with `min="0.1" step="0.1"`.
  **Minimum 0,1 MW, in multiples of 0,1 MW**; `commitWizardVolume()` snaps to
  that grid on blur, `wizardVolumeValid()` gates the Continue button.
- Ineligible connections (`notEligible`, e.g. Breda's expiring contract) get no
  radio, and `setWizardConnection()` refuses them — the guard is in the handler,
  not only in the markup.

**Entry points into the wizard.** Three, all landing on step 1:

| From | Function | Preselects |
|---|---|---|
| Trading list "Request a trade" | `startWizard()` | Peak / next quarter, first eligible connection |
| Prices card "Request a price →" | `startWizardFromPrice(shape, periodType)` | that card's shape & period type |
| **Connection detail "Request a trade"** | `startWizardFromConnection(id)` | **that connection, locked** |

The connection-detail button sits **below** the "Block positions on this
connection" table, in a `.card-foot-action` (16px margin, 14px padding, a
top rule) — a request is a deliberate next step after reading the positions,
not a header control, so the card's `actionHtml` slot keeps only the
active-block count. Since a block is
traded against one connection and that connection is already decided by the
time you're on its detail page, the wizard sets `state.wizard.lockedConn` and
step 2 then renders **only that row** rather than offering a choice that was
already made. Non-tradeable (`tilburg-gas`) and ineligible (`breda`) connections
show a short reason instead of a button, and `startWizardFromConnection()`
re-checks eligibility itself via `tradableConnection()` — the guard is in the
handler, not only in the markup.

**Why the volume field does not `renderApp()`:** it used to, and that was the
bug where the field could not be typed into — a full re-render rebuilds the
`<input>` mid-keystroke and steals focus. `setWizardVolume()` now patches only
the derived readouts in place (`#wizard-total-line`, `#wizard-volume-note`,
`#wizard-continue`) via `refreshWizardVolumeUi()` and leaves the input alone.
Any new live-edit field on this page needs the same treatment; those three ids
are what makes the targeted update possible, so keep them.

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
`--radius-*`, `--text-*` tokens are its own addition. Color tokens **used to**
match the mockup exactly; as of **2026-08-13** that is no longer true — see
"Palette modernization (2026-08-13)" below for what changed and why. The two
`*Preview.html` mockups themselves were **not** edited and remain pure design
references frozen at the original palette; only `customer-portal.html`,
`back-office-portal.html` and `index.html` carry the new tokens. Don't
"fix" a live-page color back to the mockup's value — that would undo this
change.

#### Palette modernization (2026-08-13)

Product direction: "the colors are quite outdated, they can be much more
modern." The dataviz skill's validator
(`scripts/validate_palette.js`) was run against the live chart series colors
(`#0f766e` teal / `#4f46e5` indigo / `#ea580c` orange / `#0891b2` cyan) before
touching anything:

```
[FAIL] Chroma floor        below floor (reads gray): [["#0f766e",0.086]]
[PASS] CVD separation      worst adjacent #0891b2↔#ea580c ΔE 19.8 (protan) · tritan 5.9
```

The brand teal used for the Actual-Usage/Total-Cost chart line was
objectively desaturated enough to read as flat gray next to the dashed
indigo Hedge line — not a matter of taste. The orange/cyan Short/Long pair
passed but only marginally under tritanopia (ΔE 5.9, below the ≥8 target).

**What changed, and why two different teals now exist:** a single hex can't
satisfy both jobs at once here — the dataviz chroma floor (≥0.1, needed so a
chart line reads as colored rather than gray) and WCAG AA text contrast
(≥4.5:1 for the small 11–12.5px UI text this token also color) pull in
opposite directions at this hue's darkness (darker → better contrast, less
chroma). So the token was split by job:

| Token / use | Old | New | Why |
|---|---|---|---|
| Chart line stroke (`COST_TOTAL_LINE`, Actual-Usage line — literal hex in `customer-portal.html`'s SVG builders, not a CSS var) | `#0f766e` (chroma 0.086, reads gray) | `#059f8f` | Clears the chroma floor (0.10); only needs 3:1 against the white chart surface, which it clears (3.30:1). |
| `--pp-teal-700` (UI text/links/badges/`.card-action`/`.btn-link`, `.badge.brand`) | `#0f766e` (contrast 5.47:1) | `#00796b` | Keeps AA contrast (5.32:1) while nudging chroma up over the old value (0.093 vs 0.086) — as close to the chart teal as text contrast allows. |
| `--pp-indigo` / Hedge-Volume & Hedge-Cost line | `#4f46e5` | `#4338ca` | Deepened to pair with the punchier teal; normal-vision ΔE against the new teal is 30.5, well clear. |
| `--pp-orange` / Short-Buy fill | `#ea580c` | `#e8590c` | Minor re-step alongside the cyan re-validation below. |
| `--pp-cyan` / Long-Sell fill | `#0891b2` | `#0891b2` (unchanged) | Already fine on its own; kept as the fixed point the other three were re-validated against. |

Re-running the validator on the final four chart-series colors
(`#059f8f,#4338ca,#e8590c,#0891b2`):

```
[PASS] Lightness band       all 4 inside L 0.43–0.77
[PASS] Chroma floor         all 4 >= 0.1
[PASS] CVD separation       worst adjacent #0891b2↔#e8590c ΔE 19.8 (protan) · tritan 19.6
[PASS] Normal-vision floor  worst adjacent #4338ca↔#059f8f ΔE 30.5 (normal)
[PASS] Contrast vs surface  all 4 >= 3:1
```

Tritan separation went from 5.9 (marginal fail territory) to 19.6. The
semantic/status set (amber/green/red) and the neutral surface stack
(`--pp-bg`/`--pp-surface`/borders) were left unchanged — they weren't
implicated by the validator and already carry their own AA-passing
`-text` variants; revisit them separately if "modern" is later scoped to
include surfaces. No dark mode exists on these pages (no
`prefers-color-scheme`/`data-theme` handling), so no dark-surface
re-validation was needed. Rendered before/after (Dashboard mini-chart,
sidebar, badges, buttons) via headless Chrome screenshots before landing —
see the design agent's session for the images if picking this back up.

#### Certainty layer — provisional offers & projected data (vocabulary, 2026-08-13)

> **Status (2026-08-18):** the *projected data* half of this vocabulary is
> live. The *provisional offer* half is not — the offer overlay was removed
> from the Consumption chart (see "The chart draws positions" below). The
> spec is kept whole because the two halves were designed as one system and
> the offer half is the reference if an overlay is ever restored; read it as
> a design record, not as a description of what the page renders today.

Two features add a second axis to the Consumption chart, orthogonal to the
existing **category** encoding (hue = what a mark *is* — usage, hedge, buy,
sell): a **provisional coverage overlay** (a pending offer's hedge, stacked
above the confirmed position — not a real position until accepted) and
**projected data** (usage/cost past the last measured date, forecast from
the site's historical profile, on the *same* line as measured data). Both
are the same underlying problem — "how sure are we this mark is real" — so
they share one vocabulary rather than each area inventing its own dashed
line. This is a **state** (`Actual` vs `Provisional`), applied on top of
whatever category hue is already in play; it never replaces the hue.

Dash is already spent on category (dashed indigo = Hedge, solid = Actual
Usage/Total Cost — see "Cost chart" above), so certainty cannot also use
dash on those same lines without stacking two dash languages on one stroke.
The dataviz skill's texture channel is opt-in-only *for redundant category
identity*; here texture is the *primary* channel for a distinct semantic
(this mark is not-yet-real), so it renders by default, not behind an
accessibility toggle — a documented, deliberate exception to that default.

**`Provisional` treatment — always all of the following together, never
just one (the whole point is that it survives grayscale, a projector, and
CVD, so no single cue carries it):**

1. **Opacity** — fills/strokes at 55% of their `Actual` value
   (`--certainty-provisional-opacity: 0.55`).
2. **Texture, fills/areas only** (offer band, provisional coverage wash,
   uncovered/delta bars past the projection boundary) — 45° hairline hatch,
   6px pitch, inked in the fill's *own* hue one step darker than the wash
   (never a new hue) — reuses the dataviz "Lines" texture spec verbatim,
   just triggered unconditionally here instead of opt-in. None of
   `COST_TOTAL_LINE`/`COST_HEDGE_LINE`/`COST_BUY_FILL`/`COST_SELL_FILL` are
   steps of a named ramp (they're one-off hex — see "Palette modernization"
   above), so "one step darker" is computed, not looked up. Shipped as
   `darkenHex(hex, 0.22)` in `customer-portal.html` — an RGB×(1−0.22)
   multiply, kept simple since it only needs to run on the four known
   fills — reproducible from whichever fill hex is passed in, so it
   auto-tracks if the four ever change again rather than needing a second
   hardcoded table kept in sync with the first. As-shipped values (all
   clear 3:1 against the white chart surface, so the hatch reads even at
   hairline width):

   | Fill | Hatch ink (`darkenHex(·, 0.22)`) | Contrast vs white |
   |---|---|---|
   | `#059f8f` teal | `#047c70` | 5.09:1 |
   | `#4338ca` indigo | `#342c9e` | 10.50:1 |
   | `#e8590c` orange | `#b54509` | 5.50:1 |
   | `#0891b2` cyan | `#06718b` | 5.61:1 |
3. **Stroke pattern, lines only, and only for hues with no existing
   category dash** — the projected segment of the teal Actual-Usage/
   Total-Cost line switches from solid to a fine dot (`stroke-dasharray:
   "1,3"`), visually distinct from the hedge line's own `"5,3"` dash so the
   two dash languages (category vs certainty) are never on screen looking
   alike. The indigo Hedge/Hedge-Cost line already carries a category dash
   and does **not** get a second one — its provisional state (the pending
   offer) is drawn as a stacked **area** instead of a second line, so it
   gets the hatch treatment from (2), not a stroke change.
4. **Boundary marker — mandatory whenever a chart mixes states**, not
   optional polish: a 1px solid vertical rule (`var(--pp-border-strong)`)
   spanning the full plot height at the transition x, with a text label
   pair directly above the plot, 10px `var(--pp-text-faint)` — "Measured"
   left of the rule / "Projected" right of it for the data-boundary case,
   "Confirmed" / "If accepted" for the offer-overlay case.
5. **Legend** — any chart showing a `Provisional` mark adds a two-swatch
   legend pair: a solid swatch "Measured" / "Confirmed" beside a
   hatched-and-dotted swatch "Projected" / "Provisional offer" — the
   dataviz never-color-alone rule applies to state exactly as it does to
   category.
6. **Tooltip** — must say so in words ("Projected" / "Provisional offer —
   not yet accepted"), never rely on the visual treatment alone.

**Stat cards** can't hatch text, so they get the same redundant-cues
principle translated to that medium, using only existing neutral tokens —
no new hex, and never a tone color (`.export`/`.short`/`.negative`/
`.success` still color the value; certainty stays tone-agnostic so
"projected + short" and "projected + negative" don't read as two different
treatments):

- **Whole-card marker** (a fully projected card, or the mixed-row headline
  card whose summed value is partly projected): `border: 1px dashed
  var(--pp-border-strong)` in place of the card's normal solid border, plus
  `background: var(--pp-surface-alt)` in place of `--pp-surface` — border
  and background are the card's structural cue, standing in for the
  chart's hatch.
- **Inline measured/projected split within a sublabel** (e.g. "€ 3.200,00
  measured + € 1.588,62 projected"): the projected clause drops to
  `var(--pp-text-faint)`, the app's existing secondary-text token — no new
  token.
- **Badge**: `.badge.neutral` reading **"Projected"**, not "Provisional" —
  those are two different meanings (forecast data you haven't measured yet,
  vs. a pending trade offer you haven't accepted yet) and must stay
  verbally distinct so the two certainty stories are never confused.
  Border/background alone is easy to miss at a glance; the badge is the
  card's equivalent of the chart's mandatory legend + tooltip text — never
  the sole cue.
- A component card in a mixed row that is itself fully measured gets none
  of the above — only a card whose own figure actually mixes states is
  marked.

**Resolving the bold-value question for a mixed range** (asked and settled
2026-08-13): the primary bold value is the **measured portion only**, never
a measured+projected sum — the projected portion is the sublabel's "+ €X
projected" call-out, per the split above. A summed headline would present a
partly-guessed figure with full-certainty typography, which is exactly what
this vocabulary exists to prevent; the chart makes the same choice
geometrically by never blending a solid measured segment and a dotted
projected segment into one mark across the boundary. **Fully-projected
range** (zero measured days in view, e.g. a future month) is the degenerate
case of the same rule: no measured portion to anchor a primary value
against, so the value itself renders at `--certainty-provisional-opacity`
with the "Projected" badge attached directly, no second line — the card
equivalent of a chart line that's dotted end-to-end with no boundary marker
in view. Hedge volume is exempt from all of this on every screen (chart and
cards alike) — it's a real booked position, not date-dependent, so it never
gets the projected treatment regardless of the range being viewed.

None of this is implemented yet — `charts` owns the chart-geometry code
that draws it, `forward` owns what counts as measured vs. projected and
where the offer overlay's numbers come from, `cards` owns applying the
stat-card translation above. This subsection is the shared source of truth
so the three don't diverge; update it in place if the vocabulary changes
rather than letting each screen's code drift from it.

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
change). The **hedge** half is still grouped live in the browser, so
adding a hedge period to `hedge_blocks_2026.json` takes effect on the next
page load with nothing to regenerate. The **usage/tariff** half is not:
`consumption_compact_2026.json` holds exactly this `{sites, byDate,
bySite}` structure pre-computed, and must be rebuilt if the usage dataset
changes (see below). The page shows a "Loading live data…" state (controls
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
  Mon–Fri **and** the block is held — **08:00–20:00 wall-clock**, which the
  screen shows as **"08:15" through "20:00" inclusive** and the code expresses
  as `>= "08:00" && < "20:00"`. Those are the same twelve hours said three
  ways; the next paragraph is why they look different.

### Two time conventions, and the one place they meet

**Stored labels are the interval's START. Every label the UI shows is its
END.** The data is start-labelled because that is what the source's
`timestamp` field means (a day's array runs "00:00".."23:45", not
"00:15".."24:00"), so every comparison inside `consumption-calc.js` is written
against starts. The UI is end-labelled because that is how a delivery interval
is quoted in this market, and how `PeakPowerTrading-CalculationSample.csv`
reads a peak block — "8:15" is its first peak row, "20:00" its last.

The shift lives in exactly two exported functions, and must stay there:

| | | |
|---|---|---|
| `ConsumptionCalc.intervalEndLabel(t)` | `"08:00"` → `"08:15"` | axis ticks, table Time column, CSV Time column |
| `ConsumptionCalc.intervalRangeLabel(t)` | `"08:00"` → `"08:00 – 08:15"` | tooltip head, where there is room to show the whole interval |

So the day's last interval, `"23:45"`, displays as **"00:00"** — the midnight
that closes the day, not the one that opened it — and the axis reads
04:00 … 20:00, 00:00. A tick names an *instant*, so it is drawn at its
interval's **right** edge; the "08:00" tick therefore belongs to the interval
starting 07:45 and lands exactly where a peak block's riser does.

**The history is worth keeping, because two different bugs wore the same
costume.** The rule was originally `> "08:00" && <= "20:00"` — an end-of-
interval comparison applied to start-labelled data, which held the position
from 08:15 to 20:15, a full quarter-hour late. A sloped line hid it for
months; it only surfaced when the chart began drawing the hedge as a step and
the riser landed a bar right of the 08:00 tick. Drawing a quantity honestly is
what exposed the error in computing it. The first fix moved the *window*
(08:00–20:00, correct) and the labels then read "08:00", which looked wrong
because the labels were the half that was actually lying. The second fix left
the window alone and shifted the *display*. Both were needed; neither alone
was right.

Do **not** "simplify" `isPeakWindow` to the sample's literal strings. Applied
to start labels, `> "08:00" && <= "20:00"` re-introduces the late block
exactly.
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

**Stat cards: two equations, not a row of peers.** Seven flat cards gave no
sense of which figure mattered or how they related, even though the
relationships are exact arithmetic. They are now two labelled groups, each
running `component op component = result`, with the result card larger and
heavier (`.stat-card.result`):

```
Cost           Hedge cost  +  Delta cost   =  Total cost
Energy volume  Actual usage −  Hedge volume =  Uncovered
```

Cost sits above volume because Total cost is the headline and the volume row
explains the gap beneath it. **Long and Short merged into one Uncovered card**
that switches label and tone by sign — they are mutually exclusive, so one was
permanently displaying zero. Seven cards became six.

Two things to preserve if you touch this:

- **`Total cost` is displayed as literally `hedgeCostEur + deltaCostEur`**, not
  a separately-summed field. On a mixed range the summed field only covers
  cost-computable intervals and silently drops the projected days' hedge cost,
  while the Hedge cost card beside it always shows the full period — so the
  equation would visibly stop adding up, which is the one thing this layout
  exists to prevent. It is a no-op (~2e-10) on a fully-measured range.
- `statCardHtml(label, value, tone, sublabel, opts)`'s 5th argument is an
  options object (`{result, projected, breakdown}`). It defaults to falsy, so
  Dashboard, Wallet and Invoices — which call it with four arguments — render
  exactly as before. `.stat-group`/`.stat-equation`/`.stat-op`/`.result` are
  Consumption-only; the shared `.stat-card`/`.stat-row` rules are untouched.

All are totals over the selected date range.

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

**Usage chart (both single-day and multi-day):** two lines — actual usage (solid teal) and hedge
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

**Cost chart (second chart):** a second chart over the *same* intervals
plotting money rather than volume, in its own card below the usage chart. It
uses the **same visual grammar** as the usage chart, deliberately:

| | usage chart | cost chart |
|---|---|---|
| solid teal line | Actual Usage | **Total Cost** |
| dashed indigo line | Hedge Volume | **Hedge Cost** |
| bars spanning the gap | Uncovered (orange short / cyan long) | **Delta Cost** (orange buy / cyan sell) |

That parallel is exact rather than decorative: `Total = Hedge + Delta`, so the
vertical gap between the two lines **is** Delta Cost, just as the gap between
actual usage and hedge volume is the uncovered volume. Someone who has learned
to read one chart can read the other. Delta Cost can be negative, so the
y-axis is bipolar like the usage chart's.

There is deliberately **no fill down to zero** here. The usage chart's yellow
"covered" band marks a real quantity (`MIN(usage, hedge)`); the cost analogue
`MIN(hedgeCost, totalCost)` is not a meaningful figure, so drawing it would
spend a colour on nothing. Every mark on this chart means something.

Buy/Sell is encoded by **colour *and* by which side of the hedge line the bar
sits on**, and named in the tooltip — so the orange/cyan pair is never the
only cue (it's the weakest pair under tritanopia, ΔE 5.9).

### A hedge is a step, not a ramp

Every block-shaped series is drawn as a **stair** by `stepPoints()`: a flat run
across each interval's own width, with the riser on the boundary between
intervals. A block is either held for an interval or it is not — a peak block
goes to full at 08:00 and to zero at 20:00, and a base block steps at the
period boundary the same way. Plotting one point per interval anchor and
letting the polyline interpolate drew a **diagonal across the 15 minutes either
side of each boundary**, which claims a partial position nobody holds and reads
as the hedge ramping up over a quarter of an hour.

This covers hedge volume and hedge cost, on all four chart builders plus the
dashboard mini-chart. It deliberately does **not** cover actual usage or total
cost: those are
continuous quantities sampled per interval, where a connecting slope is honest.

One consequence to expect in tests: a stepped line ends at the last interval's
**right edge**, half a bar past the anchor a sampled line ends at — stopping at
the centre would imply the block lapsed halfway through its final interval.
`certainty-audit.js` carries both constants for that reason.

`barWidthFor(pitch)` is shared by all four chart builders: a 2px surface gap
between touching bars, tapering to a quarter of the pitch on dense multi-day
ranges where a fixed 2px would leave a sliver. Shared so the two charts' bars
stay aligned under the synced crosshair — **don't** hardcode a width in one
builder.

It mirrors the usage chart's structure exactly: a container-width single-day
version (`#cost-chart`, time-of-day labels) and a scrollable multi-day one
(`#cost-month-chart`, per-day gridlines), switched by the same day-count test,
with its own crosshair ids and geometry. `costChartBody()` holds the shared
bar/line maths so the two only differ in sizing and axis labels.

### Single-day charts size to their container

`buildChartSvg`/`buildCostChartSvg` take a trailing `width` and derive all
their geometry from it; `dayChartWidth()` measures `#day-chart-wrap`, and
`drawDayCharts()` sets the SVG's `viewBox` **and** `style.width` to that same
pixel value, so the scale is exactly 1:1.

That 1:1 is the whole point, and the reason not to "simplify" this to
`viewBox` + `width:100%`. The original bug was not the hardcoded `960`: with a
`viewBox` set and the height pinned at 260px, the browser's default
`xMidYMid meet` scaled to the *shorter* axis and letterboxed the sides. Going
to `width:100%` would have filled the space but scaled stroke widths and label
text with it — blurry, oversized type at wide viewports. Rebuilding the
geometry at the measured width keeps strokes at 1–2px and labels at 9–10px at
every size. A `ResizeObserver` redraws through `requestAnimationFrame`, guarded
on `lastDrawnDayWidth` so a resize storm collapses to one redraw per frame and
an unchanged width does nothing.

**Hover marks one chart only.** Hovering a chart shows that chart's crosshair
and tooltip and clears the other's. This deliberately reverses an earlier
design where both moved together and both tooltips showed at once — the
product owner found the dual crosshair too noisy. `CHARTS` and `clearHover()`
survive because `render()` still has to clear a stranded crosshair on the
hidden variant, and because the shared click-to-highlight-table-row path runs
through the same registry for all four variants; `activeCharts()` is gone.
There are still two tooltip elements (`#chart-tooltip`, `#cost-chart-tooltip`),
now because each chart owns one, not so both can show together.

**The two range charts must keep identical geometry** (`pxPerInterval = 4`,
same `width`/`plotW`/`stepX`/`barW` derivation) — they sit one above the other
and share a synced crosshair, so any difference visibly misaligns them. That
was wrong when the cost chart was first added (it used its own `stepX = 3`)
and the crosshairs landed at different x. `costChartBody()`'s `anchorOffset`
parameter is what lets one body serve both the day chart (anchor `barW/2`)
and the range chart (anchor `0`), matching the usage charts' conventions.

**Each tooltip covers only what its own chart plots**, selected by
`context.kind` (`"cost"` vs. anything else); the full set of columns stays
available in the table below.

| Usage chart | Source | Notes |
|---|---|---|
| Hedge | `hedgeVolume` | what was locked in for this interval |
| Usage | `actualUsage` | labelled "Usage", not "Actual Usage" |
| Short *or* Long | `short`/`long` | **omitted when 0** — mutually exclusive, so at most one appears |

| Cost chart | Source | Notes |
|---|---|---|
| Hedge | `hedgeCost` | the hedge's own cost, not its volume |
| Buy *or* Sell | `deltaCost` | label follows the sign: positive = **bought** at spot, negative = surplus hedge **sold**. Reads "Buy / Sell" in the rare exactly-zero case |
| Total | `totalCost` | |

The Short/Long and Buy/Sell pairs intentionally mirror each other across the
two charts: whichever side of the hedge an interval landed on names both its
volume row and its cost row.

Clicking either chart highlights and scrolls to that interval's row in the
table; the selection persists until the next click or until the view changes
(switching site or either date clears it). One shared interaction function
drives **all four** chart variants (usage and cost × single-day and
multi-day), using a cursor-position → nearest-interval-index calculation (not
per-mark listeners), so it scales to a wide range's interval count (a full
quarter is ~8,700 points). Clicking any of them highlights the same table row,
so the two charts stay linked to each other through the table.

**Table:** a Date column (short format, e.g. "5 Aug 2026") is the first
column — on a single-day range every row repeats the same date; on a
multi-day range it's what disambiguates the repeating `HH:MM` values
across days. The Time column shows the interval's **end**
(`intervalEndLabel`, see "Two time conventions" above), so a day's rows run
00:15 … 00:00; the CSV export writes the same label, or the file and the
screen would name the same row differently.

### Visual hierarchy, and three numbers not to "tidy"

The page reads answer-first, and three constants carry that. Each was
arrived at by rendering and looking, so changing one on aesthetic grounds
will quietly undo something that was measured.

**`--text-hero` (32px) on `.stat-card.result .value`.** Result and component
cards were both 23px, so each equation read as three equal figures with
operators between them rather than "these two make that one". The result
card also takes a tint and shadow. Watch for stale duplicate rules when
changing this — one was already found silently overriding the new size.

**Cost chart 190px vs. the usage chart's 260px.** The cost chart is the usage
chart's derived view (`Total = Hedge + Delta`, same grammar). It used to say
so in a subtitle while looking identical, which is the flaw this page had
everywhere: relationships asserted in words instead of shown. **Only the
height differs — every horizontal value (`padLeft`, `width`, `plotW`,
`stepX`, `barW`) is byte-identical**, because the shared crosshair depends
on x alone and the two range charts must stay pixel-aligned. That has been
violated once before; `range-alignment-audit.js` asserts it.

**`HATCH_MIN_BAR_WIDTH = 5`.** The 45° provisional hatch is scaled to bar
width by `hatchPitchFor()`, and **below 5px it is dropped entirely** in
favour of a flat fill at the provisional opacity. This is not a tuning
value: on the range chart's ~3px bars the pattern tile is sub-resolution, so
SVG cannot draw a diagonal at all and it renders as a flat wash
indistinguishable from a solid fill — verified by browser screenshot and
pixel crop, which is the only way this surfaces. Drawing an illegible
texture is worse than omitting it, because it claims a distinction the
pixels do not carry. Texture is one of four redundant certainty cues
(with opacity, the boundary marker and the tooltip wording), so dropping the
one that cannot render loses no meaning. `narrow-bar-audit.js` asserts all
three halves: no hatch at the narrow scale, the fallback keeps the reduced
opacity, and wide bars still hatch so the threshold cannot over-trigger.

**One breakpoint, at 760px** — the page's only `@media` rule. Everything
else responsive here is emergent (`flex-wrap` + `min-width` + `flex:1`, plus
the day chart's `ResizeObserver`), which is fine until wrap *position*
carries meaning. It does in three places: the equation (which stops being an
equation if its parts wrap arbitrarily), the chart toolbar, and the table
summary row. Below 760px those stack deliberately. There is no small-screen
layout below that and none is intended — this is a desktop trading tool, and
the breakpoint is a stated stop rather than an inherited one. Known and
accepted: the chart SVGs overflow the viewport below ~950px.

### Where the controls live, and why they moved

There is no longer a single controls row. Each control sits with **what it
filters**, which is the change that made this page read answer-first instead
of form-first:

| Control | Lives | Because |
|---|---|---|
| Site `#site-select` | page level, by the title | it changes everything on the page |
| From/To + Day/Month/Quarter `#from-date` `#to-date` | inside the usage-chart card, as its toolbar | they filter the charts and table, and sit next to what visibly changes |
| Export CSV `#export-csv` | on the interval table's summary row | export belongs with the thing it exports |

**The ids are the contract, not the DOM position.** All four elements are
acquired once by `getElementById` at startup and nothing reads their parent,
position or a container class — which is why they could be relocated without
touching `goToConsumption()`, the presets or the export. Keep the ids if you
move them again.

The 15-minute table is a **collapsed `<details>` disclosure**. Two rules
around it, both load-bearing:

- The collapse is **CSS/`<details>` only — rows always stay in the DOM.**
  `highlightTableRow()` queries `tr[data-idx]`, so conditional rendering
  would break chart-click-to-row silently.
- `highlightTableRow()` **force-opens the disclosure before scrolling**,
  because `scrollIntoView` under a closed `<details>` is a no-op. Nothing
  throws in either failure mode, which is why `scratchpad/tablelink.js`
  asserts `details.open` directly — note **jsdom does not implement
  `<details>` hiding** and reports `display:block` for closed content, so a
  computed-style check there passes vacuously and proves nothing.

**The Consumption header writes an empty crumb rather than not writing one.**
It used to restate the site and range that the controls now show a few pixels
away. Consumption is the one screen that does not route its chrome through
`renderTopbarChrome()`, so *deleting* the assignment would leave whatever the
previously-visited screen set — open a connection, click Consumption, and its
EAN sits above the title looking like a real breadcrumb, on the populated path
only. All three Consumption paths therefore assign `""`.

**Date-range filter:** **From** and **To** `<input type="date">` plus three
**Day / Month / Quarter** preset buttons. From/To are the
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

**The interval table's column order is depended on in four places, and
three of them fail silently.** `<thead>`, `renderTable()`, `CSV_COLUMNS`,
and the group-boundary rule `thead th:nth-child(3)/(8)/(14)` that draws the
identity / metered / position / money separators. Those indices are
positional, not named: add, remove or reorder a column and every boundary
after it shifts, the rules land mid-group, and **nothing fails** — no test
asserts it, so the table simply groups the wrong things. This is not
theoretical; the `Data` (Measured/Projected) column was added in this
round and took the CSV from 16 to 17 columns while CLAUDE.md's own count
went stale. The rule in `customer-portal.html` carries a comment listing
all 17 indices and which one ends each group; update it, the three indices,
`CSV_COLUMNS` and `<thead>` **in the same change**.

### Looking past the end of the data (forward ranges)

The From/To range extends to the furthest hedge block's `periodEnd`
(`MAX_SELECTABLE_DATE`, currently 2026-12-31), not the dataset's coverage.
Three different things are known past 2026-08-05, and the whole design turns
on keeping them apart rather than flattening them into one "future" idea:

| | Source | Certainty |
|---|---|---|
| **Hedge volume & hedge cost** | the blocks + the calendar | **Real.** Never marked projected — they depend on the contract price, never on metering or spot. This is why "the block for a period is automatically calculated" falls out for free at any date. |
| **Usage, Uncovered, Long/Short** | `usage-projection.js` | **Projected** from that site's own history. Marked everywhere. |
| **Delta & total cost** | `indicativeEpexFor()` | **Indicative** — priced off the portal's own quoted forward curve. |

`computeIntervalRow` nulls each field **independently**, not all-or-nothing:
usage-derived columns compute whenever consumption/production are known
(measured *or* projected), while cost columns stay null whenever EPEX is
unknown. `computeDayStats` carries `intervalsWithUsage` / `intervalsWithCost` /
`intervalsTotal` to match.

**A trap in those counters:** `intervalsWithUsage` counts *projected* usage
too — it means "has usage numbers", not "was measured". Measured-ness has to
come from the day counts (`realDayCount`/`totalDayCount`); only priced-ness
can be read off the interval counters. Conflating them made a wholly-projected
September look wholly measured.

**Forward pricing, and the assumption in it.** `indicativeEpexFor(date, time)`
reads `PortalSeedData.WIZARD_PERIODS` (month rows, then quarter) and
`WIZARD_YEAR` — the same quoted curve behind the Prices and Trading screens —
and picks base vs peak through `ConsumptionCalc.isPeakInterval()` rather than a
second copy of that peak-window rule. A forward curve is the market's
expectation of spot but **embeds a risk premium**, so it is not the same claim
as realised spot; every figure priced this way is labelled *indicative*. The
alternative, withholding forward cost, was tried and rejected: it emptied Total
cost, the headline figure, on exactly the ranges this view exists to show.

**Known gap: August 2026 has no quote.** The seeded month rows start at Sep
2026 and the year row is Cal *2027*, so 2026-08-06..08-31 has projected usage
but no forward price. Those intervals are excluded from cost and the card says
so ("excludes 26 days with no quoted price"). This is missing demo data, not a
code defect — adding an Aug 2026 row to `WIZARD_PERIODS` fixes it. **Do not**
paper over it by extrapolating a neighbouring month's price.

Cost labels must describe what the calculation *did*, not what was intended. An
earlier version read "26 of 31 days indicative" for a range whose 26 forward
days were in fact unpriced and silently dropped from the total — a figure that
omits most of its own range while implying it covers it is worse than a blank.

**The chart draws positions, and nothing but positions** (product direction,
2026-08-18). Only a `Confirmed` trade is drawn, as part of the hedge via
`confirmedBlocksForRange()`; every other stage — awaiting price, offer
received, accepted, rejected, expired, failed — draws nothing at all. There is
no provisional-offer overlay on this chart any more.

This was arrived at in three steps, and the direction of travel is the point:
the overlay was first corrected so a confirmed trade stopped drawing as
provisional, then accepted trades were dropped from it, then it was removed
outright. Each step asked the same question — is this mark a position? — and
the honest answer kept shrinking the overlay until there was nothing left of
it. A trade the desk has not executed is not a position, and its status is
already legible on Trading and the Dashboard, which is where a trade in flight
belongs.

What was removed with it: `findOfferForRange()` and its seeded-`TRD-1078`
fallback, `provisionalOfferLine()`, `isPendingOffer()`, the `offerVolume`/
`offerCost` series on `concatRangeData()`, the hatched indigo band on both
charts, the Confirmed / If-accepted boundary markers, the tooltip's
"Provisional offer" rows, and the subtitle's "dotted indigo = pending …" note.
`blockForOffer()` stays — `confirmedBlocksForRange()` uses it to turn a
confirmed trade into a real hedge block. The certainty vocabulary below is
therefore now **only** about measured vs. projected data; its offer half
documents a state this page no longer has.

Restoring an overlay means restoring all of it, not just the line: the band,
the boundary markers, the legend and the tooltip wording are one vocabulary
(see the certainty layer), and shipping the line alone would leave an
unexplained dotted stroke.

Read the hedge through **`hedgeBlocksFor(siteId, from, to)`**, never
`DATA.hedge[siteId]` directly — that helper is the one place the contracted
blocks from `hedge_blocks_2026.json` and the confirmed live trades are joined,
and going around it silently drops confirmed trades out of the line, the cost
and the coverage. A confirmed trade is signed by direction exactly as an offer
is (a sold block is negative) and priced at its **firm** offer price, so
`computeIntervalHedgeVolumes` sums it alongside the contracted blocks with no
special case. `MAX_SELECTABLE_DATE` counts confirmed trades too, or a position
past every contracted block would sit beyond the To input's max and be
unreachable — only confirmed ones, since nothing else reaches this chart.

**Testing this needs stated numbers, not pixels.** Two traps cost real time
here: several dashed-indigo polylines are in the DOM at once and the *dashboard
mini-chart* comes first, so "the first match" is a constant that never moves;
and the y-axis is shared, so adding a line rescales it and every other line
shifts in pixels while its value is unchanged. Assert on the Hedge volume card
instead — a confirmed BUY of 1 MW over Q4 2026 moves it by exactly 2.208 MWh,
a SELL by −2.208.

### Regenerating `consumption_compact_2026.json`

This is the **one** pre-computed artifact in the repo, and it exists only
because a public site cannot ask every visitor to download 75 MB. It is
not a build step in the usual sense — it is the output of the repo's own
already-tested `ConsumptionDataLoader.buildCompactDataset()`, run once
offline instead of in every browser, so what ships is provably what the
page would have computed itself.

Rebuild it **only** if `epex_tariffs_usage_combined_15_min_interval.json`
changes, with a one-off Node script that is *not* checked in (same
ephemeral-script convention as the EAN/usage generation above):

```js
const fs = require("fs"), L = require("./consumption-data-loader.js");
const raw = JSON.parse(fs.readFileSync("epex_tariffs_usage_combined_15_min_interval.json", "utf8"));
fs.writeFileSync("consumption_compact_2026.json", JSON.stringify(L.buildCompactDataset(raw)));
```

Do not hand-write or hand-edit the artifact, and do not reimplement the
grouping — calling the module is what keeps it honest. To verify a rebuild,
assert `JSON.stringify(buildCompactDataset(raw))` equals the file's
contents. Current figures: 217 days × 6 sites, 1.56 MB raw / ~419 KB
gzipped, down from 75.2 MB / 1.9 MB gzipped.

**Running / testing:** serve this folder
over http(s) (e.g. `npx http-server .` or `npx serve .`) and open the page
through that server's URL — opening the HTML file directly via `file://`
will fail to load data, since browsers block `fetch()` of local files that
way. The same applies to `back-office-portal.html`,
which shares `localStorage` with the Customer Portal and so must be served
from the **same origin** — open both through one server to see the trade-request
flow work.

`node consumption-calc.test.js`, `node consumption-data-loader.test.js`,
`node portal-trade-link.test.js` and `node portal-terms-link.test.js`
(deposit percentage, deposit/balance split, due dates, overdue state)
unit-test the logic modules against
fixtures (grouping-by-site, sorting-by-isp, rounding, hedge-block
filtering/blending, multi-period hedge stacking, period-hour maths, desk-card
conversion, storage round-tripping and corrupt-storage handling) without
needing to fetch the real multi-MB source files. `portal-seed-data.js` has no dedicated test suite (no calculation
logic to validate — it's ported static data plus one pure `simulateTopup()`
helper); the whole page's navigation (all 7 tabs, plus row-click detail
panels on Connections/Trading/Invoices and the Wallet top-up flow) has been
verified with a one-off jsdom + `http.server` smoke test rather than a
checked-in suite — re-run a similar script after changing the page shell
if in doubt, since there's no automated regression coverage for the
sidebar/page-switching logic itself.

## Deposit on a bought block

A customer enters a bought block on a **deposit** — a share of its value paid
up front — and owes the **balance** before delivery starts. Default 20 %, so a
€ 17.664 block costs € 3.532,80 to enter and € 14.131,20 the day before the
delivery period opens.

The percentage is per customer, set by the desk, and obeyed by the portal:

```
Back Office · Customers · Commercial settings  --deposit %-->  Customer Portal
      (peakpower.commercialTerms.v1)                wizard · offer · wallet
```

### The three rules that keep it coherent

1. **Before acceptance the percentage is read live**, so a change by the desk
   shows up immediately in what the wizard and the firm-offer banner ask for.
2. **At acceptance it is frozen onto the trade** (`PortalTermsLink.buildSettlement`
   → `req.settlement`). A later change must never retroactively alter what an
   agreed trade owes.
3. **Every screen after that reads the percentage off the trade**, never off the
   live setting. `depositPct()` in `customer-portal.html` is therefore only ever
   used for trades that do not exist yet.

`req.settlement` is `{depositPct, valueEur, depositEur, balanceEur, dueDate,
paidAt, paidBy}`. The balance is the **remainder**, not its own percentage
calculation, so deposit + balance = value exactly — at 33,33 % two independent
roundings would miss the total by a cent on every screen showing all three.

### Where it shows up

| Portal | Screen | What |
|---|---|---|
| Back Office | Customers · Commercial settings | The editable **Deposit on a bought block** field (`key: "depositPct"` in `COMMERCIAL_FIELDS`), plus a note saying what changing it does. An unusable value (blank, negative, over 100, words) **refuses the whole save** and keeps the form open — the field goes red. |
| Back Office | Customers · detail | A **BALANCE OUTSTANDING** stat card, only when there is one. |
| Back Office | Wallets | An **OUTSTANDING** column (one more than the mockup's, between MINIMUM and STATUS), red with an "N overdue" sub-line when late. |
| Customer | Trading wizard step 2 & 3 | Deposit and balance rows with the due date, and the balance box's "Deposit reserved" line. The funds check gates on the **deposit**, not the full value — before this a 20 % term was meaningless because you still needed 100 % in the wallet to get past step 2. An insufficient wallet names the shortfall ("Top up € 9.385,20 to cover the 20 % deposit on this block") and links to the top-up flow, rather than only refusing. `wizardGoStep2()` and `submitWizard()` **re-check it themselves**, so the rule survives a call that bypasses the disabled button. |
| Customer | Firm-offer banner | "Accepting reserves € X (20 %) now · balance € Y due …", and Accept is **disabled** when the deposit exceeds the available balance, with the shortfall named. |
| Customer | Trade detail | A **Payment** card: trade value, deposit paid, balance, due date, a **Pay balance** button, and the state in words (overdue by N days / due in N days / paid in full). |
| Customer | Wallet | A **Balance outstanding** stat card and an **Outstanding balances** table, soonest due first. |
| Customer | Dashboard | A stat card, and a red/amber banner when a balance is overdue or within 14 days. |

### Things that would be easy to get wrong

- **A Sell has no deposit.** The customer is the one being paid, so
  `PortalTermsLink.appliesTo()` is false and no schedule is built. Showing
  "balance due" against a sale would invent an obligation that does not exist.
- **Outstanding is not reserved.** The deposit is reserved on acceptance and
  leaves the available balance; the balance is money still sitting in the
  wallet that is already committed to a date. The Wallet screen shows both
  cards side by side deliberately — "available" is not "free" once a balance is
  coming.
- **A confirmed trade still owes its balance.** Confirmation is execution, not
  payment. `confirmTrade()` leaves `settlement` untouched and the balance stays
  payable afterwards; there is a test pinning exactly this.
- **The accept guard is in the handler, not only the button.** A stale screen
  must not be able to accept its way into a negative wallet. Rejecting is never
  blocked — declining cannot overdraw anything.
- **A missing or corrupt setting falls back to 20 %, never to 0.** The safe
  direction to fail in is asking for money we might not need, not letting a
  block through unpaid.
- **Commercial settings are now per customer** (`state.commercialByCustomer`,
  keyed by `kvk`). They used to be one shared list, which was harmless while
  every field was decorative — but editing Vandersteen's deposit would
  otherwise have silently changed Kramer's.
- The published request carries `customerId` (`PortalSeedData.CUSTOMER_ID`,
  Vandersteen's `kvk` `34215678`) so the desk joins a trade to a customer
  record by id rather than by display name — the Back Office calls the same
  company "Vandersteen Koeling B.V." and the portal calls it "Vandersteen
  Koeling".

### Not implemented

Wallet movements are in-memory, exactly as they already were for top-ups: a
reload resets the balances (the trade records themselves do persist, on the
link). There is no invoice, no dunning, and nothing stops delivery when a
balance goes unpaid — the overdue state is surfaced, not enforced.

## Cross-portal trade flow

The one flow spanning both portals, in both directions:

```
Customer wizard  --request-->  Back Office "To price"
Back Office desk --offer---->  Customer Portal firm offer (live countdown)
```

**One record per trade** holds the whole state, so there's a single source of
truth rather than a request list and a separate offer list to reconcile:

| `status` | meaning | desk queue | customer |
|---|---|---|---|
| `Awaiting price` | submitted, unpriced | To price | "Awaiting price" |
| `Offer received` | priced, window open | Awaiting customer (mm:ss tag) | pending firm offer + Accept/Reject |
| `Offer expired` | window elapsed unanswered | Awaiting customer ("expired") | "Offer expired" |
| `Accepted · awaiting execution` | customer accepted | **To confirm** (Confirm button) | accepted, amber |
| `Offer rejected` | customer declined | *(off the desk)* | rejected, on the timeline |
| `Confirmed` | desk executed it | *(off the desk)* | Confirmed, green, with market reference |

`status` is stored, but **`effectiveStatus(req, now)` is what to render** — an
offer expires on a clock, so the stored string goes stale on its own.

**Transport.** There is no backend, so `portal-trade-link.js` writes requests
to `localStorage` under `peakpower.tradeRequests.v1` (a JSON array, oldest
first). The Back Office page reads that key on load and subscribes to the
browser's `storage` event, so a request submitted in one tab shows up in an
already-open desk tab with no reload and no polling. `storage` only fires in
*other* tabs, so there's no same-tab echo to guard against; a `focus`
listener covers the same-tab case. Consequences of this choice: it is
**same-browser, same-origin only** — two different browsers, or a private
window, will not see each other — and both pages must be served from the same
origin (they already must be served over http(s) at all).

Storage failures (quota, private mode) are swallowed: `read()` returns `[]`
on anything unparseable and `write()` returns `false` rather than throwing,
and the Customer Portal wraps its `publish()` in a try/catch. **A broken link
must never break either portal's own flow.**

**Direction.** The full request → price → respond → confirm loop is
implemented. Not implemented: any wallet movement (accepting says funds are
reserved and confirming says the wallet is debited, but no balance changes).

**The return leg.** The desk's request detail has a price form (price €/MWh +
reaction window, defaulting to the request's own indicative price and 30
minutes) with a live total and validation; `sendOffer()` calls
`priceRequest()` and re-publishes under the **same id**, so the record is
updated in place. Total value is always derived from the request's own
computed volume, so the two portals can't disagree about it.

The Customer Portal calls `syncLinkedTrades()` on load, on `storage`, and on
`focus`. It rebuilds `state.trades` from the seed plus everything on the
link, with linked records winning on their own ids. `toCustomerTrade()`
converts a record into the portal's *existing* trade shape (`pending`,
`secondsRemaining`, events, facts), so a linked offer renders through the
same firm-offer banner, countdown and timeline code as the seeded
`TRD-1078` — no parallel rendering path. Rebuilding from the link on load
also means a submitted trade and its offer **survive a page reload**, which
the old in-memory-only `state.trades` could not.

**Countdowns.** Linked trades recompute from the offer's absolute `expiresAt`
each tick rather than decrementing a counter, so the two portals can't drift
apart and a backgrounded tab doesn't lose time. The desk updates queue tags
in place (not a full re-render) so it doesn't flicker or clobber a
half-typed price. Tone thresholds match the mockup: ≤5 min critical,
≤15 min warning, else neutral.

**Accept / reject.** The Customer Portal's firm-offer banner Accept and Reject
buttons are wired to `PP.acceptOffer`/`PP.rejectOffer` **for linked trades
only** — the seeded `TRD-1078` keeps the mockup's `PP.noop()` stub, since it
has no record behind it. `respondToOffer()` re-checks expiry itself rather
than trusting the UI, so a stale screen cannot accept a dead offer (exactly
what the desk's own note warns about); rejecting an expired offer is still
allowed, since declining is always safe. A decision is **final and outranks
the clock** — `effectiveStatus()` returns the response for a resolved record,
so an accepted trade never later reads as "expired" once its window elapses.

Accepted trades move to the desk's **To confirm** column; rejected ones use
the sentinel column `"done"`, which no queue matches, so they simply drop off
the desk. `buildQueues()` filters by queue key, so any unknown column is
naturally invisible rather than needing a special case.

**Confirm.** Every card in **To confirm** carries a Confirm button (the click
`stopPropagation()`s so it doesn't also open the card's detail). Confirming a
*live* trade calls `confirmTrade()` and publishes, giving the customer status
`Confirmed` (green) with a `Trade confirmed` timeline entry and an
`ICE-…` market reference; the card then moves to `"done"` and clears out of
the column. Only an **accepted** trade can be confirmed — not an unpriced,
unanswered, rejected or already-confirmed one.

**Fail.** Beside Confirm sits **Mark failed** — the mockup specifies both, and
its cards read `confirm or fail →`. `failTrade()` mirrors `confirmTrade()`
exactly: same guard that only an accepted trade qualifies, same pure new
record, same `"done"` column. The two are **mutually exclusive in both
directions** — a confirmed trade cannot later be failed, nor a failed one
confirmed — so an operator cannot flip an outcome the customer has already
been told about. The customer reads `Execution failed` in a **critical** tone
(not the amber of accepted-and-pending) with the reason on the timeline; with
no reason given it still says the reservation was released and nothing
charged, so a failure is never silent. The desk says "Mark failed" and the
customer reads "Execution failed" — an action versus an outcome, both derived
from `STATUS_FAILED` rather than written twice.

### Derived detail must not out-claim its source

Every desk trade has a full detail: summary, timeline, an illustrative
connection split, a market reference and a wallet check. Three rules were
learned the hard way building it, and they generalise beyond this screen.

**Read the shared source, don't copy it.** The wallet check renders the *same*
`WALLETS` row the Wallets screen does, so the two cannot disagree. The market
reference loads `portal-seed-data.js` for the forward curve rather than
copying the rows into the Back Office data, for the same reason. A second copy
of a number is a number that will drift.

**Consistent by construction beats consistent by inspection.** The connection
split derives from the trade's own contracted power with the last row taking
the rounding remainder, so the column always sums to the card's figure. It is
labelled *illustrative*, because it is synthesised and no per-connection
metering exists for a seeded trade.

**Correct arithmetic on decorative input is still a fabrication.** A Pricing
card once divided each trade's `valueLabel` by its real delivery volume to
show a €/MWh and a spread against the indication. The maths was right; the
input was not. Those seed values were authored to look plausible on a card,
never to satisfy `value = price × volume` — so every Q4-26 trade derived
around €37/MWh against an €84,20 indication, claiming the desk sells at 44% of
market on all of them. **A single spot-check looks like a real number; only
computing every row exposes it.** Seeded trades therefore show volume and the
indication and no price at all, and the card says why. A *live* record carries
`offer.priceMwh`, a genuinely quoted price, so there the spread is a true
statement and is shown. Do not "fix" the seed values to make a derived figure
come out sensibly — they are a verbatim mockup port, and editing them trades a
visible problem for an invisible one.

The mockup's chart is one static `BAR_HEIGHTS` array authored for `TRD-1058`
and stays there. Repeated under every trade it would imply a shape each of
them does not have.

The desk's own seeded rows (`TRD-1049`, `TRD-1052`) have no record behind
them, so confirming one just adds its id to `state.confirmedSeedIds` and
`seedRows()` filters it out — nothing is written to the link. Note that this
is page-local state, so seeded rows reappear on reload while live ones don't;
that's intended, since the seeds are mockup fixtures rather than real trades.

Accepted is deliberately **amber**, not green: the trade is reserved but not
yet executed. Green is reserved for `Confirmed`.

**A footgun worth knowing:** `toDeskCard`/`toCustomerTrade`/`secondsRemaining`
take an optional `now`, which makes them tempting `map()` callbacks — but
`list.map(toDeskCard)` passes the **array index** as `now`. That shipped once
and pinned every countdown to 1970 (tags read `496231:54:45`). `nowMs()` now
rejects any value before 2000 and falls back to the real clock, so the
mistake is harmless, and there's a regression test for it. Still prefer an
explicit wrapper.

**What flows.** `submitWizard()` previously hardcoded `"Q1 2027"` /
`"1,000 MW"` (copying the mockup); it now publishes the wizard's *real*
selections — direction, shape, the selected month/quarter/year period with
its start/end dates, per-connection power lines (zero-volume connections are
dropped), the note, and the indicative price for that shape. Total volume is
**computed**, not carried: `powerMw × hoursInPeriod(start, end, shape)`,
where base counts every hour and peak counts Mon–Fri 08:00–20:00 only (DST is
not adjusted for, matching `hedge_blocks_2026.json`'s simplification). That
formula independently reproduces the mockup's own hardcoded
`1,000 MW → 768,00 MWh` for Peak Q1 2027, which is what validates it.

Ids continue the Customer Portal's `TRD-1079+` sequence, which cannot collide
with the Back Office mockup's seeded `TRD-1049…1058`.

**Desk rendering.** `PortalTradeLink.toDeskCard()` converts a record into
exactly the card shape the mockup's queues use (including the short desk
period label — `Q1 2027` → `Q1-27`), so a live request is structurally
indistinguishable from a seeded one. `buildQueues()` places each live card in
**whichever column it declares** (To price while unpriced, Awaiting customer
once priced), at the top of that column, and drops any seeded row whose id a
live card reuses so re-publishing can't double up. Live cards get a teal tint and
a one-shot pulse; seeded rows have no underlying payload, so opening one
shows an explanatory note instead of a detail view.

`Back Office Portal - Preview.html` remains a pure design reference and was
**not** edited — the Live Data page is a separate functional rebuild, exactly
as the Consumption page is for the Customer mockup. Its source was read by
decoding the preview's own gzip+base64 bundle (its `__bundler/manifest` and
`__bundler/template` script blocks) rather than guessed at from the rendered
markup, so every ported constant is the mockup's literal value. Its shell CSS is the same
design-system block as the Customer Portal page, and every `.desk-*` rule is
copied verbatim from the mockup's Trade desk inline styles (queue gap 18px,
card `8px`/`14px 16px`, mono id 11.5/700 teal-600, tag 10.5/700 `4px 10px`
radius 5, meta 11px, value 12/700, action 10/600 mt10; detail column
`flex:1.55; min-width:520px`; list spaced 16px, detail 20px).

**Navigation.** All eight Back Office nav entries are navigable and **six of
them are real screens**, matching the mockup one-for-one. Only `Reference data`
and `Audit` are placeholders — because those are exactly the two the mockup
itself leaves unbuilt (`isPlaceholder = page === 'Reference data' || page ===
'Audit'`), rendered with its own verbatim wording ("Not covered in this round of
mockups…") in its own treatment (white card, `10px` radius, `48px 24px`, centred
`13px`). Leaving a screen clears its open detail, so returning lands on the list
rather than a stale record.

| Screen | Source | Sub-views / behaviour |
|---|---|---|
| **Home** | `back-office-screens-data.js` | Six StatCards, "Needs attention now", "Exposure", integration health. The three attention rows carrying a `tradeId` really open that trade on the desk (`BO.goTo('Trade desk')` + `BO.openTrade(id)`); the other two are inert, as in the mockup. |
| **Trade desk** | live — see "Cross-portal trade flow" | list / detail; the only screen with a real backend behind it. |
| **Customers** | `back-office-screens-data.js` | **list** / **detail** (`state.customerId`). Detail has stat cards, Company, Metering points, Commercial settings (**editable**) and Customer accounts. `buildCustomerDetail()` is ported verbatim, including its synthesised branch for every customer other than Vandersteen. |
| **Wallets** | `back-office-screens-data.js` | Four StatCards, the wallet table, and the deposit / manual-adjustment forms. Read-only, as in the mockup. |
| **Invoicing** | `back-office-screens-data.js` | Five StatCards, the critical DS Banner, Skipped customers and Drafts. Read-only. |
| **Data & feeds** | `back-office-screens-data.js` | Ingestion StatCards, the per-connection data-state grid + legend, inbound messages and the quarantine card. Read-only. |

**How a screen is wired.** `SCREENS` maps a nav entry to `{ body, chrome }` —
`body()` returns the screen's HTML string, `chrome()` returns the topbar's
`{title, subtitle, crumb, actions}`, which is the same shape the mockup's own
`renderVals()` computes. The Trade desk is the one exception (`{ self }`): it
owns two views and writes its own chrome. `gap20` marks the two screens the
mockup spaces at 20px (Home and the trade detail) rather than 16px.

Note the topbar has a **subtitle** element under the title. The mockup shows a
crumb *or* a subtitle, never both — a detail screen gets the crumb, a list
screen the subtitle.

**Deliberate divergences from the mockup**, all three because the mockup is a
static demo and these screens are meant to work:

1. **Cancel actually cancels.** The mockup's `cancelCommercialEdit()` and
   `saveCommercialEdit()` are the identical one-line stub, so Cancel keeps every
   keystroke. Here `startCommercialEdit()` snapshots the fields and Cancel
   restores them.
2. **`updateCommercialField()` does not re-render** — a re-render rebuilds the
   `<input>` under the cursor and steals focus mid-keystroke (the same footgun
   the Customer Portal's volume field hit). The read-only view is rebuilt on
   Save, which is the only place the new value is shown.
3. **Card `action` labels get the subtitle's type** via `cardAction()`. The
   mockup passes a bare string that `Card.jsx` drops into the head unstyled, so
   it inherits 16px next to a 13.5px title — plainly unintended.

Two mockup quirks are reproduced rather than fixed, both marked in the code:
the customers list interpolates `c.availableColor`, a key `CUSTOMER_LIST` does
not define (so those balances render in the inherited colour), and every
"Needs attention now" row carries `cursor:pointer` even though only three are
clickable.

**Design-system helpers.** `cardHtml`/`statCard`/`badge`/`dsBanner`/`cardAction`
map to `Card.jsx`/`StatCard.jsx`/`Badge.jsx`/`Banner.jsx`. Two subtleties worth
keeping: `.stat-card` has **no `flex:1`** (StatCard sets only `min-width`, so
stat rows size to content and pack left), and the Card's subtitle is a
**sibling** of the head, not a child — the head's own `margin-bottom` is 14px,
dropping to 4px when a subtitle follows and carries the remaining 14px.

`.banner` (12px/16px, one text run) is this page's own lighter one-line variant
used by the Trade desk; `.ds-banner` is the real DS Banner (14px/18px, 14px gap,
22px dot, 13px title over an 11.5px body) used by Invoicing. They are not
interchangeable.

When the page was first built its `.card`/`.card-title`/`.card-subtitle` rules
were accidentally left out of the extracted CSS, so every card rendered
unstyled — there is now a test asserting that **every class rendered into the
DOM has a matching CSS rule**, which is worth keeping if more markup is added.

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
