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
3. **A generated, regeneratable data-driven page** — `Customer Portal -
   Consumption (Live Data).html` — plus the Python generator
   (`generate_consumption_data.py`), a pure JS calc module
   (`consumption-calc.js`), and 3 test suites (`test_generate_consumption_data.py`,
   `consumption-calc.test.js`, `verify_consumption_page.py`). Unlike the two
   mockups above, this page is real, testable code: rebuild it with
   `python3 generate_consumption_data.py` rather than hand-editing the HTML.
   Running its test suites needs Python 3 plus Node.js (for
   `consumption-calc.test.js`).

There is no package.json or wider build system in this folder — the two
portal mockups remain design mockups / flat JSON/CSV test data, but the
Consumption (Live Data) page and its generator/tests are application code.

## Repository contents

| File | Size | What it is |
|---|---|---|
| `Customer Portal - Preview.html` | ~545 KB | Bundled static preview of the customer-facing portal |
| `Back Office Portal - Preview.html` | ~501 KB | Bundled static preview of the internal back-office portal |
| `EPEX tariffs 15 min interval.csv` | ~3.6 MB | Source EPEX day-ahead tariff export, 20,828 rows (15-min intervals) |
| `epex_tariffs_15_min_interval.json` | ~11.2 MB | Same tariff data as JSON (one object per row) |
| `epex_usage_15_min_interval.json` | ~66 MB | Generated consumption/production test data, 6 sites × 20,828 intervals = 124,968 rows |
| `epex_tariffs_usage_combined_15_min_interval.json` | ~75 MB | Tariff + usage merged into one record per site per interval, 124,968 rows |
| `remap_eans.py` | ~3 KB | Script that remapped the original 5-profile files' EANs to match the Customer Portal `CONNECTIONS` list and generated the new `office` (Almere) profile rows. Not idempotent — see note under Generation methodology. |
| `hedge_blocks_2026.json` | ~5 KB | Test hedge/trade block data (Base & Peak shapes) per EAN — backs the hedge cost/coverage figures on the Consumption (Live Data) page (see below) and a future *Trading* screen — see "Hedge block test data" below. |
| `gen_hedge.py` | ~3 KB | Generator script for `hedge_blocks_2026.json`. Re-runnable — supports MONTH/QUARTER/YEAR periods via `month_period()`/`quarter_period()`/`year_period()`. |
| `generate_consumption_data.py` | ~16 KB | Generator + page-assembly script for the Consumption (Live Data) page — see "Consumption (Live Data) page" below. Companion tests: `test_generate_consumption_data.py`, `consumption-calc.test.js`, `verify_consumption_page.py`. |
| `consumption-calc.js` | ~1 KB | Pure JS stat/formatting module used by the Consumption (Live Data) page (dual Node/browser module). |
| `consumption_live_data.json` | ~1.7 MB | Generated compact per-site/per-date consumption/production/EPEX data plus each site's hedge blocks, embedded into the Live Data page. |
| `Customer Portal - Consumption (Live Data).html` | ~1.7 MB | Standalone, hand-written (not bundled/exported) page showing real 15-minute interval data for a selectable connection and date. |

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
- The original 5-profile generation script is **not** checked into this
  repo — it only exists as the Python used in the Claude session that
  produced the first version of these files. `remap_eans.py` (added when
  EANs were aligned to the Customer Portal) **is** checked in and covers
  the EAN/name remap plus the new `office` profile generation, but it
  expects the pre-remap 5-profile files as input, not the current ones —
  don't rerun it as-is. If asked to regenerate or further extend the
  dataset (e.g. add a 7th site, change a profile, or extend the date
  range), rebuild the per-organization profile functions described above
  rather than assuming a full end-to-end script exists here.

## Hedge block test data

`hedge_blocks_2026.json` (generated by `gen_hedge.py`) is placeholder test
data for a future *Trading* screen: one row per EAN per shape, expressing
a hedge as a power (MW) held for a period, converted to energy (MWh) and
to kW/kWh equivalents.

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

The current file only contains the `YEAR` / `2026` period (6 EANs × 2
shapes = 12 rows), using a uniform placeholder `power (MW)` of `1.0` and
round offered prices (€70/MWh base, €95/MWh peak) so the volume math is
easy to hand-verify. `gen_hedge.py` exposes `month_period()`,
`quarter_period()`, and `year_period()` builders plus `build_rows()`, so
adding e.g. an `"Aug 2026"` MONTH row or a `"Q1 2027"` QUARTER row (both
periods already referenced in the portal mockup's example trade blocks)
is a matter of calling the right builder — it doesn't yet do so
automatically. The gas connection (`tilburg-gas`, EAN
`871687100000000092`) is intentionally excluded — "Not tradeable" in the
portal mockup.

## Consumption (Live Data) page

`Customer Portal - Consumption (Live Data).html` (generated by
`generate_consumption_data.py`) is a standalone companion to the Customer
Portal mockup's *Consumption* screen — instead of the mockup's seeded
placeholder data, it reads real 15-minute consumption/production/EPEX data
straight from `epex_tariffs_usage_combined_15_min_interval.json` for a
connection and date picked from dropdowns (all 6 electricity sites; any
date 2026-01-01 through 2026-08-05), plus a **Day / Month** chart toggle
(below). It doesn't modify or depend on `Customer Portal - Preview.html` —
that file stays a pure design mockup.

**Scope:** Day and Month views (no Quarter view). No hedge-cover line is
drawn on the chart itself — hedge figures are shown in the stat cards and
table only. `tilburg-gas` is excluded — it has no usage rows and no hedge
rows.

**Data shape** (`consumption_live_data.json`, embedded inline in the HTML —
no `fetch`, no network requests, opens directly via `file://`):

```jsonc
{
  "sites": [{ "id": "rot", "ean": "871687100000000011", "name": "Rotterdam DC" }, "... 6 total"],
  "byDate": { "2026-01-01": { "t": ["00:00", "..."], "p": [0.0896, "..."] }, "... 217 dates" },
  "bySite": { "rot": { "2026-01-01": { "c": [612.4, "..."], "g": [0.0, "..."] } }, "... 6 sites" },
  "hedge": { "rot": [{ "shape": "base", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.07 }, "... base + peak"], "... 6 sites" }
}
```

`byDate[date].t`/`.p` (local time-of-day, EPEX €/kWh) are stored once per
date and shared across sites; `bySite[id][date].c`/`.g` are per-site
consumption/production (kW), index-aligned with `byDate[date].t`. Array
length is 96 every day except 2026-03-29 (the spring-forward DST day),
which has 92. `hedge[id]` is a list of hedge blocks straight from
`hedge_blocks_2026.json` (currently 2 per site: `base` and `peak`, both
covering all of 2026) — kept generic (period start/end per block) so
future MONTH/QUARTER hedge rows would be picked up without a code change.

**Calculations** (`consumption-calc.js`, unit tested via
`consumption-calc.test.js`), per 15-minute interval:
- `energy_kWh = power_kW × 0.25`.
- **Net cost** = net (consumption − production, kWh) × that interval's
  EPEX price — the daily/monthly total of this is the "Net cost" stat card
  (formerly labeled "Spot result").
- **Hedge volume/price/cost** — a hedge block is active for an interval if
  the date falls in its period, and — for `peak` blocks only — the
  weekday is Mon–Fri and the time is 08:00–20:00; volume is
  `powerKw × 0.25` per active block, summed; price is the blended
  cost/volume across simultaneously-active blocks (e.g. base+peak both
  active on a weekday during peak hours).
- **Uncovered** = net (kWh) − hedge volume — can go negative
  (over-hedged that interval/day/month).

Net cost is intentionally independent of the hedge (it answers "what would
this cost at spot price alone"); hedge cost and uncovered are the separate
"what's locked in" / "what's still exposed" figures. Numbers display
NL-style (comma decimal, period thousands separator).

**Hover:** hovering the chart (Day or Month) highlights and scrolls to the
matching row in the table below, via a shared cursor-position →
nearest-interval-index calculation (one listener per chart, not per mark,
so it scales to the Month view's ~2,976 points).

**Month view:** a second chart type (line/area, not bars — a bar per
15-minute interval isn't legible at a whole month's density) plotting
every interval of a selected month in one horizontally-scrollable chart;
the month dropdown is derived from the data's actual coverage, so the
trailing partial month (August 2026, only 5 days) renders correctly with
no special-casing. The table below follows whichever mode (Day/Month) is
active.

**Regenerating:** `python3 generate_consumption_data.py` rebuilds
`consumption_live_data.json` and the HTML page from the current combined
dataset *and* `hedge_blocks_2026.json`; `python3 verify_consumption_page.py`
cross-checks the result (site/date coverage, DST-day interval count,
HTML-embedded data matching the standalone JSON, one site/date's usage
values matching the raw source rows exactly, and the embedded hedge blocks
matching `hedge_blocks_2026.json` with a numeric spot-check of the
weekday-peak vs. off-peak formulas).

## Conventions

- Timestamps are local Netherlands delivery time in `timestamp`, UTC in
  `utctime`; `is_dst` flags summer-time intervals.
- All power values are **kW** (instantaneous average over the 15-min
  interval), not kWh.
- File naming is snake_case for generated JSON, but the two original
  source files (`EPEX tariffs 15 min interval.csv`, one JSON export) kept
  their original human-readable / snake_case names as first delivered —
  no strict convention enforced yet across the two source files.
