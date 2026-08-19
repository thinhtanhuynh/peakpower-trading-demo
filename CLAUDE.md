# CLAUDE.md

Project memory for `trading-poc` — read this before working in the folder.

## Communication & working style

- Write like a practical senior engineer: plain English, concrete. Avoid
  abstract architecture metaphors unless necessary, and don't overuse jargon
  (load-bearing, footgun, yak shaving, substrate, spine, seam, holistic,
  canonical, principled, robust, ergonomic). Don't invent acronyms for local
  concepts — use full names unless the acronym is already standard.
- Before doing anything: identify the task's actual objective, check for
  hidden details that change the answer (don't pattern-match a familiar
  question without checking what's different here), and if more than one
  answer is plausible, say so or ask rather than collapsing to one confident
  answer.
- No emojis unless explicitly requested. Responses should be short and
  concise; match response length to the task — a simple question gets a
  direct answer, not headers and sections. Reference code as
  `file_path:line_number`. Don't narrate internal deliberation — state
  results and decisions directly. End-of-turn summary is one or two
  sentences: what changed and what's next, nothing else. Use they/them for
  anyone whose pronouns haven't been stated — never infer from a name.
- Before the first tool call, state in one sentence what you're about to do.
  While working, give short updates at key moments (one sentence is usually
  enough) — brief is good, silent is not. Write so the reader can pick up
  cold: complete sentences, no unexplained shorthand from earlier in the
  conversation.
- In code: default to no comments; only add one when the *why* is
  non-obvious. Don't explain what the code does (well-named identifiers do
  that) and don't reference the current task/fix/callers in comments — that
  belongs in the PR description. Never write multi-paragraph docstrings or
  multi-line comment blocks — one short line max. Don't create planning,
  decision, or analysis documents unless asked. Don't add features, refactor,
  or introduce abstractions beyond what the task requires, and don't ship
  half-finished implementations. Don't add error handling for scenarios that
  can't happen — only validate at system boundaries. Don't use feature flags
  or backwards-compatibility shims when you can just change the code
  (renaming unused `_vars`, re-exporting types, `// removed` comments, etc.).

### Keeping this file
This is a rule book, not a changelog. Record what the code does **now** and
which mistakes to avoid; git holds the history. Don't add "verified by…"
paragraphs, superseded designs, or a section per iteration — update the
existing rule in place instead.

## What this is

An early-stage proof-of-concept for **PeakPower**, an energy trading
platform. Four things live here:

1. **Two static HTML mockups** — `Customer Portal - Preview.html` and
   `Back Office Portal - Preview.html`. Bundled preview exports (they render
   `PeakPowerDesignSystem_7164da.*` components through a small templating
   runtime — not React/Vue source). **Design references only; never
   hand-edit them.**
2. **EPEX day-ahead tariff data** plus generated large-consumer usage and
   production test data, at 15-minute resolution.
3. **Two working portals** — `customer-portal.html` and
   `back-office-portal.html` — hand-written rebuilds that actually run.
4. **Pure JS modules** (dual Node/browser) behind them, with Node test
   suites for the ones that calculate.

There is **no Python, no build step and no package.json**. Modules load via
`<script src>` and every calculation runs client-side on page load.

## Running and testing

Serve the folder over http(s) — `npx http-server .` or `npx serve .` — and
open the pages through that URL. Opening via `file://` fails: browsers block
`fetch()` of local files. Both portals must come from the **same origin**;
they pass trades to each other through `localStorage`.

Tests need only Node:

```
node consumption-calc.test.js
node consumption-data-loader.test.js
node usage-projection.test.js
node portal-trade-link.test.js
node portal-terms-link.test.js
```

They run against fixtures, not the multi-MB source files. `portal-seed-data.js`
and the two `back-office-*-data.js` modules have no suites — they are static
data. Neither portal's navigation has automated coverage; re-run an ad hoc
jsdom or Playwright smoke test after changing a page shell.

## Repository contents

| File | What it is |
|---|---|
| `Customer Portal - Preview.html` | Static design mockup of the customer portal |
| `Back Office Portal - Preview.html` | Static design mockup of the internal back-office portal |
| `EPEX tariffs 15 min interval.csv` | Source EPEX day-ahead export, 20,828 rows |
| `epex_tariffs_15_min_interval.json` | Same tariff data as JSON |
| `epex_usage_15_min_interval.json` | Generated usage/production test data, 6 sites × 20,828 intervals |
| `epex_tariffs_usage_combined_15_min_interval.json` | Tariff + usage merged, one record per site per interval |
| `consumption_compact_2026.json` | The one pre-computed artifact — the grouped `{sites, byDate, bySite}` the portal fetches. See "Regenerating" below |
| `hedge_blocks_2026.json` | Hand-edited hedge/trade block test data per EAN. Fetched and grouped live, so edits show up on the next page load |
| `PeakPowerTrading-CalculationSample.csv` | Reference calculation sample (one day, 96 rows) the formulas are validated against. Negative numbers use accounting parentheses; `-` means zero. Its blocks are unpriced, so Hedge Cost is 0 and Total Cost equals Delta Cost |
| `consumption-calc.js` | Stat and formatting maths. Tested |
| `consumption-data-loader.js` | Groups the source JSON into the page's shape, plus the `fetch()` loader. Tested |
| `usage-projection.js` | Projects a site's usage past the dataset's coverage. Tested |
| `portal-terms-link.js` | Deposit percentage and settlement maths, shared both ways. Tested |
| `portal-trade-link.js` | Carries trades between the portals over `localStorage`. Tested |
| `portal-seed-data.js` | Static seed data for the customer screens with no live source |
| `back-office-desk-data.js` | Back-office seeded trades/queues plus `buildQueues()` |
| `back-office-screens-data.js` | Back-office seeded data for Home, Customers, Wallets, Settlements, Data & feeds |
| `customer-portal.html` | The working customer portal (7 screens) |
| `back-office-portal.html` | The working back-office portal (6 real screens + 2 placeholders) |

The two large usage/combined JSON files exceed the 30 MB chat-upload limit —
gzip before sending them through Claude (`gzip -9 -k file.json`).

## Portal mockup navigation

**Customer Portal**: Dashboard, Connections, Consumption, Prices, Trading,
Wallet, Settlements. "Connections" is where EANs get linked to an account.

**Back Office Portal**: Home, Trade desk, Customers, Wallets, Settlements,
Data & feeds, Reference data, Audit.

A mockup's real component styles live in a gzip+base64 blob inside the file
(`PeakPowerDesignSystem_7164da`), not in its markup — inline `style=`
attributes alone won't tell you what a `Card` or `Badge` looks like. Decode
the bundle rather than guessing from rendered markup.

## EPEX tariff data

20,828 rows, 2026-01-01 through 2026-08-05 (217 days), one row per 15-minute
interval.

Fields: `id`, `day`, `day_of_week` (ISO: 1=Mon…7=Sun), `day_of_year`,
`delivery_day`, `epex` (EUR/kWh day-ahead price), `hour`, `hour_of_year`,
`is_dst`, `is_low_tariff_normal`, `is_low_tariff_south`, `month`,
`month_year`, `timestamp` (local delivery-interval start), `utctime`, `year`,
`hour_of_day` (1–24), `created_date`, `updated_date`, `isp` (15-min slot
number within the day, 1–96; DST days differ).

## Generated usage/production test data

The usage files carry every tariff field except `epex`,
`is_low_tariff_normal`, `is_low_tariff_south` (the combined file keeps those
too), plus:

- `EAN` — 18-digit metering-point code, one fixed EAN per organization.
- `organization_type` / `organization_name` — which site the row belongs to.
- `consumption` (kW) — average power draw during the interval.
- `production` (kW) — on-site generation (0 where none).

Six large-consumer sites, each with its own load shape. **EANs match the
`CONNECTIONS` list exactly** — the portal stores them with spaces
(`8716 8710 0000 0000 11`), the data files without.

| organization_type | EAN | Connection | Profile |
|---|---|---|---|
| `data_centre` | 871687100000000011 | `rot` / Rotterdam DC | Near-flat 24/7 ~2.4–2.6 MW, very low variance, slight summer cooling uptick. 300 kWp solar canopy |
| `cold_store` | 871687100000000027 | `venlo` / Venlo cold store | 24/7 refrigeration ~450–650 kW (higher in summer), plus 30-min defrost spikes (+150–220 kW) at 02:00/08:00/14:00/20:00. No generation |
| `logistics_hub` | 871687100000000043 | `tilburg` / Tilburg plant | Operating hours 05:00–23:00 ~500–650 kW, ~160 kW overnight. 700 kWp rooftop solar that can exceed daytime consumption |
| `office` | 871687100000000059 | `almere` / Almere office | Weekday business hours ~220–260 kW (+12 kW Jun–Aug for AC), off-hours ~72–90 kW. 60 kWp solar, scaled off the `logistics_hub` row for the same timestamp (`prod / 700 × 60`) so sunny/cloudy days stay consistent |
| `greenhouse` | 871687100000000061 | `unnamed` / — no name set — | Grow-lighting driven: 18h photoperiod, ~850 kW lighting switching on pre-dawn/post-dusk in low-daylight months, +110 kW climate baseline. Production is **CHP**, not solar — runs day and night, ~900 kW winter down to ~300–350 kW summer |
| `manufacturer` | 871687100000000078 | `breda` / Breda warehouse | Two-shift weekday ~1.6 MW (06:00–22:00), ~420 kW overnight, ~450 kW weekend. 150 kWp solar |

The portal's 7th connection, `tilburg-gas` (EAN `871687100000000092`, Gas,
"Not tradeable"), deliberately has **no usage rows**.

### Generation assumptions

- Deterministic, seeded (`random.seed(42)` for consumption/production noise,
  a separate seeded RNG for EAN digits; the `office` profile used
  `random.Random(420608)`).
- Solar sites use a sinusoidal day-length model for ~52°N: ~8h at winter
  solstice to ~16.5h at summer solstice, with a sun-position irradiance curve
  inside that window and zero outside it.
- One "weather" cloud factor per calendar day, shared across all solar sites,
  drawn from a per-day RNG seeded on the date string.
- Greenhouse CHP output follows a seasonal heating-demand cosine (peak
  mid-January, trough mid-July), with ~6% of days fully down for maintenance.
- **No generator script is checked in** — the Python that produced these
  files was run ad hoc and deliberately not kept. To regenerate or extend
  (a 7th site, a changed profile, a longer date range), rebuild the profile
  logic above in JS or as a one-off ephemeral script.

## Hedge block test data

`hedge_blocks_2026.json` is hand-maintained: one row per EAN per shape per
period, expressing a hedge as a power (MW) held for a period, converted to
energy (MWh) and to kW/kWh. New rows go straight into the JSON.

**Shapes**: `base` is held 24/7 across the period; `peak` only Mon–Fri
08:00–20:00 within it.

**Conversion**: volume (MWh) = power (MW) × hours-in-period, counting all
wall-clock hours for `base` and only weekday 08:00–20:00 hours for `peak`.
DST hour gain/loss is not adjusted for. `powerKw` / `volumeKwh` / `priceKwh`
are unit conversions (×1000 / ×1000 / ÷1000) of the MW / MWh / €-per-MWh
fields.

**Period fields** — an enum plus supporting fields, so MONTH/QUARTER/YEAR all
use one shape:

| Field | Type | Notes |
|---|---|---|
| `periodType` | `"MONTH"` \| `"QUARTER"` \| `"YEAR"` | |
| `year` | number | always set |
| `month` | 1–12 or `null` | only when `periodType` is `MONTH` |
| `quarter` | 1–4 or `null` | only when `periodType` is `QUARTER` |
| `periodStart` / `periodEnd` | ISO dates | inclusive first/last day |
| `periodLabel` | string | e.g. `"Aug 2026"`, `"Q3 2026"`, `"2026"` |

Currently 36 rows — 6 EANs × 2 shapes × 3 periods:

| periodLabel | periodType | power MW base / peak | price €/MWh base / peak |
|---|---|---|---|
| `2026` | `YEAR` | 1.0 / 1.0 | 70.00 / 95.00 |
| `Q2 2026` | `QUARTER` | 2.0 / 1.0 | 66.39 / 91.15 |
| `Jul 2026` | `MONTH` | 2.0 / 1.0 | 77.79 / 91.19 |

The `2026` row uses round numbers so the volume maths is hand-checkable; the
other two use a different base/peak split and non-round prices to exercise
several simultaneously-active periods per site. Adding a period means adding
6 EANs × 2 shapes = 12 rows. `tilburg-gas` is excluded — not tradeable.

## Regenerating `consumption_compact_2026.json`

The **one** pre-computed artifact, and it exists only because a public site
cannot ask every visitor to download 75 MB. It is the output of the repo's
own tested `ConsumptionDataLoader.buildCompactDataset()`, run once offline
instead of in every browser.

Rebuild it **only** if `epex_tariffs_usage_combined_15_min_interval.json`
changes, with a one-off script that is not checked in:

```js
const fs = require("fs"), L = require("./consumption-data-loader.js");
const raw = JSON.parse(fs.readFileSync("epex_tariffs_usage_combined_15_min_interval.json", "utf8"));
fs.writeFileSync("consumption_compact_2026.json", JSON.stringify(L.buildCompactDataset(raw)));
```

Never hand-edit the artifact and never reimplement the grouping — calling the
module is what keeps it honest. To verify a rebuild, assert
`JSON.stringify(buildCompactDataset(raw))` equals the file's contents.
Current figures: 217 days × 6 sites, 1.56 MB raw / ~419 KB gzipped, down
from 75.2 MB / 1.9 MB gzipped.

`hedge_blocks_2026.json` is deliberately **not** pre-computed — it stays
small and is grouped live, so editing a hedge period needs no rebuild.

## The loaded data shape

`ConsumptionDataLoader.loadConsumptionData()` fetches
`consumption_compact_2026.json` and `hedge_blocks_2026.json` and produces:

```jsonc
{
  "sites": [{ "id": "rot", "ean": "871687100000000011", "name": "Rotterdam DC" }],
  "byDate": { "2026-01-01": { "t": ["00:00"], "p": [0.0896] } },
  "bySite": { "rot": { "2026-01-01": { "c": [612.4], "g": [0.0] } } },
  "hedge":  { "rot": [{ "shape": "base", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.07 }] }
}
```

`byDate[date].t`/`.p` (local time-of-day, EPEX €/kWh) are stored once per
date and shared across sites; `bySite[id][date].c`/`.g` are per-site
consumption/production in kW, index-aligned with `.t`. Array length is 96
every day except 2026-03-29 (spring forward), which has 92. `hedge[id]` keeps
period start/end per block, so any mix of YEAR/QUARTER/MONTH rows is picked
up with no code change.

The page shows a "Loading live data…" state with controls disabled until both
fetches resolve, and an inline error card if one fails — most often because
the page was opened via `file://`.

## Calculations

`consumption-calc.js`, unit tested against real rows from
`PeakPowerTrading-CalculationSample.csv`. Per 15-minute interval; the source's
kW is converted to kWh (`× 0.25 h`) internally first.

- **Usage Cost** = `(Consumption − Production) × EPEX`. **There are no grid
  fees in this model** — an earlier version layered TUF/FDF fees on top of
  EPEX; those constants and params are gone and every cost figure is pure
  EPEX.
- **Actual Usage** = `Consumption − Production`. Goes negative whenever
  production exceeds consumption — common, not an edge case.
- **Base Volume** / **Peak Volume** — summed separately across all
  simultaneously-active blocks of each shape (`powerKw × 0.25` per block). A
  `peak` block counts only Mon–Fri and only while held.
- **Hedge Volume** = Base + Peak.
- **Uncovered** = Actual Usage − Hedge Volume.
- **Long** = `max(0, −Uncovered)` (over-hedged, sold at spot).
  **Short** = `max(0, Uncovered)` (under-hedged, bought at spot).
- **Delta Cost** = `Uncovered × EPEX` — the spot P&L of the unhedged gap;
  negative means revenue. This one expression covers over-hedged,
  under-hedged **and** net-export intervals; the old `Actual Usage < 0`
  special case is gone. Computed from full-precision intermediates, not
  displayed values.
- **Hedge Cost** = `Base Volume × base priceKwh + Peak Volume × peak
  priceKwh`, each active block at its **own** price, so stacked blocks of the
  same shape at different prices come out right.
- **Total Cost** = Delta Cost + Hedge Cost.

`priceKwh` therefore feeds **only** Hedge Cost and, through it, Total Cost.
Delta Cost measures the position against spot alone. Numbers display NL-style
(comma decimal, period thousands).

## Two time conventions, and the one place they meet

**Stored labels are the interval's START. Every label the UI shows is its
END.** The data is start-labelled because that is what the source's
`timestamp` means (a day runs "00:00".."23:45"), so every comparison inside
`consumption-calc.js` is written against starts. The UI is end-labelled
because that is how a delivery interval is quoted in this market.

The shift lives in exactly two exported functions and must stay there:

| Function | Example | Used by |
|---|---|---|
| `ConsumptionCalc.intervalEndLabel(t)` | `"08:00"` → `"08:15"` | axis ticks, table Time column, CSV Time column |
| `ConsumptionCalc.intervalRangeLabel(t)` | `"08:00"` → `"08:00 – 08:15"` | tooltip head |

So the day's last interval, `"23:45"`, displays as **"00:00"** — the midnight
that closes the day. A tick names an instant, so it is drawn at its interval's
**right** edge; the "08:00" tick belongs to the interval starting 07:45 and
lands exactly where a peak block's riser does.

**The peak window is `>= "08:00" && < "20:00"` against start labels**, which
the screen shows as "08:15" through "20:00" inclusive. Do **not** "simplify"
`isPeakWindow` to the sample CSV's literal strings: applied to start labels,
`> "08:00" && <= "20:00"` holds the position a full quarter-hour late. That
bug hid for months behind a sloped line and only surfaced once the chart drew
the hedge as a step.

## Customer Portal (`customer-portal.html`)

A native rebuild of the whole mockup's navigation in one page — a working
sidebar switches `.page` containers via `goTo(page)`, no iframe and no
separate files. It does not modify or depend on `Customer Portal -
Preview.html`.

The state machine (`state` plus `goTo`/`openConnection`/`openTrade`/
`startWizard`/`topUpWallet`/`performTopup`/`openSettlement` and friends) is
exposed on `window.PP` so generated HTML can wire `onclick`/`onchange`
directly.

Consumption is the only screen backed by real calculated data. The other six
are a verbatim port of the mockup's copy, numbers and interaction model —
that mockup is itself a static seeded demo, so matching it means matching its
hardcoded figures rather than deriving them. An earlier design derived them
from real data; that was reverted on explicit product direction.

| Screen | Data source | Sub-views |
|---|---|---|
| **Dashboard** | `portal-seed-data.js` (`DASHBOARD_PRICE_TILES`, `DASHBOARD_RECENT_ACTIVITY`) + live wallet balance + a live mini chart | Single view. Position hero, stat cards, firm-offer banner for the pending trade, indicative price tiles, and a "latest day" mini chart reusing real Rotterdam DC data |
| **Connections** | `portal-seed-data.js` (`CONNECTIONS`) | **list** / **detail** (`state.connId`) |
| **Consumption** | Real, calculated — see below | Single view, arbitrary From/To range |
| **Prices** | `portal-seed-data.js` (`PRICES`) | Single view. Six indicative cards, each jumping into the wizard via `startWizardFromPrice`, plus a synthetic 90-day trend chart |
| **Trading** | `portal-seed-data.js` (`TRADES_SEED`, `WIZARD_CONNECTIONS`, `WIZARD_PERIODS`) + `state.trades` | **list** / **detail** (`state.tradeId`) / **wizard** (`state.wizardStep` 0–2), via `state.tradingView` |
| **Wallet** | `portal-seed-data.js` (`WALLET_LEDGER`, `TOPUPS`, `BANK_DETAILS`) + in-memory balances | **ledger** / **topup**, via `state.walletView`. Interactive but not persisted across reload |
| **Settlements** | `portal-seed-data.js` (`SETTLEMENTS`) | **list** / **detail** (`state.settlementId`) |

The Dashboard's mini chart has its own `buildMiniChartSvg()`, kept separate
from the Day chart's `buildChartSvg()` so the two `<svg>`s don't collide on
the `#chart-crosshair` id or clobber each other's hover geometry.

**The Dashboard hero's figures are hardcoded demo values** (`78,4 %`,
`1.291,4 MWh`, `812,8`/`214,4`/`121,3`/`142,9` MWh), matching the two stat
cards below it. A real portfolio-wide aggregation across all 6 connections is
a genuine new feature — it needs `computeDayStats` summed across sites, a
definition of "Open" that doesn't exist in this model, and projection for the
unmeasured part of the month. This hero is where those numbers would land.

**Both firm-offer banners read the pending trade's own fields.** The
Dashboard's condensed banner and the Trading detail's full one share the dark
`.offer-banner` shell and the `.btn-accept` button, and both interpolate
`pending.shape`/`.period`/`.power`/`.price`/`.value` — never a literal
string. The Dashboard's countdown adds `countdownRingSvg()` (an amber arc
driven by `secondsRemaining / secondsTotal`, both already on every trade
record); the Trading detail's stays plain mm:ss text.

### Tables

All six seeded screens use `display:grid` divs (`.grid-table`/`.gt-head`/
`.gt-row`) rather than `<table>`, matching the mockup. Consumption's own real
`<table>` is unchanged.

Two densities, via a `.dense` modifier:

| | head | row | gap | used by |
|---|---|---|---|---|
| default | `10px 16px` @10.5px | `13px 16px` @12.5px | 14px | top-level lists: Connections, Trading, Settlements |
| `.dense` | `9px 12px` @10px | `11px 12px` @12px | 10px | tables nested in a card: wallet ledger, settlement line items, connection block positions |

Per-screen `grid-template-columns` are copied verbatim (wallet ledger
`0.9fr 1fr 1.8fr 1fr 1fr 0.8fr 0.8fr 1fr`, settlement line items
`0.3fr 2.6fr 1fr 1fr 1fr 1fr`) — don't tidy these into round numbers.

### Vertical spacing between sections

`.page` is a flex column with `gap:16px`, but **only Consumption puts its
sections directly in `.page`**. The other six render into a single
`#<name>-body` wrapper, so `.page` has one child and its gap applies to
nothing. Those wrappers carry the gap themselves:

```css
#dashboard-body, #connections-body, #prices-body,
#trading-body, #wallet-body, #settlements-body { display:flex; flex-direction:column; gap:16px; }
#dashboard-body { gap:20px; }   /* the one screen the mockup spaces at 20px */
```

A new screen rendering into its own `-body` wrapper must be added to that
list, or its sections stack flush. Detail sub-views render into the same
wrapper and inherit it.

### Trading wizard

Three steps: product & period → connection & volume → review & submit.
`state.wizardStep` is 0–2.

**Entry points** — four buttons, three functions, all landing on step 1:

| From | Function | Preselects |
|---|---|---|
| Trading list "Request a trade", Dashboard hero "Request a trade" | `startWizard()` | Base / next month, first eligible connection |
| Prices card "Request a price →" | `startWizardFromPrice(shape, periodType)` | that card's shape and period type |
| Connection detail "Request a trade" | `startWizardFromConnection(id)` | that connection, locked |

`startWizardFromPrice()` must **not** apply the default — honouring the card
the customer clicked is its whole reason to exist.

Every entry point must set `state.page` and call `activatePageDom("trading")`.
`renderApp()` only refreshes whichever `.page` is already visible, so an entry
point that skips those two lines renders the wizard into a hidden container:
no error, no visible effect, a dead button. If a fifth "Request a trade"
button appears, check this before the click handler.

The connection-detail button sits **below** the block-positions table in a
`.card-foot-action` — a request is a next step after reading the positions,
not a header control. Connections flagged `notTradeable` (the gas connection) or `notEligible`
(Breda's expiring contract) show a reason instead of a button, and
`startWizardFromConnection()` re-checks eligibility itself through
`tradableConnection()`.

#### Step 1 — product & period

Direction (Buy/Sell) is the only standalone field. Below it sit **two stacked
tables**, BASE (24/7) and PEAK (Mon–Fri 08:00–20:00), built by
`buildShapeTable(shape)`. Each is a 5-column product table — Product, Price
(€/MWh), Hours, Volume (1 MW), Value (1 MW) — whose rows come from
`buildWizardProductGroup(shape, type, label)`, called three times per table
for Month (6), Quarter (4) and Calendar year (2) under `.pt-group`
subheadings. The three arrays in `PortalSeedData.WIZARD_PERIODS` share the
`{period, base, peak, observed, start, end}` shape, so
`getSelectedWizardPeriod()` is one lookup into `WIZARD_PERIODS[periodType]`
indexed by `w[periodType + "Idx"]` — no per-type branch.

**The tables are stacked, not side by side.** Five columns twice over doesn't
fit the wizard width. This reverses the earlier "Base/Peak side by side"
decision and costs what that bought — comparing one period's Base against its
Peak is now a scroll rather than a glance. If that trade needs undoing, drop
a column first (Hours is the most droppable; Volume already encodes it at
1 MW).

**Hours, Volume and Value are derived, never seeded.** Hours is
`PortalTradeLink.hoursInPeriod(p.start, p.end, shape)`; Volume at 1 MW *is*
that hour count in MWh (`contractVolume()` switches to GWh above 1.000); Value
is price × hours. The 1 MW basis is fixed and named in the column header —
the customer's real volume isn't chosen until step 2, so this stays a stable
yardstick rather than a number that moves under them.

**Exactly one of the 24 rows is selected at a time.** `selectWizardBar(shape,
type, i)` sets `state.wizard.shape`, `periodType` **and** the matching index
together — every click has to claim all three, since any row in either table
can be the selection. The row carries the `onclick`; `.pt-row` is
`display:contents`, so its cells participate in the parent grid directly and a
click on any cell bubbles to it.

Selected state uses three cues together — a left accent bar (`inset` box-shadow
on the first cell), a row wash, and the `.pt-check` mark, which is always in
the DOM at `opacity:0` so the row doesn't reflow when it becomes selected.

**The price bar must stay a bar.** `.pt-bar` is a 5px rule under the number,
sized to the price and min/max-normalised **within its own term group** (a
month compares only to the other months). It was first built 22px tall behind
the number, which read as an input field rather than a measurement — height is
what separates those two readings, so keep it thin.

**The bar is absolutely positioned, and must stay that way.** In normal flow
it becomes a second item in the cell, so the cell centres a *number + bar*
stack while every other cell centres just its number — which lifts the price
4px above the rest of its own row. `.pt-row > div` carries `min-height:44px`
purely to reserve the strip the bar hangs in; without it the bar overlaps the
number instead. The earlier fix of adding `padding-bottom` to the price cell
alone is the wrong lever — it makes that one cell taller than its siblings and
steps the row's separator line (see below).

**Every cell in a row must be the same height, or the row's separator line
visibly steps between columns.** `.product-table` is `align-items:stretch` and
`.pt-row > div` is a flex box centring its own content — that pairing is what
keeps one straight line across all five columns. Two things broke this and
would break it again: `align-items:center` on the grid (each cell then sizes
to its own content, so its border-top and wash land at its own height), and
giving one cell extra padding to make room for an absolutely-positioned bar.
Putting the bar in normal flow removed the need for that padding entirely.
Note `.pt-row > div` (0,1,1) out-specifies a bare `.pt-price` (0,1,0), so a
per-cell override of `align-items` or `flex-direction` must be written
`.pt-row > div.pt-price` or it silently loses.

**Each table carries its own colour**, scoped by `.shape-table-base` /
`.shape-table-peak` over the background, shadow, heading, group labels, hover
and the full selected set:

| | Base | Peak |
|---|---|---|
| hover / selected accent, bar | `--pp-blue-300` (one tier for both) | `--pp-coral` hover, `--pp-coral-value` selected |
| text (heading, group labels, selected price) | `--pp-blue-500` | `--pp-coral-text` |
| background | blue-300 at 8% (`#eff6ff`) | `--pp-coral-bg` |

Blue's background is a hand-computed blend because the blue ramp has no `-bg`
tier; coral ships one, so it reads its token directly. `--pp-coral-value`
(`#c77048`) exists because raw `--pp-coral` is only 2.25:1 against white —
below the 3:1 floor a border or mark needs. It is `darkenHex("#FF8F5C",
0.22)`, the same value the hatch texture already computes for this hue.

**CSS source order matters here.** The `.shape-table-* .pt-row:hover` rules
must sit **before** the `.shape-table-* .pt-row.selected` rules. Both are
three class-level selectors, so a tie breaks on source order alone, and a row
that is both hovered and selected must keep showing selected.

`shapeTextColor(shape)` survives as a function only because
`buildPriceReadout()` sits outside both tables and needs it; the tables
themselves take their colours from CSS.

**Buy and Sell price differently.** `portal-trade-link.js` exports
`SELL_SPREAD = 0.02` and `sellAdjustedPrice(price, direction)`, returning
`price × (1 − SELL_SPREAD)` for `"sell"` (case-insensitive), the price
unchanged otherwise, and `null` untouched. It is called from exactly two
places, and both matter — a Sell request must show the number it submits:

- `resolvePeriod(wizard, opts)` applies it to `row.base`/`row.peak` before
  returning, so `buildRequest()` needs no change of its own.
- `getSelectedWizardPeriod()` returns a **new object** (never the shared
  `WIZARD_PERIODS` row) with both prices passed through the same function.
  `buildWizardProductGroup()` calls it per row **before** the group's
  bar-width normalisation runs, so a Sell group's bars stay proportioned to
  Sell's numbers — and because Value is computed from that same adjusted
  price, the whole row moves together. That is the one invariant here worth
  re-checking after any edit: price, bar and value must all read one number.

There is deliberately no second implementation in `customer-portal.html`.
The Back Office's market-reference cards read `WIZARD_PERIODS` directly by
label and are not in this path — the desk's indicative figure stays at the
flat quoted price on purpose.

#### Step 2 — connection & volume

A card grid (`.conn-grid` / `.conn-card`), not a `.grid-table` — bespoke
classes used nowhere else, so this layout has no effect on any other list.
Selection is a real `<input type=checkbox>`, which already shows checked
state unambiguously, so there is no extra badge on top of it.

`state.wizard` carries `connIds` (array) and `volumeMw`.

- **The volume input is the total**, however many connections it is spread
  across. `wizardTotalMW()` returns `state.wizard.volumeMw` with no
  arithmetic; `wizardSettlement()` and the review step read that function
  rather than the raw input, so they follow automatically.
- **`wizardVolumes()` splits that total** evenly across `connIds`, with the
  last id absorbing the rounding remainder, so the map sums back to exactly
  the input (0,30 across two connections publishes 0,15 + 0,15, not
  0,29999999999999996). `buildRequest()` has always just summed this map and
  has never needed changing. The same last-absorbs-remainder technique is
  used by `deriveConnRows()` in the back office.
- **Minimum and step are both 0,01 MW** (`MIN_VOLUME_MW`, `VOLUME_STEP_MW`,
  and the `<input min step>` attributes). `commitWizardVolume()` snaps to the
  grid on blur; `wizardVolumeValid()` gates Continue.
- The input is a stepper reusing the wallet screen's `.amount-input-wrap`
  shape, with flanking `−`/`+` buttons (`stepWizardVolume(dir)`) that snap the
  same way so repeated clicks can't drift off the grid. Native spin arrows are
  hidden. The decrement button disables itself at the floor.
- **Each card shows the full EAN**, read live from
  `PortalSeedData.CONNECTIONS` by id — not duplicated onto
  `WIZARD_CONNECTIONS`, which would be a second copy free to drift. Only
  Breda carries an extra `note` ("ends 31 Dec 2026").
- **CURRENT COVER is real**, not a seed string: `connectionCoverMw(connId,
  periodStart, periodEnd)` sums every block from `hedgeBlocksFor(connId, …)`
  whose period overlaps the **currently selected** delivery period, and
  renders it as a `.cc-pill` — blue when covered, grey when not, amber
  carrying the reason when the connection is ineligible. `hedgeBlocksFor()`
  does not date-filter its static half, so the overlap test is this
  function's job. A negative figure (a sold block reducing net cover) is
  shown as negative, not clamped.
- `Select all` / `Clear all` sit above the grid, styled as opposites —
  `.btn-select-all` tinted blue, `.btn-clear-all` neutral outlined. Select
  all's hover inverts to a solid blue-700 fill with white text; the previous
  blue-050 → blue-100 hover was three RGB units of change and invisible.

**Two reasons Continue can be disabled need two messages.** `VOLUME_HINT`
covers an invalid volume, `NO_CONNECTION_HINT` covers an empty selection
(only reachable via `Clear all`); `wizardVolumeHint()` picks between them.

**`wizardAllocationNote()` returns `""` when 2+ connections are selected** —
the checked cards already say which ones. The single-connection message stays,
because it says what happens next rather than which connection. An empty
banner must **hide**, not render blank, and that has to be handled in **both**
`buildWizardVolumeTable()` (full re-render path, e.g. toggling a connection)
and `refreshWizardVolumeUi()` (live-patch path, e.g. typing a volume). Fixing
only the first leaves a real bug: clear the field with 2 connections selected
to show the amber hint, then type a valid volume, and the banner stays visible
and empty.

**Ineligible connections get no checkbox**, and `toggleWizardConnection()`
refuses them — the guard is in the handler, not only in the markup. Same for
`selectAllWizardConnections()` and `clearWizardConnections()` while locked.

**Only the row carries a click handler.** The checkbox has none of its own: a
click on it bubbles to the row, so two handlers would toggle twice and a
direct checkbox click would appear to do nothing.

**Locked mode** (`state.wizard.lockedConn`) renders only that connection, its
checkbox checked and disabled, with a `.locked` class at full opacity —
unlike `.not-eligible`'s dimmed 0.55, because this row *is* the trade. The
toolbar is omitted entirely.

**Why the volume field does not call `renderApp()`:** it used to, and the
field could not be typed into — a full re-render rebuilds the `<input>`
mid-keystroke and steals focus. `setWizardVolume()` and `stepWizardVolume()`
patch in place through `refreshWizardVolumeUi()`, which targets
`#wizard-volume-note`, `#wizard-vol-dec` and `#wizard-continue`. Keep those
ids, and give any new live-edit field the same treatment.

`joinWithAnd()` (Oxford "A, B and C") is the single helper for naming the
selected connections — used by `wizardAllocationNote()`,
`wizardSummaryRows()` and `submitWizard()`'s timeline text, facts and
`connName`, so four call sites can't drift in style.

**Testing focus-dependent CSS on this page: use `page.click()`, not
`page.focus()`.** Playwright's `.focus()` bypasses the normal event pipeline
and loses focus within ~200ms here; `.click()` on the same element holds it.
A `:focus-within` rule that looks broken under a `.focus()` test is not
evidence of a bug.

### Consumption screen

The only screen backed by real calculated data. It filters by an arbitrary
From/To date range — the old fixed Day/Month mode toggle is gone.
`tilburg-gas` is excluded everywhere real usage data is used.

#### Where the controls live

There is no single controls row. Each control sits with what it filters:

| Control | Lives | Because |
|---|---|---|
| Site `#site-select` | page level, by the title | it changes everything on the page |
| From/To + Day/Month/Quarter `#from-date` `#to-date` | the usage-chart card's toolbar | they filter the charts and table |
| Zoom `#chart-zoom` (`#zoom-out`/`#zoom-in`) | same toolbar, right of the presets | it changes how closely the already-filtered range is viewed |
| Export CSV `#export-csv` | the interval table's summary row | export belongs with what it exports |

**The ids are the contract, not the DOM position.** These elements are
acquired once by `getElementById` and nothing reads their parent, position or
container class — which is why they could be moved without touching
`goToConsumption()`, the presets or the export. Keep the ids if you move them
again.

**The Consumption header writes an empty crumb rather than skipping it.**
This is the one screen that doesn't route its chrome through
`renderTopbarChrome()`, so omitting the assignment leaves whatever the
previous screen set — open a connection, click Consumption, and its EAN sits
above the title looking like a real breadcrumb. All three Consumption paths
assign `""`.

#### Date-range filter

From and To `<input type="date">` plus Day / Month / Quarter presets. From/To
are the single source of truth for everything rendered. The presets are
one-shot actions, not modes: each snaps the range to the day, month or
quarter containing the current To date, clamped to coverage, after which
either date can be edited freely. A preset highlights only while the range
matches it exactly, so a custom range leaves all three unhighlighted. A
reversed range (From after To) is treated as empty and says so, rather than
being silently swapped.

Chart selection follows the range's **day count**, not a mode flag: one day
renders the container-width chart with time-of-day labels, any multi-day
range renders the scrollable chart with per-day gridlines. A partial trailing
month needs no special case.

#### Position panel

`renderPositionPanel(stats, range)` renders one two-column panel — cost as a
headline figure on the left, a Covered/Short/Long composition bar on the
right, built from the actual selected range. It replaced six flat stat cards.

**"Covered" is derived, not a `computeDayStats` field:** `coveredKwh =
actualUsageKwh − shortKwh`. This holds for every interval and therefore for
any sum of them, because `min(actual, hedge) + max(0, actual − hedge) =
actual` whichever of the two is larger. `hedgeVolumeKwh − longKwh` gives the
same number, which is the check that it's right.

Segment widths clamp at 0 for the **bar's width maths only** — a heavily
net-exporting range can drive the true value negative, which no proportional
bar can show honestly either way. In-bar segment labels drop below 8% width
and their `%` suffix below 20%; the legend underneath always carries the real
number.

Colours match the chart directly above: Covered blue-700, Short red, Long
teal. Cost is red for an additional cost, green for savings, neutral at zero.

`.position-panel` needs `flex:1; min-width:0` — `#stat-row` is a flex row, and
a flex item with no grow shrink-wraps to its content instead of filling.

`statCardHtml`, `statGroupHtml`, `costCertaintyOpts` and the `.stat-card` /
`.stat-group` / `.stat-equation` CSS all stay: `statusCardHtml()` (loading /
no-data / error) still renders through them.

#### Usage chart

Two lines — actual usage (solid blue-500 `#006ECF`) and hedge volume (dashed
violet `#9151B8`) — with each interval drawn as a stacked bar from the zero
baseline:

- a blue-700 `#004C94` segment at 45% opacity from zero to `MIN(Actual Usage,
  Hedge Volume)` — the covered portion;
- topped by the gap between the two lines: red `#F24F4F` at full opacity when
  Uncovered ≥ 0 ("Short — bought at day-ahead"), teal `#0FA69D` at full
  opacity when Uncovered < 0 ("Long — sold at day-ahead").

Consumption and production are not plotted. The y-axis is bipolar — a real
zero baseline, so intervals where Actual Usage goes negative read correctly.

#### Cost chart

A second chart over the same intervals plotting money, in its own card below.
It uses the **same grammar on purpose**:

| | usage chart | cost chart |
|---|---|---|
| solid blue-500 line | Actual Usage | Total Cost |
| dashed violet line | Hedge Volume | Hedge Cost |
| bars spanning the gap | Uncovered (red short / teal long) | Delta Cost (red buy / teal sell) |

The parallel is exact, not decorative: `Total = Hedge + Delta`, so the gap
between the two lines **is** Delta Cost, exactly as the gap between usage and
hedge volume is the uncovered volume.

There is deliberately **no fill down to zero** here. The usage chart's covered
band marks a real quantity; `MIN(hedgeCost, totalCost)` is not a meaningful
figure, so drawing it would spend a colour on nothing.

Buy/Sell is encoded by colour **and** by which side of the hedge line the bar
sits on, and named in the tooltip, so colour is never the only cue.
`COST_BUY_FILL` is kept byte-identical to the usage chart's Short hex:
`hatchId()` derives the `<pattern>` id from the hex string, and SVG id lookups
are document-global, so the cost chart's provisional bars reuse the pattern
the usage chart's `<defs>` already defined. Keep the two hexes identical or
that reuse silently stops.

#### A hedge is a step, not a ramp

Every block-shaped series is drawn as a stair by `stepPoints()`: a flat run
across each interval's width, with the riser on the boundary. A block is
either held for an interval or it is not — a peak block goes to full at 08:00
and to zero at 20:00. Plotting one point per interval anchor and letting the
polyline interpolate drew a diagonal across the 15 minutes either side of
each boundary, claiming a partial position nobody holds.

This covers hedge volume and hedge cost on all four chart builders plus the
dashboard mini chart. It deliberately does **not** cover actual usage or total
cost — those are continuous quantities where a connecting slope is honest.

A stepped line ends at the last interval's **right edge**, half a bar past
where a sampled line ends; stopping at the centre would imply the block
lapsed halfway through its final interval.

#### Chart geometry

**Single-day charts size to their container.** `buildChartSvg` /
`buildCostChartSvg` take a trailing `width` and derive all geometry from it;
`dayChartWidth()` measures `#day-chart-wrap`, and `drawDayCharts()` sets the
SVG's `viewBox` **and** `style.width` to that same pixel value, so the scale
is exactly 1:1.

Don't "simplify" this to `viewBox` + `width:100%`. The original bug was not
the hardcoded `960`: with a `viewBox` set and the height pinned at 260px, the
browser's default `xMidYMid meet` scaled to the shorter axis and letterboxed
the sides. `width:100%` would fill the space but scale stroke widths and label
text with it. Rebuilding the geometry at the measured width keeps strokes at
1–2px and labels at 9–10px at every size. A `ResizeObserver` redraws through
`requestAnimationFrame`, guarded on `lastDrawnDayWidth`.

**The range chart fits its container, then zooms.** `rangeChartGeometry(n)` is
the single place both range charts get `width` and `pxPerInterval` from —
calling it once per redraw and handing the identical result to both is what
keeps them aligned:

```js
function rangeChartGeometry(n) {
  var wrapWidth = Math.max(monthChartWrap.clientWidth || 0, 480);
  var fitPx = n > 0 ? wrapWidth / n : RANGE_PX_PER_INTERVAL_MIN;
  var basePx = Math.max(RANGE_PX_PER_INTERVAL_MIN, fitPx);
  var px = basePx * state.chartZoom;
  return { width: Math.max(wrapWidth, n * px), pxPerInterval: px };
}
```

`fitPx` makes the content exactly fill the container. Flooring at
`RANGE_PX_PER_INTERVAL_MIN` (4) keeps a long range (a quarter is ~8,700
intervals) scrollable rather than squeezed to sub-pixel bars.
`buildMonthChartSvg` / `buildMonthCostChartSvg` take these with **no
fallback**, so a caller that forgets them fails loudly instead of silently
drawing at an old hardcoded width.

Zoom is `state.chartZoom`, a doubling multiplier (`ZOOM_MIN` 1 to `ZOOM_MAX`
8) on the `−`/`+` buttons, shown only for multi-day ranges. It never goes
below 1 — narrower than fit would reintroduce the dead-space bug.
`setChartZoom()` redraws and resets both charts' scroll to 0. `render()`
resets `chartZoom` to 1 on every genuine range or site change; zoom clicks and
resizes redraw through `drawMonthCharts()` directly and never touch
`render()`, which is why they don't hit that reset.
`scheduleMonthChartResize()` observes `#month-chart-wrap` and redraws on
container resize, guarded on `lastDrawnMonthWidth` — without it, a window
resize leaves the chart at the width it first fit to.

**The two range charts must keep identical geometry** (same `width`,
`pxPerInterval`, `plotW`, `stepX`, `barW`). They sit one above the other and
share a synced crosshair, so any difference visibly misaligns them. That was
wrong once, when the cost chart used its own `stepX = 3`. **No checked-in
test covers this** — nor the hatch threshold or the table's column order.
`costChartBody()`'s `anchorOffset` parameter is what lets one body serve both
the day chart (anchor `barW/2`) and the range chart (anchor `0`).

`barWidthFor(pitch)` is shared by all four builders: a 2px gap between
touching bars, tapering to a quarter of the pitch on dense ranges. Don't
hardcode a width in one builder.

**Scroll sync:** `#month-chart-wrap` and `#cost-month-chart-wrap` mirror
`scrollLeft` onto each other on `scroll`. Assigning a value it already holds
doesn't re-fire the event, so no re-entry flag is needed.

#### Chart interaction

The four chart elements are `#day-chart` / `#month-chart` (usage) and
`#cost-chart` / `#cost-month-chart` (cost), each with its own `-crosshair`
and scroll wrapper, plus one tooltip each: `#chart-tooltip` and
`#cost-chart-tooltip`.

**Hover marks one chart only.** Hovering shows that chart's crosshair and
tooltip and clears the other's. This reverses an earlier design where both
moved together — the product owner found the dual crosshair too noisy.
`CHARTS` and `clearHover()` remain because `render()` still has to clear a
stranded crosshair on the hidden variant, and the shared
click-to-highlight-row path runs through the same registry.

Each tooltip covers only what its own chart plots, selected by `context.kind`:

| Usage chart | Source | Notes |
|---|---|---|
| Hedge | `hedgeVolume` | |
| Usage | `actualUsage` | labelled "Usage" |
| Short *or* Long | `short`/`long` | **omitted when 0** — mutually exclusive |

| Cost chart | Source | Notes |
|---|---|---|
| Hedge | `hedgeCost` | |
| Buy *or* Sell | `deltaCost` | label follows the sign; reads "Buy / Sell" at exactly zero |
| Total | `totalCost` | |

Clicking either chart highlights and scrolls to that interval's table row; the
selection persists until the next click or until the site or either date
changes. One function drives all four variants using a cursor-position →
nearest-interval calculation, not per-mark listeners, so it scales to ~8,700
points.

#### Interval table and CSV

A Date column (short format, e.g. "5 Aug 2026") comes first — on a single day
every row repeats it; on a multi-day range it's what disambiguates repeating
`HH:MM` values. The Time column shows the interval's **end**, and the CSV
writes the same label, or the file and the screen would name the same row
differently. Time and EPEX read in the mono stack (`td.mono`); Short and Long
carry their chart hue as text (`td.short`/`td.long`) at the text tier, not the
fill tier. Density is head `9px 12px` @10px, row `11px 12px`.

**The column order is depended on in four places, and three fail silently:**
`<thead>`, `renderTable()`, `CSV_COLUMNS`, and the group-boundary rule
`thead th:nth-child(3)/(8)/(14)` that draws the identity / metered / position
/ money separators. Those indices are positional. Add, remove or reorder a
column and every boundary after it shifts, the rules land mid-group, and
**nothing fails** — no test asserts it. There are currently **17** columns.
Update `<thead>`, `CSV_COLUMNS`, the three indices and their comment in the
same change.

The table is a collapsed `<details>` disclosure. Two rules around it:

- The collapse is **CSS/`<details>` only — rows always stay in the DOM.**
  `highlightTableRow()` queries `tr[data-idx]`, so conditional rendering
  breaks chart-click-to-row silently.
- `highlightTableRow()` **force-opens the disclosure before scrolling**,
  because `scrollIntoView` under a closed `<details>` is a no-op. Nothing
  throws in either failure mode. Note **jsdom does not implement `<details>`
  hiding** and reports `display:block` for closed content, so a
  computed-style check there passes vacuously.

**CSV export** writes exactly the table's 17 columns in the table's order, and
every row of the current range — the full filtered dataset, not just what's on
screen — named `consumption_<siteId>_<from>[_to_<to>].csv`. Values are
**unformatted** (dot decimal, no thousands separators, 6 decimals) so the file
parses regardless of locale; a UTF-8 BOM is prepended for Excel. The button is
disabled whenever the range is empty and uses `.btn-primary`.

#### Three numbers not to tidy

Each was arrived at by rendering and looking, so changing one on aesthetic
grounds undoes something measured.

- **`--text-hero` (32px) on `.stat-card.result .value`.** Result and component
  cards were both 23px, so an equation read as three equal figures rather than
  "these two make that one". Watch for stale duplicate rules — one was already
  found silently overriding the new size.
- **Cost chart 190px vs the usage chart's 260px.** Only the height differs —
  every horizontal value (`padLeft`, `width`, `plotW`, `stepX`, `barW`) is
  byte-identical, because the shared crosshair depends on x alone.
- **`HATCH_MIN_BAR_WIDTH = 5`.** Below 5px the 45° hatch tile is
  sub-resolution, so SVG renders it as a flat wash indistinguishable from a
  solid fill — verified by screenshot and pixel crop, which is the only way it
  surfaces. Drawing an illegible texture is worse than omitting it, because it
  claims a distinction the pixels don't carry. Texture is one of four
  redundant cues, so dropping the one that can't render loses no meaning.

**One breakpoint, at 760px** — the page's only `@media` rule. Everything else
responsive is emergent (`flex-wrap` + `min-width` + `flex:1`, plus the day
chart's `ResizeObserver`), which is fine until wrap *position* carries
meaning. It does in three places: the equation, the chart toolbar and the
table summary row. Below 760px those stack. There is no small-screen layout
and none is intended — this is a desktop trading tool. Known and accepted: the
chart SVGs overflow the viewport below ~950px.

### Looking past the end of the data

The From/To range extends to the furthest of three things — any hedge block's
`periodEnd`, any confirmed live trade's `periodEnd`, or
`PortalSeedData.WIZARD_PERIODS.year`'s furthest `end` — not the dataset's
coverage. `MAX_SELECTABLE_DATE` is computed from those at load, so the inputs
reach as far as `indicativeEpexFor()` and `usage-projection.js` can actually
price and project.

Three different things are known past 2026-08-05, and the design turns on
keeping them apart rather than flattening them into one idea of "future":

| | Source | Certainty |
|---|---|---|
| **Hedge volume & hedge cost** | the blocks + the calendar | **Real.** Never marked projected — they depend on the contract price, never on metering or spot. This is why a block's volume for any period falls out for free |
| **Usage, Uncovered, Long/Short** | `usage-projection.js` | **Projected** from that site's own history. Marked everywhere |
| **Delta & total cost** | `indicativeEpexFor()` | **Indicative** — priced off the portal's own quoted forward curve |

`computeIntervalRow` nulls each field **independently**, not all-or-nothing:
usage-derived columns compute whenever consumption/production are known
(measured or projected), while cost columns stay null whenever EPEX is
unknown. `computeDayStats` carries `intervalsWithUsage` / `intervalsWithCost`
/ `intervalsTotal` to match.

**A trap in those counters:** `intervalsWithUsage` counts *projected* usage
too — it means "has usage numbers", not "was measured". Measured-ness comes
from the day counts (`realDayCount`/`totalDayCount`); only priced-ness can be
read off the interval counters. Conflating them made a wholly-projected
September look wholly measured.

`usage-projection.js` averages a site's own consumption/production per
time-of-day, weekday vs weekend, across all 217 measured days. It is
deliberately **not** seasonally adjusted — the data stops in August, so a
November date has no same-month history. That limit is surfaced in the UI
label, not just in a comment.

**Forward pricing.** `indicativeEpexFor(date, time)` reads
`PortalSeedData.WIZARD_PERIODS` — month rows, then quarter, then year
(most-specific first, since a month and its containing quarter and year can
all cover one date) — and picks base vs peak through
`ConsumptionCalc.isPeakInterval()` rather than a second copy of the
peak-window rule. A forward curve embeds a risk premium, so it is not the same
claim as realised spot; every figure priced this way is labelled
*indicative*. Withholding forward cost was tried and rejected — it emptied
Total cost, the headline figure, on exactly the ranges this view exists to
show.

**Known gap: August 2026 has no quote.** The seeded month rows start at Sep
2026 and the earliest year row is Cal 2027, so 2026-08-06..08-31 has projected
usage but no forward price. Those intervals are excluded from cost and the
card says so ("excludes 26 days with no quoted price"). This is missing demo
data, not a code defect — adding an Aug 2026 row to `WIZARD_PERIODS` fixes it.
**Do not** paper over it by extrapolating a neighbouring month's price.

Cost labels must describe what the calculation *did*, not what was intended.
An earlier version read "26 of 31 days indicative" for a range whose 26
forward days were in fact unpriced and silently dropped — a figure that omits
most of its own range while implying it covers it is worse than a blank.

**The chart draws positions, and nothing but positions.** Only a `Confirmed`
trade is drawn, as part of the hedge via `confirmedBlocksForRange()`, which
uses `blockForOffer()` to turn a confirmed trade into a real hedge block. Every
other stage — awaiting price, offer received, accepted, rejected, expired,
failed — draws nothing. There is no provisional-offer overlay: a trade the
desk has not executed is not a position, and its status is already legible on
Trading and the Dashboard.

Restoring an overlay means restoring all of it — the band, the boundary
markers, the legend and the tooltip wording are one vocabulary, and shipping
the line alone leaves an unexplained dotted stroke.

**Read the hedge through `hedgeBlocksFor(siteId, from, to)`, never
`DATA.hedge[siteId]` directly.** That helper is the one place the contracted
blocks and the confirmed live trades are joined; going around it silently
drops confirmed trades out of the line, the cost and the coverage. A confirmed
trade is signed by direction (a sold block is negative) and priced at its firm
offer price, so `computeIntervalHedgeVolumes` sums it alongside the contracted
blocks with no special case. `MAX_SELECTABLE_DATE` counts confirmed trades
too, or a position past every contracted block would sit beyond the To input's
max and be unreachable.

**Testing this needs stated numbers, not pixels.** Two traps: several dashed
polylines are in the DOM at once and the *dashboard mini chart* comes first,
so "the first match" is a constant that never moves; and the y-axis is shared,
so adding a line rescales it and every other line shifts in pixels while its
value is unchanged. Assert on the Hedge volume figure instead — a confirmed
BUY of 1 MW over Q4 2026 moves it by exactly 2.208 MWh, a SELL by −2.208.

### Measured vs projected — how it's shown

One vocabulary for "how sure are we this mark is real", applied on top of
whatever category hue is already in play. It never replaces the hue.

Dash is already spent on category (dashed violet = Hedge, solid = Actual
Usage/Total Cost), so certainty can't also use dash on those lines. Texture is
the primary channel here for a distinct meaning, so it renders by default
rather than behind an accessibility toggle.

**Projected marks carry all of these together**, never just one:

1. **Opacity** — fills and strokes at 55% (`CERTAINTY_PROVISIONAL_OPACITY`).
2. **Texture, fills only** — a 45° hairline hatch, 6px pitch, inked in the
   fill's own hue one step darker, never a new hue. Computed as
   `darkenHex(hex, CERTAINTY_HATCH_DARKEN)` (0.22, an RGB × (1 − 0.22)
   multiply) rather than a second hardcoded table, so it tracks automatically
   if a fill hex changes. Dropped entirely below `HATCH_MIN_BAR_WIDTH`.
3. **Stroke pattern, lines only, and only where no category dash exists** —
   the projected segment of the usage/total-cost line switches to a fine dot
   (`stroke-dasharray: "1,3"`), distinct from the hedge line's `"5,3"`.
4. **Boundary marker** — mandatory whenever a chart mixes states: a 1px solid
   vertical rule (`var(--pp-border-strong)`) at the transition x, with
   "Measured" / "Projected" labels above the plot in 10px
   `var(--pp-text-faint)`.
5. **Legend** — a solid "Measured" swatch beside a hatched-and-dotted
   "Projected" one.
6. **Tooltip** — says "Projected" in words, never relying on the visual alone.

**Stat cards and the position panel** can't hatch text, so they translate the
same idea using existing neutral tokens only — no new hex, and never a tone
colour, so "projected + short" and "projected + negative" don't read as two
different treatments:

- **Whole-card or whole-panel marker** (`.stat-card.projected`,
  `.position-panel.projected`): `border: 1px dashed
  var(--pp-border-strong)` in place of the solid border, plus `background:
  var(--pp-surface-alt)`.
- **Inline split in a sublabel** (e.g. "€ 3.200,00 measured + € 1.588,62
  projected"): the projected clause drops to `var(--pp-text-faint)`.
- **Badge:** `.badge.neutral` reading **"Projected"**.
- A component card in a mixed row that is itself fully measured gets none of
  this — only a figure that actually mixes states is marked.

**For a mixed range the bold value is the measured portion only**, never a
measured+projected sum; the projected part is the sublabel's "+ €X projected".
A summed headline would give a partly-guessed figure full-certainty
typography. A **fully projected** range is the degenerate case: with no
measured portion to anchor against, the value itself renders at the reduced
opacity with the "Projected" badge attached directly.

**Hedge volume is exempt everywhere** — chart and cards alike. It's a real
booked position, not date-dependent, so it never gets the projected treatment
regardless of the range in view.

## Design system

The reference is a Claude Design project, **peakpower-trading-design-system**,
read directly through the `claude-design` MCP tools — its `readme.md` is a
complete prose spec (palette hexes, typography, spacing, radii, layout,
shadow, interaction states, content rules). Read it again before touching
visuals; this section summarises it.

The design project's `.dc.html` files render through a componentised runtime
(`_ds_bundle.js`, ~266 KB). That runtime was **not** brought in — this folder
stays build-free, and that outranks matching the project byte-for-byte. What
was ported is the design itself, reimplemented in this file's vanilla JS/CSS,
keeping every id, class name and state function intact.

`Customer Portal - Preview.html`'s `:root` defines **only colour tokens** (36
of them) — the `--space-*`, `--radius-*` and `--text-*` scales are the
rebuild's own addition. The two mockups are frozen at the original palette and
were not edited. **Don't "fix" a live page's colour back to a mockup value.**

### Palette (SB-2026)

Identical `:root` in `customer-portal.html` and `back-office-portal.html`.

| Role | Value |
|---|---|
| App canvas | gradient `#eef3f9 → #f7f9fc` (`--pp-bg-gradient`, `background-attachment:fixed`) |
| Surface / border / text (heading·body·faint) | `#fff` / `#dde4ed` / `#2D3F54`·`#52647A`·`#8b98aa` |
| Sidebar chrome | `#2D3F54` bg, `rgba(255,255,255,.10)` active row — colour comes from the nav dot, not the row |
| Brand / primary button / brand figures | `#004C94` (blue-700) |
| Links / actual usage | `#006ECF` (blue-500) |
| Confirmed / coverage / accept | `#1DBD8E` (mint) |
| Long / surplus | `#0FA69D` stroke and text-safe; `#00D4C6` fill-only |
| "Corrected" / info badges | `#9151B8` (violet) |
| Status amber / green / red | `#EEB72B` / `#1DBD8E` / `#F24F4F`, each with its own `-bg`/`-border`/`-text` |
| Card shadow | `--pp-shadow-card`: `0 1px 2px rgba(45,63,84,.06), 0 10px 28px -18px rgba(45,63,84,.28)` |
| Radii | sm 6 / md 8 / lg 12 |
| Layout | sidebar 236px / topbar 64px |
| Focus ring | `var(--pp-blue-300)` border + `rgba(60,147,250,.22)` glow |

Typography (`--text-*`, the 10/11/12.5/13.5/15/17/23/32/44 half-pixel scale)
and spacing (`--space-*`, 4/8/12/16/20/24/32/40) match the spec as-is.

### Two colour rules that bite

**A bright hex is a fill; anything that becomes text needs the darker tier.**
A `#00D4C6` fill is 1.9:1 as text. Every `color:` reads the paired `-text`
token (`--pp-green-text`, `--pp-red-text`, `--pp-amber-text`,
`--pp-orange-text`); `--pp-cyan` has no `-text` pair, so text uses
`--pp-teal-text`, the same role one tier darker. The one exception is
`--pp-teal-600`/`--pp-teal-700`, which alias to blue-700 and the spec
explicitly allows as text. `.btn-danger` needs `--pp-red-value` (`#C22A2A`)
for its fill, since `--pp-red` is only 3.5:1 for white text — and because
`--pp-red-value` and `--pp-red-text` are the same hex, its hover is a
hand-picked `#9b2222`.

**Legacy aliases carry old variable names forward on purpose** — `--pp-teal-700`,
`--pp-orange`, `--pp-cyan` and friends all hold SB-2026 values, so old code
kept working through a single `:root` rewrite. One thing the aliases don't
cover: `--pp-indigo` used to mean both "the hedge line" and
"corrected/info". Those split — **`--pp-indigo` now means violet /
"corrected" only**, and the hedge role is its own colour. Don't assume
`var(--pp-indigo)` still means hedge.

### Chart roles

| Role | Colour | Token / constant |
|---|---|---|
| Actual usage / total cost line | blue-500 `#006ECF` | `--pp-chart-usage`, `COST_TOTAL_LINE` |
| Hedge volume / hedge cost line | violet `#9151B8` (dashed) | `--pp-chart-hedge`, `COST_HEDGE_LINE` |
| Covered band | blue-700 `#004C94` at 45% | `--pp-chart-covered` |
| Short / buy | red `#F24F4F`, full opacity | `--pp-chart-short`, `COST_BUY_FILL` |
| Long / sell | teal `#0FA69D`, full opacity | `--pp-chart-long`, `COST_SELL_FILL` |

`--pp-chart-peak` (blue-300) is defined and currently unused. The `--pp-chart-*`
tokens are the reference values; the SVG builders carry the literal hexes,
so a recolor touches both.

Short/Long render at full opacity to match the Dashboard hero's composition
bar, which draws the same two roles as flat saturated blocks. The certainty
multiply inside `barFillAttrs` is untouched, so a projected bar still reads
lighter than a measured one. The covered band's 45% is deliberate — it stays
subordinate to the segment above it. Legend swatches carry the same full
opacity as what the chart draws; a paler swatch than the real mark is its own
small lie.

Hedge cost and Hedge volume stat cards use a dedicated `tone="hedge"`
(`--pp-violet`/`--pp-violet-text`) rather than `.brand`, because the
Dashboard's "Coverage — August" card also carries `.brand` for an unrelated
figure. A ratio is not a hedge position.

The tritanopia ΔE figures once cited for the Short/Long pair are stale after
the red/blue/violet recolor — re-run the dataviz validator before quoting a
number rather than trusting an old one.

### Components

Matched to the mockup's bundled styles:

- **Card** — `padding:18px 20px`, title `13.5px/700`, subtitle `11.5px` with
  `margin-bottom:14px` and no `margin-top`. The subtitle is a **sibling** of
  the head, not a child: the head's own `margin-bottom` is 14px, dropping to
  4px when a subtitle follows and carries the remaining 14px.
- **StatCard** — `padding:14px 16px`, `min-width:160px`, label `11px/600`
  `letter-spacing:.04em`, value `23px/700` `margin-top:8px`, sublabel `11px`
  faint `margin-top:6px`. **No `flex:1`** — stat rows size to content and pack
  left. A 3px accent cap in the domain colour comes from `.stat-card::before`,
  which is why the `tone` class goes on the **outer** card, not just `.value`;
  an untoned card gets `--pp-border-strong`. The card's `overflow:hidden`
  crops the bar to the radius.
- **Badge** — `11px/600`, `padding:4px 12px`, pill radius, `line-height:1.2`,
  **no letter-spacing**, and every tone carries a real 1px border.
- **Button** — `13px/600`, `padding:10px 20px` (`.btn-sm` → `7px 14px`/12px),
  `border:1px solid` on *every* variant so primary and secondary match in
  height. `.btn-accept` (the shared offer-banner button) is the accent
  variant: `10px 20px`, 13px, hover `#17a67c`.
- `.banner` (12px/16px, one text run) is the lighter one-line variant;
  `.ds-banner` is the real DS Banner (14px/18px, 14px gap, 22px dot, 13px
  title over 11.5px body). **Not interchangeable.** The shared `.banner`
  is 14px gap, `15px 18px` padding, a 26px `border-radius:8px` icon (a
  rounded square, not a circle), 13px title, 11.5px sub at `margin-top:3px`.
- The design system already defines `.btn-ghost` as a transparent underlined
  link for the dark offer banner — don't redefine that name for a
  light-background button.

Two deliberate divergences, both to protect Consumption, which shares these
classes:

1. The design system's StatCard `critical` tone is orange. Consumption's
   cost cards need red, so they use a rebuild-only `.negative` tone and
   `.critical` stays faithful. Under SB-2026 both now resolve to the same red;
   the two class names are kept rather than merged, to avoid touching every
   call site for a cosmetic no-op.
2. `.stat-row` keeps a 16px gap. The mockup is internally inconsistent here
   (16/14/12px across screens), so there's no single correct value to match.

### Sidebar

The Customer Portal's nav is four labelled groups — **Overview** (Dashboard),
**Position** (Connections, Consumption), **Market** (Prices, Trading),
**Finance** (Wallet, Settlements) — each link carrying a small domain-coloured
square dot (Dashboard blue-700, Connections mint, Consumption blue-500, Prices
amber, Trading blue-300, Wallet teal, Settlements violet) instead of the row
tinting.

The grouping is markup and CSS only: `attachSidebarNav()`'s wiring and
`goTo()`'s active toggle both work off
`document.querySelectorAll("#sidebar-nav a")`.

**Keep it to one `<nav id="sidebar-nav">` wrapping every group.** A first
attempt used four separate `<nav>` elements, one per group, and only the first
carried the id — the other six links silently got no handler and never went
active. Each `<div class="sidebar-group-label">` is a plain non-`<a>` sibling
inside the single nav, which `querySelectorAll` skips correctly.

The Back Office keeps a flat list — the design project's own back-office
recreation is re-tokenised, not restructured.

## Deposit on a bought block

A customer enters a bought block on a **deposit** — a share of its value paid
up front — and owes the **balance** before delivery starts. Default 20%, so a
€ 17.664 block costs € 3.532,80 to enter and € 14.131,20 the day before the
delivery period opens.

The percentage is per customer, set by the desk, obeyed by the portal:

```
Back Office · Customers · Commercial settings  --deposit %-->  Customer Portal
      (peakpower.commercialTerms.v1)                wizard · offer · wallet
```

### The three rules that keep it coherent

1. **Before acceptance the percentage is read live**, so a desk change shows
   up immediately in what the wizard and the offer banner ask for.
2. **At acceptance it is frozen onto the trade** (`PortalTermsLink.buildSettlement`
   → `req.settlement`). A later change must never retroactively alter what an
   agreed trade owes.
3. **Every screen after that reads the percentage off the trade**, never off
   the live setting. `depositPct()` in `customer-portal.html` is therefore
   only ever used for trades that do not exist yet.

`req.settlement` is `{depositPct, valueEur, depositEur, balanceEur, dueDate,
paidAt, paidBy}`. The balance is the **remainder**, not its own percentage
calculation, so deposit + balance = value exactly — at 33,33% two independent
roundings would miss the total by a cent on every screen showing all three.

### Where it shows up

| Portal | Screen | What |
|---|---|---|
| Back Office | Customers · Commercial settings | The editable **Deposit on a bought block** field (`key: "depositPct"`). An unusable value (blank, negative, over 100, words) **refuses the whole save** and keeps the form open; the field goes red |
| Back Office | Customers · detail | A **BALANCE OUTSTANDING** stat card, only when there is one |
| Back Office | Wallets | An **OUTSTANDING** column between MINIMUM and STATUS, red with an "N overdue" sub-line when late |
| Customer | Wizard steps 2 & 3 | Deposit and balance rows with the due date, and the balance box's "Deposit reserved" line |
| Customer | Firm-offer banner | "Accepting reserves € X (20 %) now · balance € Y due …", with Accept **disabled** when the deposit exceeds available balance |
| Customer | Trade detail | A **Payment** card: value, deposit paid, balance, due date, a **Pay balance** button, and the state in words |
| Customer | Wallet | A **Balance outstanding** stat card and an **Outstanding balances** table, soonest due first |
| Customer | Dashboard | A stat card, and a red/amber banner when a balance is overdue or within 14 days |

The wizard's funds check gates on the **deposit**, not the full value — before
that a 20% term was meaningless because you still needed 100% in the wallet to
pass step 2. An insufficient wallet names the shortfall and links to the
deposit flow rather than only refusing. `wizardGoStep2()` and `submitWizard()`
**re-check it themselves**, so the rule survives a call that bypasses the
disabled button.

### Two things called settlement

There are no invoices in this model — the monthly document is a **settlement**.
That puts the word on two different things:

| | means | called |
|---|---|---|
| The monthly document | the period's reconciled energy lines | the Settlements screen, `PortalSeedData.SETTLEMENTS`, `state.settlementId`, `openSettlement()`, ids `STL-2026-08-0042` |
| A trade's payment schedule | deposit + balance frozen onto a bought block | `req.settlement`, `PortalTermsLink.buildSettlement()`, the trade detail's Payment card |

They never meet in one object, so the shared word costs nothing at the call
site — but don't reach for `settlement` as a bare variable name in new code
without saying which one it is.

### Two things called deposit

The wallet's funding flow is called **Deposit** in copy, which puts the word on
two different things:

| | means | called |
|---|---|---|
| Funding the wallet | money the customer sends in | "Deposit funds", "Recent deposits", "Deposit successful", "Minimum deposit is € 10,00" |
| The deposit on a block | the share of a bought trade paid up front | "Deposit (20 %)", "Deposit reserved" |

**Only the copy uses that word.** Every identifier stayed `topup` —
`PP.topUpWallet`, `performTopup()`, `state.topupAmount`, the `#topup-*` ids
and `.topup-*` classes — because the ids are what let `refreshTopupUi()` patch
in place without a re-render, and the classes are the mockup's own geometry.

Where the two senses would collide in one sentence, the copy says what the
money **does**: "Add € 9.385,20 to your wallet to cover the 20 % deposit on
this block", with the link — not the sentence — carrying "Deposit funds →".
"Deposit € X to cover the deposit" reads as a typo.

### Easy to get wrong

- **A Sell has no deposit.** The customer is being paid, so
  `PortalTermsLink.appliesTo()` is false and no schedule is built. Showing
  "balance due" against a sale would invent an obligation.
- **Outstanding is not reserved.** The deposit is reserved on acceptance and
  leaves the available balance; the balance is money still in the wallet
  already committed to a date. The Wallet screen shows both cards side by side
  deliberately — "available" is not "free" once a balance is coming.
- **A confirmed trade still owes its balance.** Confirmation is execution, not
  payment. `confirmTrade()` leaves `settlement` untouched; there is a test
  pinning this.
- **The accept guard is in the handler, not only the button** — a stale screen
  must not accept its way into a negative wallet. Rejecting is never blocked.
- **A missing or corrupt setting falls back to 20%, never to 0.** The safe
  direction to fail in is asking for money we might not need.
- **Commercial settings are per customer** (`state.commercialByCustomer`, keyed
  by `kvk`). They used to be one shared list, which was harmless while every
  field was decorative — but editing one customer's deposit would otherwise
  silently change another's.
- The published request carries `customerId` (`PortalSeedData.CUSTOMER_ID`,
  kvk `34215678`) so the desk joins a trade to a customer by id, not display
  name — the Back Office says "Vandersteen Koeling B.V." and the portal says
  "Vandersteen Koeling".

**Not implemented:** wallet movements are in-memory, so a reload resets the
balances (trade records themselves persist on the link). Nothing is billed,
there is no dunning, and nothing stops delivery when a balance goes unpaid — the
overdue state is surfaced, not enforced.

## Cross-portal trade flow

The one flow spanning both portals, in both directions:

```
Customer wizard  --request-->  Back Office "To price"
Back Office desk --offer---->  Customer Portal firm offer (live countdown)
```

**One record per trade** holds the whole state, so there is a single source of
truth rather than a request list and an offer list to reconcile:

| `status` | meaning | desk queue | customer |
|---|---|---|---|
| `Awaiting price` | submitted, unpriced | To price | "Awaiting price" |
| `Offer received` | priced, window open | Awaiting customer (mm:ss tag) | pending offer + Accept/Reject |
| `Offer expired` | window elapsed unanswered | Awaiting customer ("expired") | "Offer expired" |
| `Accepted · awaiting execution` | customer accepted | **To confirm** | accepted, amber |
| `Offer rejected` | customer declined | *(off the desk)* | rejected, on the timeline |
| `Confirmed` | desk executed it | *(off the desk)* | Confirmed, green, with market reference |

`status` is stored, but **`effectiveStatus(req, now)` is what to render** — an
offer expires on a clock, so the stored string goes stale on its own. A
decision is final and outranks the clock: an accepted trade never later reads
as "expired".

**Transport.** There is no backend, so `portal-trade-link.js` writes requests
to `localStorage` under `peakpower.tradeRequests.v1` (a JSON array, oldest
first). The Back Office reads that key on load and subscribes to the browser's
`storage` event, so a request submitted in one tab shows up in an open desk
tab with no reload and no polling. `storage` only fires in *other* tabs, so
there is no same-tab echo to guard against; a `focus` listener covers the
same-tab case.

Consequences: **same-browser, same-origin only** — two browsers, or a private
window, won't see each other.

Storage failures (quota, private mode) are swallowed: `read()` returns `[]` on
anything unparseable and `write()` returns `false` rather than throwing, and
the Customer Portal wraps `publish()` in a try/catch. **A broken link must
never break either portal's own flow.**

**The return leg.** The desk's request detail has a price form (price €/MWh +
reaction window, defaulting to the request's own indicative price and 30
minutes) with a live total and validation; `sendOffer()` calls
`priceRequest()` and re-publishes under the **same id**, updating the record in
place. Total value is always derived from the request's own computed volume,
so the two portals can't disagree about it.

The Customer Portal calls `syncLinkedTrades()` on load, on `storage` and on
`focus`, rebuilding `state.trades` from the seed plus everything on the link,
with linked records winning on their own ids. `toCustomerTrade()` converts a
record into the portal's *existing* trade shape, so a linked offer renders
through the same banner, countdown and timeline code as the seeded
`TRD-1078` — no parallel rendering path. Rebuilding from the link also means a
submitted trade and its offer **survive a reload**, which the old in-memory
`state.trades` could not.

**Countdowns** recompute from the offer's absolute `expiresAt` each tick
rather than decrementing a counter, so the portals can't drift and a
backgrounded tab doesn't lose time. The desk updates queue tags in place so it
doesn't flicker or clobber a half-typed price. Tone thresholds: ≤5 min
critical, ≤15 min warning, else neutral.

**Accept / reject** are wired to `PP.acceptOffer`/`PP.rejectOffer` **for
linked trades only** — the seeded `TRD-1078` keeps the mockup's `PP.noop()`
stub, since it has no record behind it. `respondToOffer()` re-checks expiry
itself rather than trusting the UI, so a stale screen cannot accept a dead
offer; rejecting an expired offer is still allowed, since declining is always
safe.

**Confirm / fail.** Every card in **To confirm** carries both buttons (the
click `stopPropagation()`s so it doesn't also open the detail). `confirmTrade()`
gives the customer `Confirmed` (green) with an `ICE-…` market reference;
`failTrade()` mirrors it exactly — same guard, same pure new record, same
`"done"` column. Only an **accepted** trade can be confirmed or failed, and
the two are **mutually exclusive in both directions**, so an operator cannot
flip an outcome the customer has already been told about. A failure reads
`Execution failed` in a critical tone with the reason on the timeline; with no
reason it still says the reservation was released and nothing charged, so a
failure is never silent. The desk says "Mark failed" and the customer reads
"Execution failed" — an action versus an outcome, both derived from
`STATUS_FAILED` rather than written twice.

Rejected and completed trades use the sentinel column `"done"`, which no queue
matches, so they drop off the desk without a special case.

Accepted is deliberately **amber**, not green: reserved but not yet executed.
Green is reserved for `Confirmed`.

**What flows.** `submitWizard()` publishes the wizard's real selections —
direction, shape, the selected period with its start/end dates, per-connection
power lines (zero-volume connections dropped), the note, and the indicative
price for that shape. Total volume is **computed**, not carried: `powerMw ×
hoursInPeriod(start, end, shape)`, base counting every hour and peak counting
Mon–Fri 08:00–20:00 only (DST not adjusted for, matching
`hedge_blocks_2026.json`). That formula independently reproduces the mockup's
own hardcoded `1,000 MW → 768,00 MWh` for Peak Q1 2027, which is what
validates it.

Ids continue the `TRD-1079+` sequence, which can't collide with the Back
Office's seeded `TRD-1049…1058`.

**Watch out:** `toDeskCard`/`toCustomerTrade`/`secondsRemaining` take an
optional `now`, which makes them tempting `map()` callbacks — but
`list.map(toDeskCard)` passes the **array index** as `now`. That shipped once
and pinned every countdown to 1970 (tags read `496231:54:45`). `nowMs()` now
rejects any value before 2000 and falls back to the real clock, and there's a
regression test, but still prefer an explicit wrapper.

**Not implemented:** any wallet movement. Accepting says funds are reserved
and confirming says the wallet is debited, but no balance changes.

## Back Office portal (`back-office-portal.html`)

All eight nav entries are navigable and **six are real screens**. Only
`Reference data` and `Audit` are placeholders — the two the mockup itself
leaves unbuilt — rendered with its verbatim wording ("Not covered in this
round of mockups…") in its own treatment. Leaving a screen clears its open
detail, so returning lands on the list rather than a stale record.

| Screen | Source | Notes |
|---|---|---|
| **Home** | `back-office-screens-data.js` | Six StatCards, "Needs attention now", "Exposure", integration health. The three attention rows carrying a `tradeId` really open that trade; the other two are inert, as in the mockup |
| **Trade desk** | live | list / detail; the only screen with a real backend |
| **Customers** | `back-office-screens-data.js` | list / detail (`state.customerId`), with editable Commercial settings. `buildCustomerDetail()` is ported verbatim, including its synthesised branch for every customer other than Vandersteen |
| **Wallets** | `back-office-screens-data.js` | Read-only, plus the live OUTSTANDING column |
| **Settlements** | `back-office-screens-data.js` | Read-only |
| **Data & feeds** | `back-office-screens-data.js` | Read-only |

**Design-system helpers.** `cardHtml` / `statCard` / `badge` / `dsBanner` /
`cardAction` map to `Card.jsx` / `StatCard.jsx` / `Badge.jsx` / `Banner.jsx`.
Every `.desk-*` rule is copied verbatim from the mockup's Trade desk inline
styles: queue gap 18px, card `8px` radius / `14px 16px` padding, mono id
11.5/700 teal-600, tag 10.5/700 `4px 10px` radius 5, meta 11px, value 12/700,
action 10/600 with 10px margin-top; detail column `flex:1.55; min-width:520px`;
list spaced 16px, detail 20px.

**How a screen is wired.** `SCREENS` maps a nav entry to `{ body, chrome }` —
`body()` returns the HTML, `chrome()` returns `{title, subtitle, crumb,
actions}`. The Trade desk is the exception (`{ self }`): it owns two views and
writes its own chrome. `gap20` marks the two screens the mockup spaces at 20px
(Home and the trade detail). The topbar shows a crumb *or* a subtitle, never
both — a detail screen gets the crumb, a list screen the subtitle.

The mockup's source was read by decoding its own gzip+base64 bundle rather
than guessed at from rendered markup, so every ported constant is its literal
value. `Back Office Portal - Preview.html` was **not** edited.

**Three deliberate divergences**, all because the mockup is static and these
screens are meant to work:

1. **Cancel actually cancels.** The mockup's `cancelCommercialEdit()` and
   `saveCommercialEdit()` are the identical one-line stub, so Cancel keeps
   every keystroke. Here `startCommercialEdit()` snapshots the fields and
   Cancel restores them.
2. **`updateCommercialField()` does not re-render** — a re-render rebuilds the
   `<input>` under the cursor and steals focus mid-keystroke. The read-only
   view is rebuilt on Save.
3. **Card `action` labels get the subtitle's type** via `cardAction()`. The
   mockup passes a bare string that `Card.jsx` drops in unstyled, so it
   inherits 16px next to a 13.5px title — plainly unintended.

Two mockup quirks are reproduced rather than fixed, both marked in the code:
the customers list interpolates `c.availableColor`, a key `CUSTOMER_LIST`
doesn't define; and every "Needs attention now" row carries `cursor:pointer`
even though only three are clickable.

The seeded rows (`TRD-1049`, `TRD-1052`) have no record behind them, so
confirming one just adds its id to `state.confirmedSeedIds` and `seedRows()`
filters it out — nothing is written to the link. That's page-local, so seeded
rows reappear on reload while live ones don't; intended, since the seeds are
fixtures. Opening a seeded card shows an explanatory note instead of a detail
view. Live cards get a teal tint and a one-shot pulse.

When this page was first built its `.card`/`.card-title`/`.card-subtitle`
rules were accidentally left out of the extracted CSS and every card rendered
unstyled. There is a test asserting **every class rendered into the DOM has a
matching CSS rule** — worth keeping if more markup is added.

### Derived detail must not out-claim its source

Three rules learned building the desk's trade detail, and they generalise.

**Read the shared source, don't copy it.** The wallet check renders the *same*
`WALLETS` row the Wallets screen does, so the two cannot disagree. The market
reference loads `portal-seed-data.js` for the forward curve rather than
copying the rows. A second copy of a number is a number that will drift.

**Consistent by construction beats consistent by inspection.** The connection
split derives from the trade's own contracted power with the last row taking
the rounding remainder, so the column always sums to the card's figure. It is
labelled *illustrative*, because it is synthesised and no per-connection
metering exists for a seeded trade.

**Correct arithmetic on decorative input is still a fabrication.** A Pricing
card once divided each trade's `valueLabel` by its real delivery volume to
show a €/MWh and a spread. The maths was right; the input was not — those seed
values were authored to look plausible on a card, never to satisfy `value =
price × volume`, so every Q4-26 trade derived around €37/MWh against an €84,20
indication, claiming the desk sells at 44% of market on all of them. **A
single spot-check looks like a real number; only computing every row exposes
it.** Seeded trades therefore show volume and the indication and no price at
all, and the card says why. A *live* record carries `offer.priceMwh`, a
genuinely quoted price, so there the spread is a true statement and is shown.
Do not "fix" the seed values to make a derived figure come out sensibly — they
are a verbatim mockup port.

The mockup's chart is one static `BAR_HEIGHTS` array authored for `TRD-1058`
and stays there. Repeated under every trade it would imply a shape each of
them does not have.

## Conventions

- Timestamps are local Netherlands delivery time in `timestamp`, UTC in
  `utctime`; `is_dst` flags summer-time intervals.
- All power values are **kW** (average over the 15-min interval), not kWh.
- Generated JSON is snake_case; the two original source files kept their
  as-delivered names.
- **No Python files and no build step.** If a task would otherwise call for a
  `.py` script (reshaping data, generating a test dataset), write JS instead —
  a dual Node/browser module if the page needs it, or a one-off ephemeral
  script (not checked in) for pure data prep.
