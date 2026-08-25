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
   `back-office-portal.html` — hand-written rebuilds that actually run, plus
   `customer-onboarding.html`, the flow a customer signs up through before
   either of them exists for them.
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
node portal-trade-link.test.js
node portal-terms-link.test.js
node portal-demo-clock.test.js
node onboarding-flow.test.js
node portal-accounts.test.js
node ean-registry.test.js
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
| `portal-terms-link.js` | Deposit percentage and settlement maths, shared both ways. Tested |
| `portal-trade-link.js` | Carries trades between the portals over `localStorage`. Tested |
| `portal-demo-clock.js` | Shifts what both portals think "now" is, so a demo can reach a date-dependent state without waiting for it. Tested |
| `portal-accounts.js` | Derives who can sign in, and under which company, from the desk's own customer roster. Tested |
| `ean-registry.js` | The unassigned metering points, the search over them, and which company claimed which. Tested |
| `portal-seed-data.js` | Static seed data for the customer screens with no live source |
| `back-office-desk-data.js` | Back-office seeded trades/queues plus `buildQueues()` |
| `back-office-screens-data.js` | Back-office seeded data for Home, Customers, Wallets, Settlements, Data & feeds. **The Customer Portal loads it too**, for the customer roster its sign-in directory is built from |
| `onboarding-flow.js` | The onboarding flow's ten steps and the rules that gate them. Tested |
| `customer-onboarding.html` | The nine-step onboarding flow a new customer signs up through |
| `PeakPower_Funding_Instructions.docx` | The file step 6's **Download deposit instructions** link serves. Served straight from the repo root — see "Download deposit instructions is a real file" |
| `index.html` | The landing page the demo is opened from — one card per page, onboarding leading |
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

`hedge_blocks_2026.json` is hand-maintained: **one row per shape per period
for the whole account**, expressing a hedge as a power (MW) held for a period,
converted to energy (MWh) and to kW/kWh. New rows go straight into the JSON.

**A block has no EAN.** It is bought for the account, not against a metering
point, so there is nothing to group or filter by connection — a row carries an
`id` (`BLK-26xx`), a `direction` and its period/shape/power/price, and that is
all. This replaced a per-EAN model where the same period appeared six times,
once per connection; every screen that split cover by connection was rewritten
with it (see "Blocks belong to the account, not a connection").

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

**The blocks are sized from the measured data so a day carries both legs.**
Every EAN used to hold the same 1 MW base + 1 MW peak, which pinned the whole
portfolio to one state. What matters for the chart is not the monthly average
but **where the hedge line sits inside the day's own load range**: put it near
the daily mean and the overnight trough goes long while the evening peak goes
short, so one day shows short *and* long several times over. That is what the
40 rows are sized to do.

Each block is a multiple of the **account's** mean net load over the period,
and the multiple is what decides the day's character:

| Multiple | Where the line sits | The day reads |
|---|---|---|
| ≈ 1.00 | through the middle of the daily profile | **both** — long overnight, short at the ramps and the evening peak |
| ≳ 1.35 | above the day's own maximum | **long all day** |
| ≲ 0.65 | below the day's own minimum | **short all day** |
| no row at all | — | **unhedged** — every interval uncovered |

Laid out over the measured range as two layers, quarter blocks with monthly
top-ups stacked on them:

| Period | Rows | Portfolio power | Result |
|---|---|---|---|
| `Q1 2026` | 2 | base 3,76 MW + peak 0,94 MW | Jan and Mar read mixed |
| `Feb 2026` | 2 | base 2,27 + peak 0,56, stacked on Q1 | February is long all month |
| *April* | **none** | — | April is genuinely unhedged |
| `May 2026` | 2 | base 3,77 + peak 0,92 | mixed |
| `Jun 2026` | 2 | base 2,42 + peak 0,55 | June is short all month |
| `Q3 2026` | 2 | base 3,99 + peak 0,90 | Jul and Aug read mixed |

Across the 217 measured days that gives **131 mixed, 26 long-only, 30
short-only and 30 unhedged** — the distribution to re-check after touching
this file, because it is the whole point of the sizing.

**Every period carries a `peak` block alongside its `base` one**, about 20 % of
the cover by energy (a peak block only runs weekday 08:00–20:00, so the same
energy needs a larger power). That keeps both shapes represented and the step
it puts in at 08:00 and 20:00 adds crossings of its own.

**There is no YEAR row any more.** A year block would cover April, and April
existing as a genuinely unhedged month is deliberate — it is the only way the
screen can show what no position looks like.

**A negative `powerKw` is a sold block, not a data error** — `direction` reads
`"Sell"` and `computeIntervalHedgeVolumes` sums it with no special case, the
same convention a confirmed SELL trade already uses. No row is negative today:
the greenhouse's export is netted into the account total rather than carried as
its own sold position, which is what dropping the per-EAN split means.

Prices vary per period and are not round, so the stacked Q1+February rows
exercise per-block pricing in Hedge Cost. `tilburg-gas` is excluded — not
tradeable.

**Regenerating it:** there is no checked-in generator (same rule as the usage
data). Rebuild with a one-off ephemeral script that reads the account's mean
net load per window straight out of `consumption_compact_2026.json`, multiplies
by the table above, and takes volume from `PortalTradeLink.hoursInPeriod(start,
end, shape)`. The check is the day-kind distribution above, counted with
`ConsumptionCalc.computeIntervalSeries`.

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
  "hedge":  [{ "id": "BLK-2601", "shape": "base", "direction": "Buy", "periodLabel": "Q1 2026", "periodStart": "2026-01-01", "periodEnd": "2026-03-31", "powerKw": 3760.0, "priceKwh": 0.0814 }]
}
```

`byDate[date].t`/`.p` (local time-of-day, EPEX €/kWh) are stored once per
date and shared across sites; `bySite[id][date].c`/`.g` are per-site
consumption/production in kW, index-aligned with `.t`. Array length is 96
every day except 2026-03-29 (spring forward), which has 92. **`hedge` is a
flat array, not a per-site map** — one entry per contracted block, each
keeping its own period start/end, so any mix of YEAR/QUARTER/MONTH rows is
picked up with no code change.

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
| **Trading** | `portal-seed-data.js` (`TRADES_SEED`, `WIZARD_PERIODS`) + `state.trades`, which includes the contracted blocks from `DATA.hedge` | **list** / **detail** (`state.tradeId`) / **wizard** (`state.wizardStep` 0–2), via `state.tradingView` |
| **Wallet** | `portal-seed-data.js` (`WALLET_LEDGER`, `BANK_DETAILS`, `PAYOUT_ACCOUNT`) + in-memory balances | **ledger** / **topup** / **withdraw** (+ their success states), via `state.walletView`. Interactive but not persisted across reload |
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
`0.8fr 1.15fr 0.95fr 0.85fr 1.5fr 1.1fr`, settlement line items
`0.3fr 2.6fr 1fr 1fr 1fr 1fr`) — don't tidy these into round numbers.

### The Wallet ledger

One **signed movement per row**, in the shape the design project's Ledger
uses. Six columns — Type (badge), Amount, Date & time, By, Reference,
Available after — and no description column: the type badge and the reference
say what the movement was.

Every row is one of three buckets, which is what makes the filter honest —
`LEDGER_TABS` (`All`, `Deposit`, `Withdrawal`, `Trade`) partitions the ledger
rather than sampling it, and `state.ledgerFilter` is an index into it. The
card's subtitle counts what is shown against the whole (`2 of 12`), and an
empty bucket says so rather than rendering an empty table.

**`amount` is a preformatted signed string, `positive` is the flag the colour
reads.** Money in is the only thing tinted (`--pp-green-text`); a debit is the
normal case here and stays body text. Both are written by whoever appends the
row — the four call sites in `customer-portal.html` (`performTopup`,
`payTradeBalance`, `respondToOffer`'s reservation, and `reconcileDeposits`)
and the seeded rows in `portal-seed-data.js` — so a new appender owes both.

**The filter is the design system's Tabs, not `.chart-tabs`.** Those are two
different components: `.chart-tabs` is a segmented control on one shared track
(Consumption's Day/Month/Quarter presets), while DS Tabs is a row of separate
outlined pills — `.ds-tabs` / `.ds-tab`, `gap:6px`, pill radius, 11px/600,
inactive on `--pp-surface-alt` with a `--pp-border-strong` edge, active on
`--pp-teal-100` / `--pp-teal-300` / `--pp-teal-700`. Reusing the segmented one
here was wrong and looked it.

**There is no "Recent deposits" table.** The deposit screen is the two payment
cards and nothing else; the ledger's Deposit filter is where a deposit history
lives, and a second list of the same events could only drift from it.
`PortalSeedData.TOPUPS` and `simulateTopup()` went with it.

### Depositing and withdrawing

The Wallet's topbar carries **Deposit funds** and **Withdraw funds**. (It used
to carry a decorative "Statement" button that did nothing; it is gone.)
`state.walletView` runs `ledger` / `topup` / `topup-success` / `withdraw` /
`withdraw-success`.

A withdrawal is the deposit's mirror image with one rule the deposit does not
have: **the ceiling is `walletAvailable`, not the settled balance.** Reserved
money belongs to an accepted trade, so it cannot be paid out —
`withdrawAmountValid()` enforces both the € 10 floor and that ceiling, and
`performWithdrawal()` re-checks it rather than trusting the disabled button.
`withdrawAmountError()` picks between the two messages, because a field can be
wrong in two different directions.

**An outstanding balance warns, it does not refuse.** That money is still in
the wallet and merely committed to a date, and nothing in this POC enforces
payment anywhere else either — so `withdrawCommitmentWarning()` names what
would be left against what is owed and lets the withdrawal through. Like the
wizard's allocation note, its text and its visibility come from one string, so
an empty warning hides rather than rendering as a blank amber rectangle.

The destination is `PortalSeedData.PAYOUT_ACCOUNT` — **the customer's own
account**, not `BANK_DETAILS`, which is PeakPower's *receiving* account for a
deposit. It renders read-only: changing where money is paid out is a
bank-details change the desk verifies, not a field on a withdrawal form.

**Only a seeded account has one**, so `acctPayout()` returns `null` for every
other company and the whole flow has to survive that: the topbar drops the
Withdraw funds button, and `renderWalletWithdraw()` renders an empty card
saying no payout account is on file rather than a form whose right-hand column
is a null dereference. Hiding the button alone is not enough — a stale screen
still asks.

**A transfer arriving is the one deposit that sends an email.** iDEAL clears
while the customer is on the screen, so `topup-success` *is* the confirmation. A
transfer lands one to two business days later with nobody watching, so
`markTransferReceived()` credits the wallet exactly as `performTopup()` does and
renders `transfer-received`: the new balance beside the email that went out,
from `support@peakpower.nl`, quoting the UTC instant, the amount and the
reference.

**The amount reads `300.00 EUR`, not `€ 300,00`** — the one number on the site
not in NL format. It is the receipt line as specified, and a receipt states the
currency beside the figure. `utcStamp()` renders the date as
`Wed, Aug 26, 2026 11:30:42 AM UTC`.

**Both bank-transfer cards carry a marked demo control**, here and on
onboarding's step 6, because nothing in this POC watches a bank feed. Onboarding
needed one for a second reason: only its iDEAL button set `bankVerified`, so
choosing the transfer card was a dead end that could never reach "Verified".

The card's **Download deposit instructions** link serves the same
`PeakPower_Funding_Instructions.docx` the onboarding flow does — it is the same
document, PeakPower's bank details for a transfer, so it is not written twice.
It replaced a `PP.noop()` link labelled "as PDF".

**Both amount fields patch on blur, never re-render.** `setTopupAmount()` and
`setWithdrawAmount()` reformat their own `<input>` through
`reformatAmountField()` and call their `refresh*Ui()` — because blur fires on
the **mousedown that begins a click**, so a `renderApp()` there replaces the
button being clicked between mousedown and mouseup and the browser raises no
click at all. That is the same failure as the wizard's "Deposit funds" link,
and it made the first click on Pay/Withdraw after typing an amount do nothing.

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

### Blocks belong to the account, not a connection

A block is bought for the whole account: `hedge_blocks_2026.json` carries no
EAN, `DATA.hedge` is a flat array, and every connection draws on every block.
That replaced a per-EAN model, and four screens were rewritten to stop
claiming a split that no longer exists:

| Where | Was | Now |
|---|---|---|
| Trading list | a separate "Contracted blocks" table below the trades | the blocks **are** trades — `blockAsTrade()` folds them into `state.trades`, with the full request→offer→confirm→paid history |
| Wizard step 2 | a per-connection picker with checkboxes, Select all / Clear all, and a CURRENT COVER pill per card | a read-only table of every EAN, plus one `accountCoverMw()` line above it — nothing is selectable |
| Connection detail | a "Block positions on this connection" table from seeded `CONNECTIONS[].blocks` | a line saying blocks are held at account level, linking to Trading |
| Dashboard mini chart | Rotterdam DC's own day under a hedge line | the whole portfolio, like Consumption |

`PortalSeedData.CONNECTIONS[].blocks` is **gone**, not merely unread — it was
a mockup fiction that would have contradicted the account-level hedge line on
the screen next to it.

### Shape is Base or Peak, never "Base (sell)"

A sale is legible from **Direction**, which is its own column on the list and
its own row on the detail. The shape column carried a `(sell)` suffix for a
while — on the seeded `TRD-1867` and in `blockAsTrade()` — which made one
product look like two and meant a Sell could never be grouped with a Buy of
the same shape. `shape` is now only ever `Base` or `Peak`; the sign lives on
the power (`−0,09 MW`) and the direction on its own field.

### A finished trade says it was paid

`STATUS_CONFIRMED_PAID` (`"Confirmed · paid"`, success tone) is the
settled-history status, used by every contracted block and by the seeded
trades that already completed (`TRD-1051`, `TRD-1042`, `TRD-1867`).

It is deliberately **not** `portal-trade-link.js`'s balance vocabulary
(`Confirmed · balance due` / `overdue` / `paid`). Those describe a live trade
that still carries a payment schedule someone can act on; a block and a seeded
historical trade carry none — they are finished — so they say so once and
offer nothing to click.

**Every one of them carries the whole flow in its history**, not just the
ending: request submitted → offer published → offer accepted → trade confirmed
→ payment settled. A trade that showed only "confirmed" read as though the
money had never moved.

Two rules the story follows so it cannot contradict the rest of the app:

- **A block's dates are derived from its own delivery period**, never
  invented: requested 45 days before `periodStart`, confirmed the next day,
  balance paid the day before delivery opens — the same due date
  `PortalTermsLink` uses. The deposit is `PortalTermsLink.DEFAULT_DEPOSIT_PCT`
  of the value, so the figures match what the Payment card would show.
- **A Sell reserves nothing.** `PortalTermsLink.appliesTo()` is false for a
  sale, so the accepted step says so and the last step is *Proceeds paid* —
  the wallet is credited, not debited. Claiming a deposit on a sale would
  invent an obligation.

The seeded trades keep their existing money story (a full reservation settled
at confirmation, which is what `WALLET_LEDGER` records), so the added payment
step names that settlement rather than a 20 % deposit that never happened
there.

### Blocks in the trade list

`blockAsTrade(b)` converts a contracted block into the exact shape the Trading
list and detail already render a trade in, and `contractedBlockTrades()`
appends them to `state.trades` (newest delivery period first, after the linked
and seeded rows). A block **is** a trade — bought or sold at an agreed price
for a delivery period, already executed — so it gets one list, one detail view
and one vocabulary rather than a table of its own that read as a second kind
of object. It shows `Confirmed · paid` in a success tone, and its facts say *Applies to:
All connections on the account*.

Two things this depends on:

- **`syncLinkedTrades()` runs again at the end of `init()`.** The blocks only
  exist once `DATA` has arrived, so the first build (before the fetch
  resolves) has the link and seed halves only. Without the second call the
  Trading screen silently shows six rows instead of sixteen.
- **The chart does not double-count them.** `confirmedBlocksForRange()` reads
  `liveTradeRecords()` — the cross-portal link — not `state.trades`, so a
  block appearing in the trade list never reaches the hedge line twice.

### Trading wizard

Three steps: product & period → volume → review & submit.
`state.wizardStep` is 0–2.

**Entry points** — four buttons, three functions, all landing on step 1:

| From | Function | Preselects |
|---|---|---|
| Trading list "Request a trade", Dashboard hero "Request a trade" | `startWizard()` | Base / next month, first eligible connection |
| Prices card "Request a price →" | `startWizardFromPrice(shape, periodType)` | that card's shape and period type |
| Connection detail "Request a trade" | `startWizardFromConnection(id)` | nothing — a block covers the account whichever page it started from |

`startWizardFromPrice()` must **not** apply the default — honouring the card
the customer clicked is its whole reason to exist.

Every entry point must set `state.page` and call `activatePageDom("trading")`.
`renderApp()` only refreshes whichever `.page` is already visible, so an entry
point that skips those two lines renders the wizard into a hidden container:
no error, no visible effect, a dead button. If a fifth "Request a trade"
button appears, check this before the click handler.

**This is a whole-page rule, not a wizard one.** Any function that moves the
customer to a different screen owes the same two lines, and `topUpWallet()`
shipped without them: from the Wallet it worked (the page was already active),
but the two "Deposit funds →" links that live on *other* screens — the
wizard's insufficient-funds message and the trade detail's Payment card — were
dead. The click fired, the handler ran, the top-up form rendered into a hidden
`#page-wallet`, and the customer stayed where they were with nothing to show
for it. Same failure signature as the wizard case: a handler that runs and a
screen that does not change means look here first.

The connection-detail button sits **below** the block-positions table in a
`.card-foot-action` — a request is a next step after reading the positions,
not a header control. Connections flagged `notTradeable` (the gas connection) or `notEligible`
(Breda's expiring contract) show a reason instead of a button, and
`startWizardFromConnection()` re-checks eligibility itself through
`tradableConnection()`.

#### Every step is two columns

`wizardTwoColumn(left, rail)` and `.wizard-cols` are the shell all three steps
share: the work on the left at 1.6fr, a rail on the right at 1fr. It used to be
the same inline grid string written out twice; a third copy was the moment to
make it a class.

**The rail is sticky, and three things must all hold or it silently does
nothing.** `.main` is the scroll container (`.app` is `height:100vh;
overflow:hidden`, so the body never scrolls); the right column needs
`align-self:stretch`, because the grid's own `align-items:start` shrink-wraps
it and leaves a sticky child no room to travel; and the offset is
`calc(var(--topbar-height) + 16px)`, not `0`, or the rail slides under the
opaque sticky topbar.

**Nothing in a rail may be focusable.** `selectWizardBar()` and `setDirIdx()`
both end in `renderApp()`, which replaces all of `#trading-body` on every row
click — a field in the rail would lose the caret mid-keystroke. Anything that
needs typing into belongs in the left column with the
`refreshWizardVolumeUi()` patch-in-place treatment.

#### Step 1 — product & period

**Step 1's rail carries the selection and the Continue button**
(`buildStep1Rail`). The two product tables are 24 rows long, so a Continue
button underneath them is a scroll to the bottom of the page away; with the
rail, the choice and the way forward stay in view while the tables are read.

**It stops at the 1 MW basis on purpose.** `defaultWizard()` seeds `volumeMw`
at 0,200 at every entry point, so showing Volume, Estimated value and a deposit
here would quote figures for a number nobody has chosen yet — the customer's
own volume is step 2's question, and the rail says so in as many words.

**Step 1's Continue button carries no id.** `#wizard-continue` belongs to step
2 and is patched by `refreshWizardVolumeUi()` through a bare `getElementById`
with no step guard; a second element with that id would leave the wrong button
being enabled and disabled.


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

#### Step 2 — volume

**Nothing is selected here.** A block is bought for the whole account, so the
roster is a read-only **table** — `.grid-table.dense`, CONNECTION / EAN /
STATUS at `2.2fr 1.4fr 1fr` — naming every metering point the block covers. It
is a list of EANs, and the Connections screen already lists them as a table, so
it borrows that vocabulary rather than inventing a second one. No row handler,
no hover, no `clickable` class: there is nothing to pick. It lists
`tradableConnections()` — every connection except the gas one, which a power
block cannot cover.

`state.wizard` carries `volumeMw` and nothing about connections.

- **The volume input is the block's power for the account** — one number, and
  it is not divided by anything. `wizardTotalMW()` returns
  `state.wizard.volumeMw` with no arithmetic, and `submitWizard()` hands it to
  `buildRequest()` as `opts.powerMw`.
- **Minimum and step are both 0,01 MW** (`MIN_VOLUME_MW`, `VOLUME_STEP_MW`,
  and the `<input min step>` attributes). `commitWizardVolume()` snaps to the
  grid on blur; `wizardVolumeValid()` gates Continue.
- The input is a stepper reusing the wallet screen's `.amount-input-wrap`
  shape, with flanking `−`/`+` buttons (`stepWizardVolume(dir)`) that snap the
  same way so repeated clicks can't drift off the grid. Native spin arrows are
  hidden. The decrement button disables itself at the floor.
- **Each card shows the full EAN**, straight off the `CONNECTIONS` record the
  roster is built from — one list, so there is nothing to drift. A connection
  whose `status` is not `Active` shows it (Breda: "Ending 31 Dec"), as a date
  worth knowing rather than a reason it is excluded.
- **Cover is stated once, above the grid, not per card.** `accountCoverMw(
  periodStart, periodEnd)` sums every block from `hedgeBlocksFor()` whose
  period overlaps the **currently selected** delivery period and renders it in
  a `.cc-account-cover` line. It is not on the cards, and must not go back
  there: a block is held for the whole account, so the same figure printed six
  times would claim a per-connection split that does not exist.
  `hedgeBlocksFor()` does not date-filter its static half, so the overlap test
  is this function's job. A negative figure (a sold block reducing net cover)
  is shown as negative, not clamped. A card's `.cc-pill` now carries only a
  reason it cannot be picked.
**Continue has exactly one reason to be disabled**, so `VOLUME_HINT` is the
only message the field can show. `NO_CONNECTION_HINT` and `wizardVolumeHint()`
are gone with the selection they described — and `wizardVolumeValid()` no
longer checks a connection list, which is the line that would otherwise have
returned `false` forever and left Continue and Submit as dead buttons.

**`wizardAllocationNote()` is one unconditional sentence** — "This block will
be held for the whole account once the trade is confirmed." There is no
"which connections" left to answer.

**The banner's text and its visibility are computed from the same string**, in
**both** `buildWizardVolumeTable()` (full re-render path — entering the step,
or changing the period) and `refreshWizardVolumeUi()` (live-patch path, e.g.
typing a volume) — an empty note must hide rather than render as a blank
coloured rectangle. Neither branch returns `""` today, but keep the pairing:
it was added for a real bug where the banner stayed visible and empty after a
hint was cleared, and it only stays fixed while both paths derive visibility
from the same text.

**The roster is every connection a power block can cover — all six.**
`tradableConnections()` is the one list: `CONNECTIONS` minus the gas
connection, which is exactly the set the Consumption screen sums and
`hedgeBlocksFor()` prices against. Nothing is filtered beyond that, because
the hedge is measured against all six connections' summed load and a shorter
roster would understate what was bought.

That list replaced a separate `WIZARD_CONNECTIONS` array, and the reason is
worth keeping: it was a second copy that had **already drifted** — it omitted
the greenhouse, so a published block claimed to cover four connections while
the maths behind it covered six. One list, derived, not two maintained.

**An expiring contract is no longer a reason to refuse a request.** Breda's
card still shows its end date, because that is a date worth knowing, but the
block is not bought against Breda — it is bought for the account. The only
thing `tradableConnection()` refuses is the gas connection, which a power
block cannot cover at all.

**Why the volume field does not call `renderApp()`:** it used to, and the
field could not be typed into — a full re-render rebuilds the `<input>`
mid-keystroke and steals focus. `setWizardVolume()` and `stepWizardVolume()`
patch in place through `refreshWizardVolumeUi()`, which targets
`#wizard-volume-note`, `#wizard-vol-dec`, `#wizard-continue` and
`#wizard-summary-body`. Keep those ids, and give any new live-edit field the
same treatment.

**Never rewrite DOM that has not changed, and be careful what a blur rebuilds.**
`refreshWizardVolumeUi()` writes `#wizard-summary-body` only when the new HTML
differs, and `setWizardVolume()` snaps to the 0,01 MW grid on input so
`commitWizardVolume()` has nothing left to change on blur. Both exist for one
failure: blur fires on the **mousedown that begins a click**, so a rebuild
there replaces the "Deposit funds →" link inside that card between mousedown
and mouseup — the two land on different nodes and the browser never raises a
click at all. The link looked dead while its handler was perfectly fine.

**`#wizard-summary-body` is on that list for a reason.** The Summary card is
every figure the volume decides — power, volume, estimated value, deposit, and
whether the wallet covers it — and for a while it moved only on the *next*
full re-render. Typing a volume changed the input and nothing else, so the
field read as broken even though it was working: you could type 1,5 MW and
watch the deposit sit at its old number. Patching the summary's own container
keeps it live without going near the `<input>`.

**A running countdown must never re-render the page.** The 1-second ticker
used to end in `renderApp()` whenever any pending offer's `secondsRemaining`
moved — and the seeded `TRD-1078` counts down for ~25 minutes after every
load, so for 25 minutes the whole Trading page was rebuilt once a second.
Anything focused was destroyed a second later: the volume field could not be
typed into, the note textarea dropped keystrokes, and a text selection
vanished. A countdown is *text*: `refreshCountdowns()` patches `#offer-ring`
and `#trade-countdown` in place, and only genuine **expiry** — which really
does change the page's structure — still calls `renderApp()`.

**The volume field selects its contents on focus** (`onfocus="this.select()"`).
It is `text-align:center`, so a click lands the caret in the *middle* of the
number and typing inserted there — clicking "0.20" and typing 5 produced
"0.520". You always replace this value, never edit into it. `onfocus` alone is
enough; no `onmouseup` guard is needed, and adding one would break drag-select.

`joinWithAnd()` is gone: nothing names a list of connections any more. The
Summary card, the review step and the published timeline all say *Applies to:
All connections on the account* instead.

**Testing focus-dependent CSS on this page: use `page.click()`, not
`page.focus()`.** Playwright's `.focus()` bypasses the normal event pipeline
and loses focus within ~200ms here; `.click()` on the same element holds it.
A `:focus-within` rule that looks broken under a `.focus()` test is not
evidence of a bug.

### Consumption screen

The only screen backed by real calculated data. It filters by an arbitrary
From/To date range — the old fixed Day/Month mode toggle is gone.
`tilburg-gas` is excluded everywhere real usage data is used.

**Consumption is the whole portfolio — there is no connection filter.** A
block is requested across connections and its cover applies to the portfolio,
so a per-connection view of it would be answering a question nobody is asking.
Every figure on the screen is the sum over all six electricity connections:
`concatRangeData()` sums each interval's consumption and production across
`DATA.sites`, and `hedgeBlocksFor(from, to)` concatenates every connection's
contracted blocks with every confirmed trade's per-connection lines. Nothing
else in the maths changes — `consumption-calc.js` sees one bigger site.

One thing falls out of that and is worth keeping straight: **a date is measured
for the portfolio or for none of it.** All six sites share one metering window,
so `concatRangeData()` could assume it — it checks anyway, and skips the date
entirely if any site is missing, because a half-measured sum would silently
understate the total rather than announce itself.

There is no per-connection variant of the hedge read, and there must not be
one — see "Blocks belong to the account, not a connection".

#### Where the controls live

There is no single controls row. Each control sits with what it filters:

| Control | Lives | Because |
|---|---|---|
| Date `#day-date` *or* From/To `#from-date` `#to-date`, plus the Day/Month/Quarter presets | the usage-chart card's toolbar | they filter the charts and table |
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

**A one-day range is asked for with one date.** When From and To are equal the
toolbar shows a single `Date` input (`#day-date`) and hides the pair; any
longer range shows From and To. `syncDateControls()` is the whole of it, called
from `markActivePreset()` — which every path that changes the range already
ends in, so there is one call site rather than one per entry point.

**From/To remain the source of truth.** `#day-date` writes both and nothing
else reads it: `render()`, the presets, the export and `goToConsumption()` are
untouched. So this is a display swap, not a second mode — a custom range that
starts and ends on the same day *is* a day and gets the single input, on the
same `from === to` test the chart already uses to pick its single-day variant.

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

Colours match the chart directly above: Covered grey, Short amber, Long
indigo. Cost is red for an additional cost, green for savings, neutral at zero.
The in-bar segment labels are the one place a chart hue carries text on top of
it: white clears AA only on Long, so Covered and Short take `.on-light`, which
swaps in `--pp-chart-ink-on-light`.

`.position-panel` needs `flex:1; min-width:0` — `#stat-row` is a flex row, and
a flex item with no grow shrink-wraps to its content instead of filling.

`statCardHtml`, `statGroupHtml`, `costCertaintyOpts` and the `.stat-card` /
`.stat-group` / `.stat-equation` CSS all stay: `statusCardHtml()` (loading /
no-data / error) still renders through them.

#### Usage chart

Two lines — actual usage (solid blue-500 `#006ECF`) and hedge volume (dashed
violet `#9151B8`) — with each interval drawn as a stacked bar from the zero
baseline:

- a grey `#C6CBD4` segment from zero to `MIN(Actual Usage, Hedge Volume)` —
  the covered portion;
- topped by the gap between the two lines: amber `#E09B2D` when Uncovered ≥ 0
  ("Short — bought at day-ahead"), indigo `#4A3AA7` when Uncovered < 0
  ("Long — sold at day-ahead").

All three render at **full opacity**, and nothing on this chart varies opacity
any more. The covered band used to be drawn at 45% to keep it subordinate; the
grey does that job now, and reintroducing the 45% would put it at ~`#E5E8EC`,
lighter than the page's own borders and effectively invisible.

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

#### Per-connection usage against the day-ahead price

A third chart card, and **the one thing on this screen that is not the whole
portfolio**. That is not a reversal of "Consumption is the whole portfolio": a
hedge is held for the account and has no per-connection split, which is why the
two charts above it sum every connection — but metered usage and the day-ahead
price are facts about one metering point, and reading them together is how a
site's own load shape is judged against what it cost. It draws no hedge line at
all.

| | |
|---|---|
| Bars | that connection's Actual Usage in kWh, off a real zero baseline — it goes negative whenever the site exports |
| Line + dots | the day-ahead price in **€/MWh**, one dot per interval |
| Filter | its own `Connection` select (`state.eanChartSite`), plus the shared From/To and the Day/Month/Quarter presets — one range, three charts |

**It has its own geometry, deliberately.** The usage and cost charts must stay
pixel-identical to each other because they are stacked and share a crosshair;
this one carries a second y-axis, so its plot area is a different width and
matching them would misalign it with itself.

**The price axis moves side by variant.** On a single day it sits on the right;
on the scrolling range variant it moves next to the kWh axis on the left
(`priceAxisLeft`), because a right-hand axis on a chart thousands of pixels wide
is an axis nobody can reach. That is why the legend names units and not sides.

**Axis labels are drawn last.** A tall bar reaches the top of the plot, and
labels emitted before the data end up painted over by it. The right-hand ones
also anchor `start`, not `end` — anchored `end` they run back across the bars.

**The price line breaks where the price is missing** rather than bridging the
gap — a straight run through a gap invents a price that was never quoted.

**Dots below `EAN_DOT_MIN_PITCH` (7px) are dropped**: at a quarter's density
they merge into a smear that hides the line instead of marking it. Above it
they carry a white ring, or they disappear into the 2px line they sit on.

**`concatRangeData(from, to, siteIds)` takes the site list** — it defaults to
every connection, and this chart passes one id.

**Two paths deliberately never call `render()`** — zoom and resize — so the
chart is redrawn from `redrawEanChart()` in both, or it sits at the previous
width while the two above it move.

**`TOOLTIPS` is keyed by a context's `kind`.** It replaced a pair of
"hide the other one" branches that only worked while there were exactly two
charts; a third would have left one tooltip stranded on screen.

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
`render()` resets `chartZoom` to 1 on every genuine range or site change; zoom
clicks and resizes redraw through `drawMonthCharts()` directly and never touch
`render()`, which is why they don't hit that reset.

**Zoom keeps the reader's place.** `setChartZoom()` reads the interval sitting
at the middle of the viewport *before* the redraw (`rangeCentreInterval`) and
scrolls it back to the middle *after* (`scrollRangeToInterval`). Both
measurements must straddle the `state.chartZoom` assignment, because
`rangeChartGeometry()` reads it. It used to set both wraps' `scrollLeft = 0`
instead — one click and you were back at day one, which is the opposite of what
zooming into a long range is for.

Two consequences worth knowing before "fixing" this again:

- **At either edge the anchor cannot stay centred** — there is no content past
  it — so clamping shifts it. Staying pinned to that edge is the correct
  behaviour, not a bug; a test asserts the pin rather than the centre there.
- **"Fit" is the label for zoom 1, not a promise that it fits.** `fitPx` is
  floored at `RANGE_PX_PER_INTERVAL_MIN`, so anything over ~276 intervals (about
  three days) still scrolls at zoom 1.

`RANGE_PAD_LEFT` (40) and `RANGE_PAD_RIGHT` (10) and `rangeStepX(width, n)` are
shared by both range builders and by the anchor maths — the x-geometry has to
agree in all three places or the scroll lands somewhere else than it measured.
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
`thead th:nth-child(2)/(7)/(13)` that draws the identity / metered / position
/ money separators. Those indices are positional. Add, remove or reorder a
column and every boundary after it shifts, the rules land mid-group, and
**nothing fails** — no test asserts it. There are currently **16** columns
(it was 17 until the `Data` provenance column went with the forecast).
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

**CSV export** writes exactly the table's 16 columns in the table's order, and
every row of the current range — the full filtered dataset, not just what's on
screen — named `consumption_all-connections_<from>[_to_<to>].csv`. Values are
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
- **`EAN_DOT_MIN_PITCH = 7`.** Below it a price dot per interval merges into
  a smear that hides the line it is marking — the same lesson the old hatch
  threshold taught: an illegible mark is worse than no mark, because it claims
  a distinction the pixels don't carry.

**Consumption's own breakpoint is 760px.** The page has since grown two more
(`767px` and `768–999px`, for the stat stack) and `customer-onboarding.html`
has one of its own at 900px, where its 296px rail stops being affordable. Everything else
responsive is emergent (`flex-wrap` + `min-width` + `flex:1`, plus the day
chart's `ResizeObserver`), which is fine until wrap *position* carries
meaning. It does in three places: the equation, the chart toolbar and the
table summary row. Below 760px those stack. There is no small-screen layout
and none is intended — this is a desktop trading tool. Known and accepted: the
chart SVGs overflow the viewport below ~950px.

### Past the meters: only what is known

**The range reaches a year ahead, and nothing is forecast out there.**
`concatRangeData()` walks every calendar date in the range. A date the meters
have delivered carries its real consumption, production and EPEX; a date past
them carries **null for all three** — not an estimate. `consumption-calc.js`
already nulls each derived field independently, so those intervals compute:

| | Past the meters |
|---|---|
| Hedge volume, base/peak volume, hedge cost | **Real.** From the blocks and the calendar, priced at the block's own contract rate — never dependent on metering or spot |
| Actual usage, uncovered, long, short | **Absent.** No reading, so no number |
| Usage cost, delta cost, total cost | **Absent.** No usage and no day-ahead price |

So a forward range draws the hedge as a dashed step on both charts and nothing
else, the table shows `—` in every usage and cost column, and the panel says
*No readings yet — hedge only*.

**There is no forecast of usage anywhere.** What was removed, and why the
pieces had to go together:

| Gone | Was |
|---|---|
| `usage-projection.js` and its suite | a historical time-of-day profile per site, projecting usage past coverage |
| `indicativeEpexFor()` | the forward curve standing in for spot. With no usage to price, it had nothing left to value |
| the certainty layer | hatch fills, 55 % opacity, dotted line segments, the Measured/Projected boundary marker, its legend swatch, the tooltip's Status row, `.stat-card.projected` / `.position-panel.projected`, the "Projected" badge |
| the table's `Data` column and its CSV twin | provenance only meant something while some rows were forecast |
| `measuredStats` / `projectedStats` / `realDayCount` | the split behind the cards' "+ €X projected" sublabels |

**`MAX_SELECTABLE_DATE` is a year past today** (`oneYearAhead()`, by the demo
clock), extended further by any block or confirmed trade running beyond it —
otherwise that position's last months would sit past the input's max and be
unreachable.

**A null is not a zero, and the charts must not draw one.** Every scale loop
skips a null before taking a min/max (one null makes the whole axis `NaN`),
every bar loop `continue`s on one, and both usage and total-cost lines go
through `lineSegments()`, which starts a new `<polyline>` at each gap. A single
polyline across the boundary would draw a straight run through intervals that
carry no data at all. The hedge lines have no gaps to handle — they are known
everywhere.

**The subtitle states coverage, not just size.** `coverageLabel()` prints
"1.152 intervals · 480 metered", or "· none metered yet · hedge only" when
there is nothing measured at all, so a mostly-forward range cannot read as a
full one. The per-EAN card passes its own empty note — it plots usage against
price and draws no hedge line, so out there it is genuinely empty rather than
"hedge only".

**The panel states the hedge cost it does know** even when Total is `€ —`.
Total is Delta + Hedge and Delta needs a spot price, so the total is genuinely
unknown — but the hedge half is contracted, and swallowing it along with the
number that depends on spot would hide a figure we have.

**`costCertaintyOpts()` has one job left:** saying so when a range has no
day-ahead price behind it. It no longer distinguishes indicative from measured,
because there is no indicative case.

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

Identical `:root` in all four pages — `customer-portal.html`,
`back-office-portal.html`, `customer-onboarding.html` and `index.html` —
copied, not shared, because there is no build step to share it with. Three
pages inherit the `--pp-chart-*` roles they have no charts for; that is the
cost of one byte-identical block over four files that drift.

**It really is byte-identical, and that is checkable.** The claim was false
once: `back-office-portal.html` kept the pre-recolour chart hues (Short coral,
Long teal, Hedge blue) long after the customer portal moved to amber/indigo/
violet. It reads none of them, so nothing showed — which is exactly why it sat
there. Compare the blocks, do not assume them.

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
| Covered band | grey `#C6CBD4` | `--pp-chart-covered` |
| Short / buy | amber `#E09B2D` | `--pp-chart-short`, `COST_BUY_FILL` |
| Long / sell | indigo `#4A3AA7` | `--pp-chart-long`, `COST_SELL_FILL` |

Every one of them is drawn at full opacity — see the usage chart above for why.
Short and Long also print as numbers (the interval table's two columns, the
Short/Long stat values, both composition legends), and a fill is not a text
colour: `--pp-chart-short-text` (`#8A6710`, 5,2:1) and `--pp-chart-long-text`
(`#4A3AA7` itself, 8,6:1) are the tiers those read. **The chart roles carry
their own text tiers rather than borrowing `--pp-red-text`/`--pp-teal-text`** —
those are status colours, and the table quietly kept the old red long after the
bars had moved on.

`--pp-chart-peak` (blue-300) is defined and currently unused. The `--pp-chart-*`
tokens are the reference values; the SVG builders carry the literal hexes,
so a recolor touches both.

The certainty multiply inside `barFillAttrs` is the only thing that changes a
fill's opacity, so a projected bar reads lighter than a measured one and nothing
else does. Legend swatches carry the same full opacity as what the chart draws;
a paler swatch than the real mark is its own small lie.

**Read the roles through the `--pp-chart-*` tokens, never the status palette.**
The legend swatches, both composition bars and the stat-card accent caps used to
write `var(--pp-red)`/`var(--pp-teal)` directly, which is how a recolour of the
bars could leave every swatch behind. `--pp-teal` and `--pp-cyan` now have no
reader in `customer-portal.html` at all.

Hedge cost and Hedge volume stat cards use a dedicated `tone="hedge"`
(`--pp-violet`/`--pp-violet-text`) rather than `.brand`, because the
Dashboard's "Coverage — August" card also carries `.brand` for an unrelated
figure. A ratio is not a hedge position.

**Measured, not guessed** (`dataviz` skill's `validate_palette.js`, light mode):
the Short/Long pair separates at ΔE 42,9 normal, 38,8 protan, 37,5 tritan — the
old red/teal pair was 30,8 and only 12,4 under deuteranopia. Two knowingly
accepted warnings: Short is 2,3:1 against the card, which the legend, the
tooltip and the interval table relieve; and Long sits ΔE 13,9 from the actual-
usage line `#006ECF`, under the validator's floor of 15, which form separates —
Long is a filled bar, actual usage a 2px line. Re-run the validator before
quoting any of these rather than trusting the numbers here.

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
- `.btn-link` is `white-space:nowrap`. These sit inline at the end of a
  sentence ("…to cover the 20 % deposit on this block. Deposit funds →"), and
  wrapped across two lines it becomes two half-width targets whose combined
  bounding box centres on the text *behind* it — which is exactly how a
  working link comes to feel unclickable.

Two deliberate divergences, both to protect Consumption, which shares these
classes:

1. The design system's StatCard `critical` tone is orange. Consumption's
   cost cards need red, so they use a rebuild-only `.negative` tone and
   `.critical` stays faithful. Under SB-2026 both now resolve to the same red;
   the two class names are kept rather than merged, to avoid touching every
   call site for a cosmetic no-op.
2. `.stat-row` keeps a 16px gap. The mockup is internally inconsistent here
   (16/14/12px across screens), so there's no single correct value to match.

### Switching accounts

The portal shows **one account at a time**, and the avatar menu at the foot of
the rail switches between the accounts this browser has signed in to.
`ACCOUNTS` is the registry; `acct()` is the only way to reach the active one.

**Any account of any customer the desk has on its books can sign in.**
`portal-accounts.js` builds `DIRECTORY` from `BackOfficeScreensData`'s own
`CUSTOMER_LIST` and `buildCustomerDetail(c).accounts` — currently 18 sign-ins
across 8 companies, and a company added to that roster becomes signed-in-able
with no change here. That is why `customer-portal.html` loads
`back-office-screens-data.js`: a second list of the same companies is a list
that drifts. **Only `CUSTOMER_LIST` and `buildCustomerDetail()` are safe to
call from the portal** — `buildAttentionItems()` dereferences
`BackOfficeDeskData.TAG_STYLE`, and the portal does not load
`back-office-desk-data.js`.

**`ACCOUNTS` is keyed by the sign-in address, not by company.** Two colleagues
at one company are two sign-ins showing the same company's data, and the menu
lists both — a company-keyed map would let the second replace the first.
`state.accountId` is therefore an email.

**Only Vandersteen Koeling has fixtures.** `seeded` is `kvk ===
PortalSeedData.CUSTOMER_ID` and `acctList(key)` hands a seeded account the
matching `PortalSeedData` export; every other account gets `[]` from the same
call. So "this account has none of that" is one branch in one place instead of
a check on every screen, and no other company's data is invented to make it
look busy. The same rule gives them a zero wallet, no metering
(`datasetForAccount()`) and no payout account (`acctPayout()`).

| | |
|---|---|
| Store | `peakpower.accounts.v1` — `{activeId, signedIn}`, same swallow-every-failure discipline as the other links: an unreadable value lands on the seeded account, never on an error. **Not versioned up** when ids became emails: `readAccountSession()` already validates every stored id against `ACCOUNTS` and drops what it does not know, which is stronger than a version bump |
| Products | `peakpower.products.v3`, a **map keyed by KvK**. v1 was a bare array for the single account this portal used to have and v2 was keyed by account id, which became per-person — and a product is bought by the company, not by whoever signed in. `productKey()` is the one place that resolves it |
| Adding one | "Add another account" opens an email + password form. `PortalAccounts.findByEmail(DIRECTORY, …)` matches case-insensitively and trimmed, and a wrong email and a wrong password are told apart — a form that says only "sign-in failed" cannot be acted on |

**This is not authentication.** `DIRECTORY` and `DEMO_PASSWORD` are shipped to
the browser, in a portal whose every figure is synthetic. Nothing here is a
credential and nothing is verified anywhere else; the form exists so the switch
has a real shape, not so it protects anything.

#### Deriving the address

The mockup's seeded accounts carry a bare handle (`jdevries`), not an address,
so `PortalAccounts.signInEmail(account, legalName)` is the one rule for both
cases: **a stored address wins, otherwise derive.** A desk-created account
already has one, because the Add customer wizard asks for it and
`accountRowFrom()` stores it in `username`.

- domain — the legal name folded to ASCII, its legal form dropped
  (`LEGAL_FORMS`), joined, `+ ".nl"`: `Vandersteen Koeling B.V.` →
  `vandersteenkoeling.nl`
- local part — `first + "." + rest joined`: `J. de Vries` → `j.devries`
- a blank name or company yields `""` and `buildDirectory()` drops that row
  rather than emitting `@domain.nl`; a duplicate address stays with the company
  that claimed it first

**The desk renders the same function**, in the Customers detail's accounts
table under a **SIGN-IN EMAIL** column (`customersAccountsCardHtml(d,
legalName)`). That column is the only place an operator can see what a person
signs in with, so deriving it twice would drift on the first rename — and the
stored-address-wins branch would diverge at exactly the row that matters, a
customer created a minute ago. The synthesised `username` on
`buildCustomerDetail()`'s non-Vandersteen rows was deleted with it: it was
never something anyone could sign in with.

**That cell wraps, it does not truncate.** An ellipsis costs the column its only
reason to exist, so it takes the widest of the six tracks, a `<wbr>` before the
`@` (a wrapped address splits into two whole halves), and the card takes
`flex:1.45` against Commercial settings' `flex:1`. At the original even split
every address was hidden past its halfway point.

**Known limits, all of them deliberate:**

- **A customer created in the desk cannot sign in.** `state.newCustomers` is
  page-local by design and `DIRECTORY` is built once at load, so the portal
  never sees it. Persisting it would need a fourth versioned link.
- **Roles are recorded, not enforced.** The directory brings in Traders and a
  Viewer, and no screen gates on `acct().userRole` — the same position the
  four-eyes setting takes.
- **The desk's Wallets screen shows a balance for companies the portal shows at
  zero.** That is `seeded` doing its job: a non-seeded account is genuinely
  empty. Do not "fix" it by reading `WALLETS` into the portal.
- Half the directory is mockup filler — `buildCustomerDetail()` synthesises a
  second account per company as `"S. Finance"`, whose address is now
  user-facing text on a sign-in screen.

**`switchAccount()` has to do everything at once, in order.** Persist, reset,
re-derive, then render:

- **the money resets only when the *company* changes, not the person.**
  Everything else identifying a company is keyed by KvK — the trade link
  through `forThisAccount()`, the products through `productKey()`, the deposit
  percentage through `depositPct()` — so a `sameCompany` switch keeps the
  wallet trio, the ledger extras, the counters and
  `depositReserved`/`depositResolved`. Resetting them would release deposits
  still reserved against trades that stay on screen (spendable twice, and the
  accept and withdraw guards both read the inflated figure) and leave
  `reconcileDeposits()` with no record to settle when the desk answers
- `products` and `trades` are re-derived either way; a figure carried across
  companies is one account's money read under another's name
- **switching to the account already showing returns early**, closing the menu.
  `submitLogin()` calls this unconditionally, and without the guard signing in
  as yourself would run the whole reset below for nothing
- every open sub-view goes too (`connId`, `tradeId`, `settlementId`, the
  wizard, the wallet view, the ledger filter)
- `usageProfiles` and `lastRender` are caches keyed by **site id, not account**
  — left alone, one account renders the other's projections
- `applyAccountData()` re-derives the dataset, `MIN_DATE` / `MAX_DATE` /
  `MAX_SELECTABLE_DATE` and the Consumption controls. A switch that only called
  `renderApp()` would leave the new account on the old one's date range
- `renderAccountMenu()` **and** `state.page` + `activatePageDom()`. Skip the
  first and `.account-scrim` stays over the viewport swallowing every click;
  skip the other two and the render lands in a hidden container
- an id it does not recognise ends in `closeAccountMenu()`, **not** a bare
  `return` — this is reached from the menu, and returning leaves that same
  scrim behind

**The demo clock stays global.** It is a wall-clock offset shared with the Back
Office under `peakpower.demoClock.v1`; scoping it per account would break the
agreement between the two portals.

**`state.nextSeq` stays global, and its id scan reads the whole link.**
`syncLinkedTrades()` filters records to the active account but counts ids
across all of them — scope the scan too and two accounts in one browser mint
the same `TRD-` id, which `publish()` then updates in place, one overwriting
the other.

**Never call `PortalTradeLink.read()` directly — go through
`liveTradeRecords()`.** `customerId` was already on every published record
(`buildRequest` stores it, `submitWizard` supplies it), so this is only the
read side, and `liveTradeRecords()` is the one place it reads the link, filters
through `forThisAccount()` and swallows a storage failure. Every call site fails
silently without it: `syncLinkedTrades()` and `confirmedBlocksForRange()` (or
the Consumption hedge line, the hedge cost, the coverage figures and
`MAX_SELECTABLE_DATE` sum another company's confirmed trades),
`outstandingBalances()` (the Wallet's outstanding table, the Dashboard's card
and banner, `overdueCount()` and the withdrawal guard), `depositsOnHoldLabel()`,
`payTradeBalance()` and `respondToOffer()` — the last two look a trade up **by
id across the whole link**, so an unfiltered read pays or accepts against a
record belonging to another company.

**`portal-trade-link.js` no longer hardcodes the user.** `requestedBy` rides on
the record, and `respondToOffer()` / `payBalance()` take `by` from the caller —
both are persisted and read back by the Back Office, so a module constant there
would file one account's decision under another account's name.

### An account with no data

Most accounts are genuinely empty — only the seeded company has fixtures, so
14 of the 18 sign-ins land here. Every screen says so in its own words rather
than rendering furniture:

| Screen | Shows |
|---|---|
| Dashboard | a welcome card naming what is missing, plus the price tiles — the forward curve is market data, not account data. They render in the populated screen's own `.price-card-grid` six-across; a `.price-tiles` class no stylesheet defined stacked them full-width |
| Prices | the six cards and the trend, with an amber banner saying no connections are registered — and **no "Request a price →" links**. `startWizardFromPrice()` still guards itself, but a link whose handler runs and changes nothing reads as a broken page |
| Connections, Trading, Settlements | one `emptyCardHtml()` each |
| Consumption | `statusCardHtml("No connections", …)`, and `setConsumptionChromeVisible(false)` hides the two chart cards and the interval table |
| Wallet | € 0,00 across the three cards, and a first-deposit prompt instead of the low-balance alert — a wallet that was never funded is not "below its alert", nothing has gone wrong yet |

**Never render a `.grid-table` with no rows.** `.gt-head` is a tinted strip
with a bottom border that exists whether or not rows follow, so an empty list
is a two-tone box with a hanging border and nothing in it. Branch on the row
count and use `emptyCardHtml()`.

**Two things would have thrown, and both are prevented in
`applyAccountData()`, not in `render()`.** With no dataset,
`MAX_SELECTABLE_DATE` is `undefined`: `applyPeriodPreset()` passes it to
`periodRange()`, which calls `.slice()` on it — one click on Day/Month/Quarter.
And empty date inputs make `allCalendarDatesInRange("", "")` return `[""]`,
which renders 96 synthetic intervals dated `"undefined undefined 0"` with
Export CSV enabled over them. `applyAccountData()` disables the date inputs,
the presets, the zoom buttons and Export when the account has no data, so
neither path is reachable.

**The wizard needs a connection to cover.** `canRequestTrade()` gates all four
"Request a trade" entry points and the Prices cards' six links on there being one — `requireFutureTrading()`
checks the product only, and without this the wizard is fully operable on an
empty account and files a request at the desk with an empty roster.

### Account products

An account holds **products**, and the products decide what the rail shows.
`PRODUCTS` (in `customer-portal.html`) is the catalogue of six; only
`future-trading` and `day-ahead` are modelled, the other four carry
`comingSoon` and cannot be switched on. `state.products` starts as
`["day-ahead"]` — **Future Trading is off by default**, which is the state the
gating exists to show.

The switch lives at the foot of the rail, in the account menu
(`.account-menu` → `.account-pop`), because a product is a property of the
account rather than of a screen. Its "Products" row opens the Products screen
(`#page-products`, `renderProductsPage()`), which is two cards — active and
available — plus a banner saying what a product changes.

**`future-trading` gates three pages**, listed once in `FUTURE_TRADING_PAGES`:
Prices, Trading and Wallet. Off, they leave the rail entirely
(`applyProductNav()` hides every `[data-nav-product]` element, the Market
group label included), the Dashboard hero swaps "Request a trade" for the
locked copy and an "Add the product" button, the wallet and open-trade stat
cards and both trade banners are dropped, and a connection's detail says the
product is not active instead of offering a request.

Three rules worth keeping:

- **The gate is in the handlers, not only in the markup.** `goTo()` redirects
  a gated page to Products, and `requireFutureTrading()` guards
  `startWizard`, `startWizardFromPrice`, `startWizardFromConnection`,
  `openTrade` and `topUpWallet`. A hidden button is not a check — a deep link
  or a stale screen still asks.
- **Removing the product you are standing on moves you to Products.**
  `toggleProduct()` checks `FUTURE_TRADING_PAGES[state.page]`; otherwise the
  customer is left on a visible page with no rail entry to return to.
- **`goProducts()` re-renders the rail itself.** `goTo()` re-renders the page,
  not the sidebar, so without the extra `renderAccountMenu()` the popover and
  its full-viewport `.account-scrim` stay in the DOM and swallow every later
  click. That was a real bug, caught only by a click test.

Products **persist in this browser, per account**, under
`peakpower.products.v3` (`readProducts(id)` / `writeProducts(id, ids)`, keyed by
the account's KvK), so a
demo does not begin by switching Future Trading on again — and switching
account switches which products are active with it. It is not a cross-portal link — this is the customer
switching a product on themselves, not a term the desk sets — and it keeps the
links' failure discipline: any read problem lands on `DEFAULT_PRODUCTS`
(`["day-ahead"]`), and a write that cannot happen is not an error the customer
needs to see.
Known gap: the Dashboard's seeded "Recent activity" rows still mention trades
and a wallet deposit while Future Trading is off — that list is verbatim
mockup seed data, not derived from state.

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
| Customer | Trade detail | A **Payment** card: value, the deposit and its state, balance, due date, a **Pay balance** button (disabled until the trade is confirmed), and the state in words |
| Customer | Wallet | A **Balance outstanding** stat card and an **Outstanding balances** table, soonest due first |
| Customer | Dashboard | A stat card, and a red/amber banner when a balance is overdue or within 14 days |

The wizard's funds check gates on the **deposit**, not the full value — before
that a 20% term was meaningless because you still needed 100% in the wallet to
pass step 2. An insufficient wallet names the shortfall and links to the
deposit flow rather than only refusing. `wizardGoStep2()` and `submitWizard()`
**re-check it themselves**, so the rule survives a call that bypasses the
disabled button.

### The demo clock

Every date-dependent state here is decided against "now", and in a demo every
trade delivers months out — so a balance is permanently `scheduled` and the
run-up to paying it (due soon → overdue → paid) can only be seen by waiting
weeks for it. `portal-demo-clock.js` shifts what both portals think "now" is by
a whole number of days, so that story can be walked through on demand.

**It shifts the clock, never the data.** A Q1 block still starts on 1 January
and its balance is still due on 31 December; only today moves. Rewriting the
trade's `dueDate` instead would be quicker and would leave the trade detail
claiming a due date its own delivery period contradicts.

Same transport and the same failure discipline as the other two links: one
versioned key (`peakpower.demoClock.v1`), the `storage` event, and every read
failure landing on 0 — the real clock — rather than throwing. **Both portals
share one offset**, so the desk's "N overdue" can never disagree with what the
customer is looking at.

**Whole days, shifted by calendar** (`Date.setDate`), never by
`offsetDays × 86_400_000`. `daysUntilDue` counts whole local days, so a
whole-day offset lands exactly on the intended date's state; and a flat 24h per
day lands an hour early across a DST change, which silently moves the date when
the real time is near midnight. Both are pinned by tests.

**The seam already existed.** Every clock-reading function in
`portal-trade-link.js` and `portal-terms-link.js` already took an optional
`now` — `balanceState`, `daysUntilDue`, `effectiveStatus`, `secondsRemaining`,
`isExpired`, and the `{now}` opts on `priceRequest` / `respondToOffer` /
`payBalance` / `confirmTrade` / `failTrade` — and no caller passed one. Each
page now funnels every one of them through its own `nowForLink()`. **A new call
site that reads a date must go through `nowForLink()`**, or that one screen
quietly runs on a different day from every other.

**One honest clock, and it costs something:** jumping forward expires an open
firm offer, exactly as real elapsed time would. Demo the offer flow before
jumping, or Reset first.

**Anything that latched on "this already happened" has to reset when the clock
moves.** The desk's `state.expiredShown` marks an offer as re-rendered at the
moment it expired, so the ticker flips the banner over exactly once — correct
while time only ran forward, wrong as soon as Reset can un-expire an offer,
because the second expiry would then never re-render and the desk would keep
showing a live offer that has actually lapsed. `clearExpiryLatch()` is called
from `applyDemoOffset()` and from `syncDemoClock()`, and `syncDemoClock()`
compares before clearing so an ordinary `focus` does not reset it.

The control is a topbar strip in both portals — neutral at `today`, amber once
shifted, because a faked present must never read as the real one. It is static
markup patched in place by `refreshDemoClockUi()`, never re-rendered: the date
input is a live field and a re-render would steal focus mid-keystroke. In the
Back Office it sits in a `.topbar-right` wrapper *beside* `#topbar-actions`,
whose `innerHTML` is replaced on every render.

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
| Funding the wallet | money the customer sends in | "Deposit funds", "Deposit successful", "Minimum deposit is € 10,00" |
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
  pinning this. What confirmation *does* change is that the balance becomes
  payable at all — see "The deposit's three states".
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
balances (trade records themselves persist on the link). There is no refund
history — a deposit is held, then either applied or released, and the ledger
row is the whole record. Nothing is billed, there is no dunning, and nothing
stops delivery when a balance goes unpaid — the overdue state is surfaced,
not enforced.

### The deposit's three states

A deposit is **held**, then either **applied** or **released**, and the balance
cannot be paid until it is applied.

| Trade state | `PortalTradeLink.depositState()` | Wallet | Pay balance |
|---|---|---|---|
| Accepted, awaiting execution | `on-hold` | available − d, reserved + d | shown, **disabled** |
| Confirmed, before the due date | `applied` | reserved − d, settled − d | enabled |
| Confirmed, after the due date | `applied` | (already moved) | **gone** |
| Execution failed | `released` | reserved − d, available + d | gone |

### The payment window

`PortalTradeLink.paymentWindow(req, now)` is the one rule, returning
`"paid"` | `"not-executed"` | `"open"` | `"closed"`; `balancePayable()` is
`window === "open"` and `payBalance()` guards on it, so a stale screen cannot
pay round a disabled button.

**It opens at execution and shuts after `dueDate`** — the day before delivery
opens. Before execution the trade can still fail, and a failed one hands the
deposit back rather than collecting more, so charging early risks taking money
for a block the customer never gets. After it, the period is running: there is
no longer a block to pay for in advance, so the balance stops being collectable
in the portal and the desk settles it instead. Unwinding either would need the
refund history this POC deliberately does not have.

**One exception: a block the desk confirmed *after* its own due date keeps the
window open.** The customer never had a window to miss — the delay was ours —
and taking the payment away for it would be punishing them for our lateness.

**The boundary is an ISO `YYYY-MM-DD` comparison**, which is the same line
`PortalTermsLink.daysUntilDue()` draws at `< 0`. A test walks the days either
side of a due date and asserts the two still agree; keep it. The day *count*
stays `daysUntilDue`'s job — `paymentWindow` only decides which side we are on.

**"Overdue" means the window shut, not that the date passed.** `overdueCount()`,
the Dashboard banner and the desk's `outstandingFor()` all read the window, so
an unexecuted or late-confirmed balance is never counted late.

**A closed window drops the button entirely** rather than greying it. Elsewhere
a disabled button says "not yet"; here it would never become active again, so
it would be decoration — and an invitation.

**The Dashboard warns whether or not the desk has executed it.** A deadline the
customer cannot act on is the one they most need telling about, so an
unexecuted balance still raises the amber banner — it just says
"awaiting execution by PeakPower" and offers *View trade* instead of
*Review & pay*. A closed one goes red and says the desk will be in touch.

### The status the customer reads

`toCustomerTrade()` folds the balance into the trade's own status, because
"Confirmed" alone says the block was executed and nothing about whether the
money behind it is settled:

| Window | Status | Tone |
|---|---|---|
| `paid` | `Confirmed · balance paid` | green |
| `open` | `Confirmed · balance due` | green |
| `closed` | `Confirmed · balance overdue` | red |

Only for a confirmed trade carrying a schedule — a Sell, a seeded row and an
unaccepted offer keep the bare lifecycle status. The badge deliberately has no
amber "due soon" tier: that horizon is `DUE_SOON_DAYS` in
`portal-terms-link.js`, and honouring it in `portal-trade-link.js` would put
the rule in two modules. Due-soon is an alert, and it lives on the Dashboard.

**Committed but not chased.** An unexecuted balance still counts in every
outstanding total and appears in the Wallet's Outstanding balances table — the
money *is* committed, and hiding it would understate the obligation — but it is
never counted overdue and never fires a banner. Its row reads *awaiting
confirmation* in place of a due date, and its deposit shows *· held*. The
Payment card withholds the due-soon and overdue notes for the same reason:
telling someone a balance is late on a block that may never exist is exactly
what this gate removes.

**`reconcileDeposits()` moves the wallet** when the desk's outcome arrives,
from this tab or another — it runs inside `syncLinkedTrades()`. It acts only on
ids **this session reserved** (`state.depositReserved`, set in
`respondToOffer`) and not already resolved (`state.depositResolved`). That
scoping is what keeps it honest: the wallet is in-memory and resets on reload,
so a trade confirmed before the page loaded never had a reservation *here* to
release, and releasing one anyway would eat into the seeded figures.

The confirm ledger row's amount is **€ 0,00** — it nets to no change in
available, the same as the seeded `TRD-1051` confirmation row, because the
money left available at reservation, not now. What it does move is the settled
balance.

## Adding a connection

A metering point is **found, never typed**. `ean-registry.js` holds the pool of
points registered with the grid operators and not yet on any customer, the
search over it, and the record of who took which — and both portals add a
connection through it.

```
Customer Portal · Connections · Add connection  --claim-->  peakpower.eanClaims.v1
Back Office · Customers · Add connection / wizard step 2  --claim-->  (same key)
```

**The pool is shared, so a claim is final for both.** A point taken in one
portal is gone from the other's search on its next read — verified by claiming
in each direction. That is the whole reason the EAN is not a text field: an EAN
either exists and is free, or it does not, and letting either portal invent one
would make "unassigned" mean nothing.

### The search

`EanRegistry.search(rows, query)` reads what was typed through `parseQuery()`:

| Typed | Read as | Matches |
|---|---|---|
| `871687100000000130`, `8716 8710 0000`, `000000163` | EAN (digits only) | any point whose EAN contains those digits |
| `8232DP`, `8232 dp` | postcode | every point on it |
| `8232DP 24`, `8232 dp 24` | postcode + house number | the one point |
| `Rotterdam`, `Pekstraat` | free text | street or city |
| *(empty)* | — | **everything**, so the pool can be browsed |

Digits alone are an EAN because nothing else in this data is a bare number that
long. A Dutch postcode is four digits and two letters, and `normalisePostcode()`
folds `3514 uh` and `3514UH` together, so the space is never the reason a search
misses.

An empty query returning the whole pool is deliberate: a demo where you have to
already know an EAN before anything appears is not a demo.

### Claiming

`claim(storage, ean, owner)` **refuses a point that is not in the pool or that
someone already holds**, and returns `null` rather than throwing — so the check
is in the registry, not in whichever button was clicked, and a screen that sat
open while the other portal took the point cannot claim it anyway. Same
transport and the same failure discipline as the trade and terms links: one
versioned key (`peakpower.eanClaims.v1`) and every read problem landing on
"nothing claimed".

### Customer Portal

`state.connectionsView` is `list` or `add` on the same screen, and
`state.eanQuery` is what was typed. **The search field is patched in place**
(`refreshEanResults()` writes `#ean-results` only) — a re-render would rebuild
the `<input>` mid-keystroke, the rule the wallet's amount fields and the wizard's
volume field already follow.

**Read `acctConnections()`, never `acctList("CONNECTIONS")`.** That helper is
the one place the seeded fixtures and the claimed points are joined; going
around it drops every added connection out of the list, the detail, the wizard's
roster, the counts and the published request. `connectionFromClaim()` converts a
claimed row into the shape those screens already render.

Two things a claimed point does not have, and both say so rather than borrowing
the fixtures' answer:

- **No delivery history.** The detail's Data quality card is one reading of
  fourteen delivered days — the strip, the correction notice and the interval
  count are one claim — so an empty `dq` renders "no data has arrived yet"
  instead of fourteen blank cells under a seeded month's story.
- **No name.** It reads as its street and number (`Pekstraat 24`) until the
  customer names it, and `autoNamed` is what makes the labels card say so. The
  seeded unnamed connection still says "— no name set —": it has nothing else to
  go on, a point picked by address does.

### Back Office

Both places the desk adds a connection — the customer detail's **Add
connection** and the new-customer wizard's **step 2** — open the same picker
(`state.eanPicker = {target, query}`), and picking fills a row rather than
opening a blank one. `startDetailRow('connections')` redirects into it;
`addCustomerRow()` now serves accounts only.

**EAN, address and commodity are read-only on the row** — they are the metering
point's own facts and arrive with it. The desk names the connection and sets the
date it starts on, which are the customer's. `wizardControlHtml()` renders a
read-only field as text, not as a disabled input: a disabled input invites a
click that does nothing.

**`pendingEans()` is why the same point cannot be picked twice.** Nothing is
claimed until the customer is created or the row saved, so rows already sitting
in the draft (or already on the customer) are filtered out of the picker by
hand; without it a point could be picked twice and refused only on the way out.

**`prefilledCustomerDraft()` takes its connections from the pool as it stands**
(`prefillConnections(2)`), for the same reason its KvK walks with the number of
customers created: a fixed pair is refused the second time the toggle is used in
a session, which reads as the toggle being broken rather than the validation
working.

**Known limit:** the desk can only add a connection to a customer *it created on
this page* (`c.isNew`), and those customers are page-local, so a desk-assigned
point never appears in the Customer Portal. What does cross over is the pool
shrinking. Assigning to a seeded customer would need `METERING` to stop being a
fixture.

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
direction, shape, the selected period with its start/end dates, the block's
power for the account (`opts.powerMw`), an **unweighted roster** of the
eligible connections it covers, the note, and the indicative price for that
shape. Total volume is **computed**, not carried: `powerMw × hoursInPeriod(
start, end, shape)`, base counting every hour and peak counting Mon–Fri
08:00–20:00 only (DST not adjusted for, matching `hedge_blocks_2026.json`).
That formula independently reproduces the mockup's own hardcoded
`1,00 MW → 768,00 MWh` for Peak Q1 2027, which is what validates it.

**A roster line carries `{id, name, sub}` and no power.** The desk needs the
metering points — it is the only place they are named — but nobody chose a
per-connection allocation, so inventing one would be the "derived detail must
not out-claim its source" failure this file already records for the seeded
Pricing card. `buildRequest()` therefore takes the size as `opts.powerMw`
rather than summing lines. Deleting `connections` outright was the other
option and is worse: the desk's request card renders it, and
`confirmedBlocksForRange()` reads it guarded, so it would have yielded **zero
hedge blocks** — every confirmed trade silently dropping out of the
Consumption hedge line — with nothing logged.

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

## Customer onboarding (`customer-onboarding.html`)

The flow a customer signs up through, before either portal has an account for
them. A standalone page: it reads no seed data, writes no link, and knows
nothing about the portals — a person on step 1 does not have an account yet,
so there is nothing for it to join to.

Ten steps in six groups — Account, Company (three), Profile, Verification,
Agreement (three), Done — with the answers and the rules in `onboarding-flow.js` and
only the rendering in the page. Same split as every other calculating module
here, for the same reason: `stepValid()` and `hint()` are what stand between a
half-filled application and the desk, and they are worth testing.

### The two rules that hold the flow together

**`stepValid()` refuses and `hint()` says why — always both.** Every reason a
step can refuse has a line naming the field that is missing, and a test asserts
the pairing: for each refusable step, the refusal must read differently from
the all-clear. A disabled Next with no explanation is the whole failure this
prevents.

**Four steps are always passable on purpose.** The registered address may
genuinely not exist, the industry is optional, the one cent can arrive after
submission, and step 9 is a receipt rather than a question. Refusing on those
would block an application the desk is perfectly able to finish — which is what
the copy on each of them says out loud.

### Easy to get wrong

- **`volumeIndex` and `authorityIndex` start at −1, not 0.** Index 0 is a real
  answer in both lists ("Less than 250 MWh", "Yes, I am authorised to sign"),
  so a falsy test would treat the first option as no answer at all.
- **`[].every()` is `true`.** Step 8 checks the list's length as well as every
  row being complete, or an empty list submits an agreement nobody signs.
- **"Together with another authorised person" means two.** `minSignatories()`
  is the one place that rule lives, read by both `stepValid()` and the remove
  button — otherwise the second row can be deleted and the application submits
  with one signer under an answer that says two.
- **A KvK number is eight *digits*, not eight characters.** `kvkDigits()`
  strips formatting first, so a number pasted as `24 39 81 12` is accepted.
- **The email check is deliberately loose** — an `@` past position 0. Position
  0 matters: `@company.nl` has no local part. A stricter pattern refuses real
  addresses more often than it catches a typo.
- **A Dutch legal form ends in a full stop.** Any sentence that appends one
  after the company name prints "B.V..".

### Typing must not re-render

`setField()` stores the value and calls `refreshFooter()` — never
`renderStep()`. Two reasons, both already recorded elsewhere in this file: a
re-render rebuilds the `<input>` under the caret, and blur fires on the
**mousedown that begins a click**, so rebuilding here would replace the Next
button between mousedown and mouseup and the browser would raise no click at
all.

That makes the footer the live part of the page: the hint, the Next button's
label and enabled state, and the two readouts that sit inside a step body and
change while a neighbouring field has focus — `#password-note` (which counts
down rather than repeating the rule) and `#mail-greeting` (the name in the
preview email). Both are patched by id, so keep the ids.

**Everything else re-renders**, because nothing else can hold a caret: picking
a choice, toggling the terms, adding or removing a signatory, and the two bank
actions. The two `<select>` handlers do neither — nothing on the page reads
the entity type or the industry until step 9's summary, which is rebuilt on
the way there.

**Enter advances the flow.** There is no `<form>` — the ten steps are one
long-lived page, not nine submissions — so the browser has no
implicit-submission path to inherit, and a keydown listener on the step body
supplies it. Fields carry a real `<label for>` and an `autocomplete` token;
the password's is `new-password`, since the browser's stored one would be
the wrong account's.

### Step 6's two banners are independent

A prepared bank transfer and a settled iDEAL payment are separate facts — a
transfer can be in flight when the cent arrives another way — so the two
banners stack rather than chaining through `else if`. Chaining them hid the
instructions banner the moment the cent landed, and that banner is the only
place the `PP-ONB-7F3K` payment description is explained.

Both live in `bankAfterHtml()` rather than inline in `step6Html()`, because
`downloadInstructions()` patches `#bank-after` instead of re-rendering — see
below.

### Download deposit instructions is a real file

`PeakPower_Funding_Instructions.docx` sits in the repo root and the control is
an `<a href download>`, not a button: the browser downloads it on the click
itself and right-click → Save as works. It used to be a `<button>` whose handler
only raised a banner claiming a PDF was ready — there was no file, and the
format was wrong.

Two things that has to keep:

- **`downloadInstructions()` must not call `renderStep()`.** It patches
  `#bank-after` in place, because re-rendering removes the `<a>` that is
  mid-click from the document and a browser will not follow a link whose element
  left the page during the click. Same failure as the blur rebuilds elsewhere:
  the handler runs and nothing downloads.
- **The button chrome is an element selector, which an anchor never matches.**
  The base rule is `button, a.btn-secondary`, and `.btn-sm` had to become
  `.btn-sm, a.btn-sm` with it — `a.btn-secondary` (0,1,1) out-specifies a bare
  `.btn-sm` (0,1,0), so the link kept the full-size padding and sat taller than
  the button it replaced.

`INSTRUCTIONS_FILE` is the filename written once: it is both the `href` and the
name the banner reads back.

### The authority answer decides who signs

Step 7 rebuilds the signatory list, because the answer *is* who signs:
`signatoriesForAuthority()` gives "I sign alone" the applicant alone,
"together with another" the applicant plus a blank row so the requirement is
visible rather than implied, and "someone else signs" a blank row with the
applicant dropped — they manage the account but do not sign it, and leaving
them listed would send them an agreement they cannot execute.

**The applicant's own row is `locked`**: disabled in the markup, and refused by
`setSignatory()` and `removeSignatory()` in the handler. It is their account,
and editing it here would silently disagree with the name on step 1.

**Answering step 7 *differently* discards rows the new answer does not keep.**
That is correct — those rows answered a different question — but `pickAuthority()`
returns early when the option clicked is the one already chosen. Without that
guard, going back and clicking the highlighted option wipes every colleague
typed in on step 8 with nothing on screen having changed.

### Signing with a code

There is no drawn signature. Each signatory is emailed six digits, and typing
them back with the agreement ticked **is** the signature — step 9, gated by
`stepValid`:

```js
case 9:
  return signCodeMatches(state.signCode) && state.agreedDocs === true;
```

**Both, and in that order.** A code without the agreement signs nothing, and the
agreement without the code is nobody in particular ticking it. `hint()` tells
the three refusals apart — no code, wrong code, unticked — because a disabled
button with one message for three problems is the failure this flow exists to
avoid.

`SIGN_CODE` is `"748213"` and `codeDigits()` strips everything else, so a code
read off an email and typed as `748 213` still matches. It is **not a
credential**: a constant shipped to the browser, in a flow that submits nothing,
and the email preview prints it because a code nobody can read is a demo nobody
can finish.

**Both step-9 fields patch, never re-render.** `setSignCode()` calls
`refreshFooter()`, and `toggleAgreedDocs()` rewrites the box's own class and
tick by id — `renderStep()` there would rebuild the code input sitting above it,
and the tick is drawn by us rather than by a native checkbox, so it cannot be
left to the browser either.

### The two outcomes, and never the wrong one

Step 10 is the end, and it is two different endings. The welcome email says
every document was reviewed and the account is active — only true once the cent
has cleared — so an unverified bank account gets `heldForReviewHtml()` instead
and **no welcome email at all**.

The heading has to follow it. `F.stepTitle(state)` / `F.stepIntro(state)` are
what `renderStep()` reads, not `STEPS[i].title`, because "Welcome to PeakPower ·
your account is active" printed over a badge reading "With the desk" is exactly
the contradiction this splits. Every other step returns its own record's string,
and a test asserts that plus the absence of the word "active" from all three
held-for-review lines.

**Anything that holds an account up is handled by a person.** That is the
model: the desk writes to the customer from `support@peakpower.nl` for the
document or the clarification it needs. The bank verification is the one such
case this flow can reach on its own, and its banner says so in those words.

### Every email comes from support@peakpower.nl, and names a person

`F.SUPPORT_EMAIL` is the only sender, and it is **deliberately not a no-reply
address** — every email here invites a reply, and the manual route above depends
on the customer being able to answer one. A test asserts the string contains
neither `no-reply` nor `noreply`.

**The body names the person who applied, not the company.**
`"Vandersteen Koeling B.V. has completed its onboarding"` reads as though a
building filled in a form, and the recipient needs to know who to ask about it —
so it is `F.fullName(state.f)`. The company still appears, in the facts block
where it belongs.

`codeMailHtml(recipientFirst, addressedToApplicant)` is the one email, rendered
twice: step 8 previews the copy a colleague opens (greeting patched by id as the
name is typed), step 9 shows the applicant their own. Two copies of one email is
two bodies that drift.

**The welcome copy was supplied and two names in it were not ours** — it
referred to another company and another product. Those are the customer's own
name and "PeakPower"; nothing else in it was reworded.

### Next is a property of the step

`STEPS[i].next` carries the button's label ("Create account", "Submit and send
the codes", "Sign the agreement"), and the footer falls back to "Next". It used
to be `state.step === LAST_STEP - 1 ? "Submit application" : …` — index
arithmetic that a tenth step would have silently pointed at the wrong button.

**A new page needs a card on `index.html`.** That landing page is how the demo
is reached, and a page missing from it is a page nobody opens. Onboarding
leads at full width because it is where the journey starts; the two portals
share the row below.

**One hue per destination on that page**, each the one the destination itself
wears: blue-050/blue-700 for the customer portal, violet for the desk, mint
for the way in. Two cards sharing a tag background read as one category split
in two, which is what happened when onboarding's tag was added on the portal's
own pair.

### What this page does not share

- **A 296px rail, not the portals' 236px.** Ten step labels, and "Authorised
  signatories" wraps at 236.
- **Its rules read the ramps, not the `--pp-teal-*` aliases.** The portals'
  own `.banner-teal` and `.ds-banner.info` still use those — they were written
  before the palette rewrite, which is exactly what the aliases exist for. This
  page came after it, so its info banner is `--pp-mint-bg` /
  `--pp-mint-border` / `--pp-blue-700`. That moves the border one tier, to the
  mint border that actually pairs with the background; `#43d3a6` is
  `--pp-sidebar-subtitle`'s hue and has no border role of its own.
- **`#7b8ba0` and `#93a2b5` stay literal**, because the portals hardcode them
  too — the muted sidebar greys have no token in the shared block, and adding
  one for a single page would break the four-file byte-identical `:root`.
- **Its own breakpoint at 900px**, below which the rail goes horizontal and
  every two-column row stacks. Card, Badge, Banner, Button and StatCard are
  hand-reimplemented here for the third time — there is no build step to share
  them through, so a change to one is a change to make three times.
- **`?prefill=1` writes a plaintext demo password into the page state.** It is
  synthetic, on a page that authenticates nothing, but it is in the source and
  worth knowing before this page is shown to anyone.

### Demo affordances

**The Prefill demo data toggle** sits in the rail's footer, with the demo
chrome rather than in the form, and fills or empties the whole application
without leaving the step you are on — sending the reader back to step 1 to see
a step filled in is the opposite of useful. It replaces the state rather than
patching it, so switching it off is a real reset; a half-cleared application
would be neither end.

**`prefilledState()` answers every field, not only the gated ones.** The entity
type and the bank verification are answers too, and leaving them at their
defaults made "prefilled" quietly untrue — the industry likewise sat on "Not
specified". The test that pins this is that **all ten steps validate** against
it and step 9's read-back contains no blank, which is a stronger statement than
listing the fields and one that cannot go stale as fields are added.

`?step=N` opens on a step (clamped to 1–9 by `clampStep()`, so a bad link lands
on a real one), `?prefill=1` opens with the toggle on, and `?bankVerified=0`
turns the cent back off on an otherwise complete application — the one state
prefill cannot express, and what step 9's amber card exists for. None is
required and none changes the rules.

**The rail only goes backwards.** `goStep()` refuses `n > state.step`, and a
step that has not been reached carries no handler and no pointer cursor —
a rail that looks clickable everywhere and answers on three of nine is worse
than one that does not.

**Nothing is submitted.** There is no back end and no cross-portal link here;
the page says so at the foot of every step. If onboarding should ever hand an
application to the Back Office, that is a new contract to design — the desk's
own Add customer flow is where a customer is created today.

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
| **Customers** | `back-office-screens-data.js` + `state.newCustomers` | list / **new** (a three-step wizard, `state.customerView`) / detail (`state.customerId`), with editable Commercial settings and, on customers created here, inline Add connection / Add account. `buildCustomerDetail()` is ported verbatim, including its synthesised branch for every customer other than Vandersteen |
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

**A live request's "The request" card lists connections and nothing else.**
Columns are `CONNECTION` and `EAN`; the totals sit in a footer built in
TRD-1058's own format — a 2px `--pp-border-strong` rule, "Total requested"
at 12.5px/700 with a direction+shape badge beside it, and
`formatMw(powerMw) + " · " + formatMwh(volumeMwh)` right-aligned at 14px/700.
The desk prices the whole request, and there is no per-connection split to
show: a roster line carries `{id, name, sub}` and no power, because nobody
chose a per-connection allocation. Everything else about the request stays in
the **Request details** card in the side column.

**The EAN on a published request comes from the record, not a lookup.**
`submitWizard()` maps `connectionEan(id)` onto each roster line's `sub`
before `buildRequest()` sees it. Without that the desk's EAN column renders
blank, which is what it did for as long as the column was a small grey
sub-line nobody looked at. `connectionEan()` is the single lookup, shared with
the wizard's own cards.

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

### Adding a customer

`Add customer` on the Customers list opens a **third view on the same screen**
(`state.customerView`, `"list" | "new"`), alongside the detail view
`state.customerId` already switches to. `renderCustomers()` checks the detail
first, then the wizard, then falls through to the list; `customersChrome()`
branches the same three ways.

**The wizard is three steps** — Company, Connections, Accounts — held in
`state.customerWizard` (`{step, draft, errors}`). The topbar carries them:
`Cancel`/`Next` on step 1, `Back`/`Next` on step 2, `Back`/`Create customer` on
step 3, with the step named in the crumb.

**Each step validates only its own slice.** `validateWizardStep()` writes just
that step's part of `errors`, so a problem on step 1 cannot block step 3 and the
other way round. **Back never validates** — being blocked from going back to fix
the thing you are going back to fix is the whole failure mode. `createCustomer()
re-checks step 1 itself` and jumps back to it if needed, because the KvK could
have been taken by another customer created since it was typed.

**A created customer is page-local.** `state.newCustomers` holds them newest
first, and `customersAll()` is the join with the seeded `CUSTOMER_LIST` — read
that anywhere the screen lists or finds a customer, not `CUSTOMER_LIST`. Two
lookups deliberately stay on the seeded list: `walletKvk()`, because a wallet
row is a seeded fixture and a page-added company sharing a name prefix could
only mis-match it, and `customerRecordFor()`, which serves seeded trades. A
reload is back to the eight seeded rows.

**The desk asks what the onboarding flow asks.** A customer created at the desk
and one who signed themselves up carry the same record, so step 1 covers the
legal form, the registered address (street / city / postcode), the industry,
the direction and the annual volume band as well as the bank and contact
details it always had.

**The option lists come from `onboarding-flow.js`, not a second copy.**
`ENTITY_TYPES`, `INDUSTRIES` and `FLOWS` are read straight off it — the desk
loads that module for its lists alone. Two copies of "the industries" is two
lists that drift, and the one the customer picked from would stop matching the
one the desk sees.

**`VOLUME_BANDS` is the one place they differ**, and deliberately: it prefixes
the onboarding bands with "Not given". Onboarding refuses to continue without a
band; the desk requires only a legal name, a KvK and a contact, so it needs a
way to say the question was not asked.

**The step-1 cards are dealt alternately into two columns**, not named by
index. The layout used to read `cards[0] + cards[2]` / `cards[1] + cards[3]`,
so adding a group meant editing that line too — and forgetting left the new
card off the step with nothing on screen to say so.

**The Prefill demo data toggle fills all three steps**, not just the first —
company, connections and accounts — and sits in the wizard's own topbar chrome
so it is reachable from every step. It replaces the draft rather than patching
it, so switching it off is a real reset, and it clears the errors with it: a
red flag pointing at a field that has just been refilled is worse than none.
`topbarActions` grew an `html` action for it, because a switch is not a button.

**Its KvK walks with the number of customers already created.** A fixed one is
refused as "Already in use" the second time the toggle is used in a session,
which reads as the toggle being broken rather than the validation working. Its
accounts include an Admin for the same reason — `customerAccountsFormError`
would otherwise refuse step 3, and a prefill that cannot be submitted is not a
prefill.

**Required is still only legal name, KvK and the contact's name and email.**
Everything else is paperwork that arrives later and renders `—` until it does;
the new selects all carry a default, so none of them adds a way to be refused. Formats checked: KvK (8 digits, unique), email, EAN (18 digits,
unique within the customer), and IBAN *when non-blank*. Everything else is free
text — a format rule nobody can satisfy is worse than none.

**The KvK rules are the ones with teeth.** `state.commercialByCustomer` and the
cross-portal terms link are both keyed by KvK, so a number already in use would
hand the new customer another company's deposit percentage.

#### Typing, flagging and re-rendering

**Editing a field never re-renders** — a re-render rebuilds the `<input>` under
the cursor and steals focus mid-keystroke, the rule `updateCommercialField()`
already follows. **Adding or removing a row does**, because every handler in
those tables has its row index baked in and the rows below a removed one would
otherwise write to the wrong record.

**A red flag is dropped the moment its field is edited**, by patching that one
control (`clearControlError`) rather than re-rendering: otherwise a field that
has just been corrected goes on claiming it is wrong until the step is submitted
again. `refreshWizardBanner()` takes the refusal banner away once nothing is
left for it to point at, so it can't sit there telling you to check fields that
are no longer marked.

**`errors.form` is the one error not tied to a field, and every path that could
fix it has to clear it.** It carries "at least one account must be an Admin", so
`updateCustomerRow()` clears it on any account edit and `removeCustomerRow()`
recomputes it — deleting the last account otherwise left a critical banner
demanding an Admin over an empty table that says accounts are optional.

#### What a created customer looks like

`buildNewCustomerDetail()`, chosen by `c.isNew`, deliberately **not**
`buildCustomerDetail()` — that synthesises a VAT number, an IBAN, metering
points and staff accounts out of the KvK, which is furniture for the mockup's
fixtures and invention for a record made a minute ago, under a card badged BANK
DETAILS VERIFIED.

- **Connections are derived, never stored:** `connections` is
  `meteringRows.length`, so the CONNECTIONS stat card cannot contradict the
  table underneath it. An earlier version asked the desk to type a count and it
  did exactly that. **The Customers list derives the same cell the same way** —
  the created record has no `connections` key at all, so reading it there
  rendered a blank cell above eight seeded rows that all showed a number.
- **The bank badge follows the data:** BANK DETAILS PENDING (amber) while
  IBAN/BIC/holder are incomplete, BANK DETAILS UNVERIFIED (neutral) once all
  three are there. Never *verified* — nobody verified them.
- **Trade name is a field, not a derivation.** Copying the synthesis's
  `name.replace(' B.V.', '')` was the mistake to avoid: a trade name is a
  separate registration, and the one row where this repo knows the answer says
  so — Vandersteen Koeling B.V. trades as *Vandersteen Cooling*.
- A new connection reads `No data yet` (or the fixtures' `Not tradeable` for
  gas), a new account `Invited` with a `resend` action — the state the seeded
  R. Smit row is already in. The **email is the login**, so it fills the
  USERNAME column.
- **A created customer's table shows full 18-digit EANs**, where the fixtures
  show a truncated `…0011`. Its table is entirely rows the desk typed, so the
  two conventions never mix in one table — but the EAN column has to widen to
  fit them, keyed off the content rather than off `isNew`.

#### Adding rows afterwards

On a created customer's detail page the topbar's `Add connection` and the
accounts card's `Add account` open an inline draft row in the relevant table
(`state.detailRowDraft`), reusing the wizard's own field lists and control
renderer — so a connection added here and one added during creation cannot ask
for different things. `saveDetailRow()` validates the draft **as the last row of
what is already there**, which is what makes the duplicate test see the existing
rows. Seeded customers keep inert buttons, and `startDetailRow()` re-checks
`isNew` itself rather than trusting the markup.

**The draft row is laid out on the table's grid, in the table's column order,
which is not the order the wizard asks in.** `DETAIL_ROW_EDITORS` holds that
order per kind, because an account is *typed* name/email/role and *displayed*
name/role/username: reusing the wizard's order put the email input under the
ROLE heading and then moved it again on save. The blank entry covers the columns
a new row has nothing for (valid-to, last-sign-in) and Save/Cancel span the last
two. Its controls use `FORM_INPUT_ROW`, the same chrome at a row's metrics —
the standard 13px/12px control leaves a select in a 1fr column reading "Ele".
`detailRowEditorHtml()` resolves its field list **at call time**: those lists are
declared with the wizard further down the file, so at that point in the load they
are still var-hoisted `undefined`.

**A half-typed wizard or draft row is dropped when the screen is left** —
`closeCustomerDetail()` clears both, and `goTo()` already calls it on the way
out of Customers.

### Account roles

Three roles, weakest first, in `ACCOUNT_ROLES` (`back-office-screens-data.js`),
and **cumulative** — each grants everything the one before it does, so `extra`
lists only what it adds:

| Role | Adds | Badge |
|---|---|---|
| `Viewer` | view everything; change nothing | neutral |
| `Trader` | request and accept trades, deposit funds | info (violet) |
| `Admin` | withdraw funds, add/remove EANs, manage users, the four-eyes setting | brand (teal) |

The accounts table's column is **`ROLE`**, not the mockup's "ROLE IN COMPANY",
and the card's subtitle is "each account holds one role" — it used to read "all
accounts have identical privileges", which stopped being true the moment roles
existed. The mockup's four job titles were remapped onto these roles (Admin,
Admin, Trader, Viewer), as were the two synthesised for every other customer: a
column carries one vocabulary or it means nothing. The Customer Portal's trade
timelines were changed the same way — `"J. de Vries · Energy Manager"` is now
`"· Admin"` in **three** files: `portal-seed-data.js` and `customer-portal.html`
for the seeded rows, and `portal-trade-link.js` (four hardcoded `by`/`actor`
defaults) for every *live* trade. Missing the third left the same person reading
as "Admin" on a seeded trade and "Energy Manager" on a live one in the same list,
and `respondToOffer`'s default is persisted into `response.by` and read back by
the Back Office, so the stale word would have crossed portals.

**At creation, accounts are optional but must include an Admin if there are
any** — a customer with users and no Admin has nobody who can manage its own
users. **On the detail page that is a warning, not a refusal:** adding a Viewer
before the Admin is a normal order to work in, and the customer already exists.

### Four-eyes approval

A `fourEyes` field in `COMMERCIAL_FIELDS`, edited through a select (the
`choices` property; the commercial edit form gained a branch for it, and
`updateCommercialField()` carries `choices` through or the select loses its
options on the first keystroke). Per customer, page-local like every other
commercial field except the deposit.

**Deliberately not in `portal-terms-link.js`.** That module's contract is "terms
the Customer Portal obeys", and no second-approver step exists in either portal —
putting it there would claim a cross-portal rule that isn't real. The card says
what it would gate and that it is recorded, not enforced.

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

- **Power is MW at exactly 2 decimals**, through the single formatter
  `PortalTradeLink.formatMw()` — `"1,00 MW"`, `"−0,09 MW"`. Two decimals
  because 0,01 MW is the grid the wizard trades on (`MIN_VOLUME_MW` /
  `VOLUME_STEP_MW`), so a third decimal only ever showed a rounding artefact.
  The minus is **U+2212**, not `formatNL`'s ASCII hyphen, so a sold position
  reads the same as the seeded rows that always wrote it that way. Volume
  (MWh) stays 2 decimals, prices 4. `hedge_blocks_2026.json` stores its
  powers at 2 decimals too, so the stored figure and the screen agree rather
  than the screen rounding a number the maths does not use.
- **A grep for `formatMw` does not find them all.** Seeded display strings
  (`portal-seed-data.js`, `back-office-desk-data.js`,
  `back-office-screens-data.js`) and hand-built `formatNL(x, N) + " MW"` are
  invisible to it, and nothing tests them — miss one and the desk renders two
  precisions side by side with a green suite. `deriveConnRows()` in the back
  office rounds its *maths* to 2 decimals as well as its display: rounding
  only the display prints 0,67 + 0,67 + 0,67 under a "2,00 MW" footer.
- Timestamps are local Netherlands delivery time in `timestamp`, UTC in
  `utctime`; `is_dst` flags summer-time intervals.
- All power values are **kW** (average over the 15-min interval), not kWh.
- Generated JSON is snake_case; the two original source files kept their
  as-delivered names.
- **No Python files and no build step.** If a task would otherwise call for a
  `.py` script (reshaping data, generating a test dataset), write JS instead —
  a dual Node/browser module if the page needs it, or a one-off ephemeral
  script (not checked in) for pure data prep.
