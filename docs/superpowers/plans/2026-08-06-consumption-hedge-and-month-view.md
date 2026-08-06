# Consumption Hedge Columns, Hover, and Month View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `Customer Portal - Consumption (Live Data).html` with per-interval hedge/cost figures (from `hedge_blocks_2026.json`), hover-linked chart↔table highlighting, and a new full-resolution Month chart view — without changing the existing Day-view data model.

**Architecture:** `hedge_blocks_2026.json` is folded into the existing compact dataset under a new `hedge` key (per site, generic block list — not hardcoded to "one yearly block"). Two new pure functions in `consumption-calc.js` (`computeIntervalHedge`, `computeIntervalSeries`) plus an extended `computeDayStats` compute per-interval and daily hedge/cost figures, unit tested directly. The page's template gains 5 new table columns, 2 new stat cards (plus one rename), a shared hover-highlight mechanism driven by cursor position (not per-mark listeners, so it scales to ~2,976 points), and a second chart type (Day = bars, Month = line/area) that the table follows.

**Tech Stack:** Same as the existing page — Python 3 stdlib, vanilla ES5 JS, Node.js for JS tests only (not a page runtime dependency).

## Global Constraints

- Hedge block matching: a block is active for `(date, time)` if `date` falls within `[periodStart, periodEnd]` (inclusive, ISO string comparison); `peak` blocks are additionally active only when the weekday is Mon–Fri (JS `Date.getDay()` in `[1,5]`) and the hour is in `[8, 20)` (08:00 through 19:45 inclusive) — matching `gen_hedge.py`'s own `d.weekday() < 5` / "08:00–20:00" definition exactly. `base` blocks have no time restriction.
- Volume per active block = `powerKw × 0.25` (kWh). Blended hedge price for an interval = total hedge cost ÷ total hedge volume across all simultaneously-active blocks (guard divide-by-zero → `0`).
- Net cost (€) per interval = `(consumption − production) × 0.25 × epexPrice` — independent of the hedge (this is deliberate: it's "what this interval would cost at spot price alone," not netted against hedge coverage). Uncovered (kWh) = net (kWh) − hedge volume (kWh); can be negative.
- Display precision: kWh/kW values — 1 decimal; €/kWh — 4 decimals; € cost values — 2 decimals; NL-style number formatting throughout (comma decimal, period thousands separator) via the existing `ConsumptionCalc.formatNL`.
- `computeDayStats`'s existing 4-argument call signature (`times, prices, consumption, production`) must keep working unchanged (existing Node tests call it this way) — hedge support is added as two new *trailing* optional parameters, not a signature rewrite.
- No new files are created by this plan — only existing files (`generate_consumption_data.py`, `consumption-calc.js`, `consumption-calc.test.js`, `test_generate_consumption_data.py`, `verify_consumption_page.py`, `CLAUDE.md`, and the two generated artifacts) are modified.
- No hedge-cover line/overlay is drawn on the chart itself (day or month) — hedge figures appear only in stat cards and the table, per the approved spec's non-goals.

---

### Task 1: Hedge data pipeline (`generate_consumption_data.py`)

**Files:**
- Modify: `generate_consumption_data.py`
- Modify: `test_generate_consumption_data.py`

**Interfaces:**
- Produces: `build_hedge_section(hedge_rows: list[dict]) -> dict` returning `{site_id: [{"shape": str, "periodStart": str, "periodEnd": str, "powerKw": float, "priceKwh": float}, ...]}` for all 6 `SITE_META` ids (empty list if a site has no hedge rows). Rows for EANs not in `SITE_META` are silently skipped, matching `build_compact_dataset`'s existing convention.
- Consumes (in `main()`): the existing `HEDGE_PATH` constant (new) pointing at `hedge_blocks_2026.json`.

- [ ] **Step 1: Write the failing tests**

Add to `test_generate_consumption_data.py` (append after the existing `BuildCompactDatasetTests` class, before the `if __name__ == "__main__":` line):

```python
from generate_consumption_data import build_hedge_section

def make_hedge_row(ean, shape, period_start, period_end, power_kw, price_kwh):
    return {
        "EAN": ean,
        "shape": shape,
        "periodStart": period_start,
        "periodEnd": period_end,
        "powerKw": power_kw,
        "priceKwh": price_kwh,
        "organization_name": "irrelevant for this function",
        "periodType": "YEAR",
    }


class BuildHedgeSectionTests(unittest.TestCase):
    def test_groups_by_site_with_only_needed_fields(self):
        rows = [
            make_hedge_row(ROT_EAN, "base", "2026-01-01", "2026-12-31", 1000.0, 0.07),
            make_hedge_row(ROT_EAN, "peak", "2026-01-01", "2026-12-31", 1000.0, 0.095),
        ]
        result = build_hedge_section(rows)
        self.assertEqual(result["rot"], [
            {"shape": "base", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.07},
            {"shape": "peak", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.095},
        ])

    def test_unknown_ean_is_ignored(self):
        rows = [make_hedge_row(UNKNOWN_EAN, "base", "2026-01-01", "2026-12-31", 1000.0, 0.07)]
        result = build_hedge_section(rows)
        for site_blocks in result.values():
            self.assertEqual(site_blocks, [])

    def test_all_sites_present_even_when_empty(self):
        result = build_hedge_section([])
        self.assertEqual(sorted(result.keys()), sorted(m["id"] for m in SITE_META))
```

(`ROT_EAN`, `UNKNOWN_EAN`, and `SITE_META` are already imported/defined at the top of this test file from Task 1 of the prior plan — no new imports needed beyond `build_hedge_section` itself.)

- [ ] **Step 2: Run tests, confirm they fail**

Run: `python3 -m unittest test_generate_consumption_data -v`
Expected: FAIL — `ImportError: cannot import name 'build_hedge_section'`.

- [ ] **Step 3: Add `HEDGE_PATH` constant**

In `generate_consumption_data.py`, find:

```python
HERE = os.path.dirname(os.path.abspath(__file__))
COMBINED_PATH = os.path.join(HERE, "epex_tariffs_usage_combined_15_min_interval.json")
DATA_OUT_PATH = os.path.join(HERE, "consumption_live_data.json")
CALC_JS_PATH = os.path.join(HERE, "consumption-calc.js")
HTML_OUT_PATH = os.path.join(HERE, "Customer Portal - Consumption (Live Data).html")
```

Replace with:

```python
HERE = os.path.dirname(os.path.abspath(__file__))
COMBINED_PATH = os.path.join(HERE, "epex_tariffs_usage_combined_15_min_interval.json")
HEDGE_PATH = os.path.join(HERE, "hedge_blocks_2026.json")
DATA_OUT_PATH = os.path.join(HERE, "consumption_live_data.json")
CALC_JS_PATH = os.path.join(HERE, "consumption-calc.js")
HTML_OUT_PATH = os.path.join(HERE, "Customer Portal - Consumption (Live Data).html")
```

- [ ] **Step 4: Add `build_hedge_section`**

Find the end of `build_compact_dataset`:

```python
    return {"sites": SITE_META, "byDate": by_date, "bySite": by_site}


PAGE_TEMPLATE = """<!doctype html>
```

Replace with:

```python
    return {"sites": SITE_META, "byDate": by_date, "bySite": by_site}


def build_hedge_section(hedge_rows):
    """Group hedge_blocks_2026.json rows into {site_id: [block, ...]}.

    Rows for EANs not in SITE_META are ignored (matches build_compact_dataset's
    handling of the non-electricity tilburg-gas connection). Each block keeps
    only the fields the page's per-interval hedge calculation needs — kept
    generic (not "one yearly block per shape") so future MONTH/QUARTER hedge
    rows from gen_hedge.py would be picked up with no code change here.
    """
    ean_to_meta = {m["ean"]: m for m in SITE_META}
    hedge = {m["id"]: [] for m in SITE_META}
    for r in hedge_rows:
        meta = ean_to_meta.get(r["EAN"])
        if meta is None:
            continue
        hedge[meta["id"]].append({
            "shape": r["shape"],
            "periodStart": r["periodStart"],
            "periodEnd": r["periodEnd"],
            "powerKw": r["powerKw"],
            "priceKwh": r["priceKwh"],
        })
    return hedge


PAGE_TEMPLATE = """<!doctype html>
```

- [ ] **Step 5: Wire it into `main()`**

Find:

```python
def main():
    with open(COMBINED_PATH, "r", encoding="utf-8") as f:
        rows = json.load(f)

    dataset = build_compact_dataset(rows)

    data_json_text = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"))
```

Replace with:

```python
def main():
    with open(COMBINED_PATH, "r", encoding="utf-8") as f:
        rows = json.load(f)

    dataset = build_compact_dataset(rows)

    with open(HEDGE_PATH, "r", encoding="utf-8") as f:
        hedge_rows = json.load(f)
    dataset["hedge"] = build_hedge_section(hedge_rows)

    data_json_text = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"))
```

- [ ] **Step 6: Run tests, confirm they pass**

Run: `python3 -m unittest test_generate_consumption_data -v`
Expected: `OK` — 9 tests pass (6 existing + 3 new).

- [ ] **Step 7: Regenerate the real artifacts and smoke-check**

Run: `python3 generate_consumption_data.py`

Then:

```bash
python3 -c "
import json
with open('consumption_live_data.json') as f:
    d = json.load(f)
print(sorted(d['hedge'].keys()))
print(d['hedge']['rot'])
"
```

Expected: site id list `['almere', 'breda', 'rot', 'tilburg', 'unnamed', 'venlo']`, and `rot`'s hedge list showing the base (0.07) and peak (0.095) blocks with `powerKw: 1000.0`.

- [ ] **Step 8: Commit**

```bash
git add generate_consumption_data.py test_generate_consumption_data.py "consumption_live_data.json" "Customer Portal - Consumption (Live Data).html"
git commit -m "Fold hedge_blocks_2026.json into the compact consumption dataset"
```

(The HTML changes here are just the new embedded `hedge` JSON — the page's own JS/markup doesn't consume it yet; that starts in Task 3.)

---

### Task 2: Pure hedge/cost calculations (`consumption-calc.js`)

**Files:**
- Modify: `consumption-calc.js`
- Modify: `consumption-calc.test.js`

**Interfaces:**
- Produces: `ConsumptionCalc.computeIntervalHedge(dateStr: string, timeStr: string, hedgeBlocks: array) -> {hedgeVolumeKwh, hedgePriceKwh, hedgeCostEur}`.
- Produces: `ConsumptionCalc.computeIntervalSeries(times: string[], prices: number[], consumption: number[], production: number[], dates: string|string[], hedgeBlocks: array|null) -> {netCost: number[], hedgeVolume: number[], hedgePrice: number[], hedgeCost: number[], uncovered: number[]}`. `dates` may be a single date string (applied to every index — Day view) or an array parallel to `times` (one date per index — Month view).
- Modifies: `ConsumptionCalc.computeDayStats(times, prices, consumption, production, dates?, hedgeBlocks?)` — same first-4-argument signature and return fields as before (`consumptionKwh, productionKwh, netKwh, peakKw, peakTime, spotResultEur`), plus two new fields `hedgeCostEur`, `uncoveredKwh` (both `0` when `dates`/`hedgeBlocks` are omitted, so existing 4-arg callers are unaffected).

- [ ] **Step 1: Write the failing tests**

Add to `consumption-calc.test.js` (append before the final `console.log("consumption-calc.test.js: all assertions passed");` line):

```js
// computeIntervalHedge: weekend interval -> base only, peak inactive despite being in the 8-20 hour window
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 },
    { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.095 }
  ];
  // 2026-01-03 is a Saturday
  var h = ConsumptionCalc.computeIntervalHedge("2026-01-03", "10:00", hedgeBlocks);
  assertClose(h.hedgeVolumeKwh, 250, "weekend hedgeVolumeKwh (base only)");
  assertClose(h.hedgePriceKwh, 0.07, "weekend hedgePriceKwh (base only)");
  assertClose(h.hedgeCostEur, 17.5, "weekend hedgeCostEur (base only)");
})();

// computeIntervalHedge: weekday during peak hours -> base+peak both active, blended price
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 },
    { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.095 }
  ];
  // 2026-01-05 is a Monday
  var h = ConsumptionCalc.computeIntervalHedge("2026-01-05", "10:00", hedgeBlocks);
  assertClose(h.hedgeVolumeKwh, 500, "weekday-peak hedgeVolumeKwh (base+peak)");
  assertClose(h.hedgeCostEur, 41.25, "weekday-peak hedgeCostEur (base+peak)");
  assertClose(h.hedgePriceKwh, 0.0825, "weekday-peak blended hedgePriceKwh");
})();

// computeIntervalHedge: same weekday, outside peak hours -> base only
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 },
    { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.095 }
  ];
  var h = ConsumptionCalc.computeIntervalHedge("2026-01-05", "21:00", hedgeBlocks);
  assertClose(h.hedgeVolumeKwh, 250, "weekday off-hours hedgeVolumeKwh (base only)");
})();

// computeIntervalHedge: date outside the block's period -> no hedge at all, div-by-zero guarded
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-06-01", periodEnd: "2026-06-30", powerKw: 1000, priceKwh: 0.07 }
  ];
  var h = ConsumptionCalc.computeIntervalHedge("2026-01-05", "10:00", hedgeBlocks);
  assertClose(h.hedgeVolumeKwh, 0, "out-of-period hedgeVolumeKwh");
  assertClose(h.hedgePriceKwh, 0, "out-of-period hedgePriceKwh guards div-by-zero");
  assertClose(h.hedgeCostEur, 0, "out-of-period hedgeCostEur");
})();

// computeIntervalSeries: single dateStr applied to every index (Day-view usage)
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 }
  ];
  var series = ConsumptionCalc.computeIntervalSeries(
    ["10:00", "10:15"], [0.10, 0.20], [600, 600], [0, 0], "2026-01-03", hedgeBlocks
  );
  assertClose(series.netCost[0], 15, "netCost[0] = (600kW*0.25h)*0.10");
  assertClose(series.hedgeVolume[0], 250, "hedgeVolume[0]");
  assertClose(series.uncovered[0], 150 - 250, "uncovered[0] = netKwh - hedgeVolume");
  assertClose(series.netCost[1], 30, "netCost[1] = (600kW*0.25h)*0.20");
})();

// computeIntervalSeries: per-index dates array (Month-view usage) -> different weekday per index
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 },
    { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.095 }
  ];
  // index 0: Saturday 2026-01-03 10:00 (base only); index 1: Monday 2026-01-05 10:00 (base+peak)
  var series = ConsumptionCalc.computeIntervalSeries(
    ["10:00", "10:00"], [0.10, 0.10], [600, 600], [0, 0],
    ["2026-01-03", "2026-01-05"], hedgeBlocks
  );
  assertClose(series.hedgeVolume[0], 250, "per-index dates: Saturday base-only");
  assertClose(series.hedgeVolume[1], 500, "per-index dates: Monday base+peak");
})();

// computeIntervalSeries: no hedgeBlocks given -> all hedge fields zero, uncovered = full netKwh
(function () {
  var series = ConsumptionCalc.computeIntervalSeries(["10:00"], [0.10], [600], [0], "2026-01-03", null);
  assertClose(series.hedgeVolume[0], 0, "no hedge -> hedgeVolume 0");
  assertClose(series.uncovered[0], 150, "no hedge -> uncovered = full netKwh");
})();

// computeDayStats: existing 4-arg call still works, new fields default to 0
(function () {
  var stats = ConsumptionCalc.computeDayStats(["00:00", "00:15"], [0.10, 0.20], [100, 200], [0, 50]);
  assertClose(stats.consumptionKwh, 75, "4-arg computeDayStats still computes consumptionKwh");
  assertClose(stats.hedgeCostEur, 0, "4-arg computeDayStats: hedgeCostEur 0 without hedge args");
  assertClose(stats.uncoveredKwh, 0, "4-arg computeDayStats: uncoveredKwh 0 without hedge args");
})();

// computeDayStats: 6-arg call aggregates hedge cost/uncovered across the day
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 }
  ];
  var stats = ConsumptionCalc.computeDayStats(
    ["10:00", "10:15"], [0.10, 0.10], [600, 600], [0, 0], "2026-01-03", hedgeBlocks
  );
  assertClose(stats.hedgeCostEur, 17.5 * 2, "computeDayStats hedgeCostEur sums both intervals");
  assertClose(stats.uncoveredKwh, (150 - 250) * 2, "computeDayStats uncoveredKwh sums both intervals");
})();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node consumption-calc.test.js`
Expected: FAIL — `TypeError: ConsumptionCalc.computeIntervalHedge is not a function`.

- [ ] **Step 3: Rewrite `consumption-calc.js`**

Replace the entire file content with:

```js
(function (root) {
  "use strict";

  function resolveDate(dates, i) {
    return typeof dates === "string" ? dates : dates[i];
  }

  function computeIntervalHedge(dateStr, timeStr, hedgeBlocks) {
    var hour = parseInt(timeStr.slice(0, 2), 10);
    var dateParts = dateStr.split("-").map(Number);
    var weekday = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay(); // 0=Sun..6=Sat
    var isWeekday = weekday >= 1 && weekday <= 5;
    var isPeakHour = hour >= 8 && hour < 20;

    var hedgeVolumeKwh = 0;
    var hedgeCostEur = 0;
    for (var i = 0; i < hedgeBlocks.length; i++) {
      var b = hedgeBlocks[i];
      if (dateStr < b.periodStart || dateStr > b.periodEnd) { continue; }
      if (b.shape === "peak" && !(isWeekday && isPeakHour)) { continue; }
      var volume = b.powerKw * 0.25;
      hedgeVolumeKwh += volume;
      hedgeCostEur += volume * b.priceKwh;
    }
    var hedgePriceKwh = hedgeVolumeKwh > 0 ? hedgeCostEur / hedgeVolumeKwh : 0;
    return { hedgeVolumeKwh: hedgeVolumeKwh, hedgePriceKwh: hedgePriceKwh, hedgeCostEur: hedgeCostEur };
  }

  function computeIntervalSeries(times, prices, consumption, production, dates, hedgeBlocks) {
    var n = times.length;
    var netCost = [];
    var hedgeVolume = [];
    var hedgePrice = [];
    var hedgeCost = [];
    var uncovered = [];

    for (var i = 0; i < n; i++) {
      var netKwh = (consumption[i] - production[i]) * 0.25;
      var h = hedgeBlocks ? computeIntervalHedge(resolveDate(dates, i), times[i], hedgeBlocks)
                          : { hedgeVolumeKwh: 0, hedgePriceKwh: 0, hedgeCostEur: 0 };
      netCost.push(netKwh * prices[i]);
      hedgeVolume.push(h.hedgeVolumeKwh);
      hedgePrice.push(h.hedgePriceKwh);
      hedgeCost.push(h.hedgeCostEur);
      uncovered.push(netKwh - h.hedgeVolumeKwh);
    }

    return { netCost: netCost, hedgeVolume: hedgeVolume, hedgePrice: hedgePrice, hedgeCost: hedgeCost, uncovered: uncovered };
  }

  function computeDayStats(times, prices, consumption, production, dates, hedgeBlocks) {
    var n = times.length;
    var consumptionKwh = 0;
    var productionKwh = 0;
    var spotResultEur = 0;
    var peakKw = -Infinity;
    var peakTime = null;
    var hedgeCostEur = 0;
    var uncoveredKwh = 0;
    var hasHedge = !!(dates && hedgeBlocks);

    for (var i = 0; i < n; i++) {
      var c = consumption[i];
      var g = production[i];
      var netKwh = (c - g) * 0.25;
      consumptionKwh += c * 0.25;
      productionKwh += g * 0.25;
      spotResultEur += netKwh * prices[i];
      if (c > peakKw) {
        peakKw = c;
        peakTime = times[i];
      }
      if (hasHedge) {
        var h = computeIntervalHedge(resolveDate(dates, i), times[i], hedgeBlocks);
        hedgeCostEur += h.hedgeCostEur;
        uncoveredKwh += netKwh - h.hedgeVolumeKwh;
      }
    }

    return {
      consumptionKwh: consumptionKwh,
      productionKwh: productionKwh,
      netKwh: consumptionKwh - productionKwh,
      peakKw: peakKw,
      peakTime: peakTime,
      spotResultEur: spotResultEur,
      hedgeCostEur: hedgeCostEur,
      uncoveredKwh: uncoveredKwh
    };
  }

  function formatNL(value, decimals) {
    var sign = value < 0 ? "-" : "";
    var abs = Math.abs(value);
    var fixed = abs.toFixed(decimals);
    var pieces = fixed.split(".");
    var intPart = pieces[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    var decPart = pieces.length > 1 ? pieces[1] : "";
    return sign + intPart + (decPart ? "," + decPart : "");
  }

  var api = {
    computeDayStats: computeDayStats,
    computeIntervalHedge: computeIntervalHedge,
    computeIntervalSeries: computeIntervalSeries,
    formatNL: formatNL
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ConsumptionCalc = api;
  }
})(typeof window !== "undefined" ? window : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node consumption-calc.test.js`
Expected: prints `consumption-calc.test.js: all assertions passed` with no errors.

- [ ] **Step 5: Commit**

```bash
git add consumption-calc.js consumption-calc.test.js
git commit -m "Add pure hedge/cost calculations to consumption-calc.js"
```

(This task only changes the pure calc module — `generate_consumption_data.py`'s embedded copy of it is refreshed automatically the next time Task 3 regenerates the page.)

---

### Task 3: Day-view hedge columns, stat cards, and hover-linked highlighting

**Files:**
- Modify: `generate_consumption_data.py` (CSS + table markup + the page's inline `<script>` in `PAGE_TEMPLATE`)

**Interfaces:**
- Consumes: `ConsumptionCalc.computeDayStats`/`computeIntervalSeries` (Task 2).
- Produces (new page-internal JS, for Task 4 to reuse): `attachHoverHandler(svgEl, crosshairId, getGeom, onHoverIndex, onLeave)`, `renderStatCards(stats)`, `renderTable(times, consumption, production, prices, series)`, `highlightTableRow(i)`, `clearHighlightedRow()`, and `lastChartGeom` (module-level, set by `buildChartSvg`).
- No new data shape — this task only changes the page's own markup/JS, not `consumption_live_data.json`'s structure.

This task has no isolated unit test (it's page-rendering glue over already-tested `consumption-calc.js` functions) — its correctness is checked via the regenerated-artifact smoke check in Step 3 and the task review's structural checks (grep-based, no browser needed), consistent with how the original page's assembly task was verified.

- [ ] **Step 1: Add the `--pp-teal-100` token and `.hovered`/`.chart-tabs` CSS**

In `generate_consumption_data.py`'s `PAGE_TEMPLATE`, find:

```
    --pp-teal-700:#0f766e; --pp-teal-600:#0d9488; --pp-teal-500:#14b8a6;
    --pp-green:#15803d; --pp-red:#dc2626; --pp-cyan:#0891b2;
```

Replace with:

```
    --pp-teal-700:#0f766e; --pp-teal-600:#0d9488; --pp-teal-500:#14b8a6; --pp-teal-100:#ccfbf1;
    --pp-green:#15803d; --pp-red:#dc2626; --pp-cyan:#0891b2;
```

Then find:

```
  td.net-export { color:var(--pp-cyan); font-weight:600; }
</style>
```

Replace with:

```
  td.net-export { color:var(--pp-cyan); font-weight:600; }
  tbody tr.hovered { background:var(--pp-teal-100) !important; }
  .chart-tabs { display:flex; gap:4px; background:var(--pp-surface-alt); border-radius:8px; padding:3px; }
  .chart-tab { border:none; background:transparent; padding:6px 14px; border-radius:6px; font-size:12.5px; font-weight:600; color:var(--pp-text-body); cursor:pointer; font-family:var(--font-sans); }
  .chart-tab.active { background:#fff; color:var(--pp-teal-700); box-shadow:0 1px 2px rgba(0,0,0,0.08); }
  .chart-scroll { overflow-x:auto; }
</style>
```

(The `.chart-tabs`/`.chart-tab`/`.chart-scroll` rules aren't used until Task 4 — adding them now avoids touching this CSS block again next task.)

- [ ] **Step 2: Add `data-idx` and 5 new columns to the table**

Find:

```
              <tr><th>Time</th><th class="num">Consumption (kW)</th><th class="num">Production (kW)</th><th class="num">Net (kW)</th><th class="num">EPEX (€/kWh)</th></tr>
```

Replace with:

```
              <tr><th>Time</th><th class="num">Consumption (kW)</th><th class="num">Production (kW)</th><th class="num">Net (kW)</th><th class="num">EPEX (€/kWh)</th><th class="num">Net Cost (€)</th><th class="num">Hedge Volume (kWh)</th><th class="num">Hedge Price (€/kWh)</th><th class="num">Hedge Cost (€)</th><th class="num">Uncovered (kWh)</th></tr>
```

- [ ] **Step 3: Replace the page's inline `<script>` (render logic)**

Find the entire block from `<script>\n(function () {` through `})();\n</script>` (this is the second `<script>` tag, after the two `__CALC_JS__`/`__DATA_JSON__` script tags):

```
<script>
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("consumption-data").textContent);
  var siteSelect = document.getElementById("site-select");
  var dateInput = document.getElementById("date-input");
  var crumb = document.getElementById("crumb");
  var chartSubtitle = document.getElementById("chart-subtitle");
  var statRow = document.getElementById("stat-row");
  var chart = document.getElementById("chart");
  var tableBody = document.getElementById("table-body");

  DATA.sites.forEach(function (site) {
    var opt = document.createElement("option");
    opt.value = site.id;
    opt.textContent = site.name;
    siteSelect.appendChild(opt);
  });

  var allDates = Object.keys(DATA.byDate).sort();
  var MIN_DATE = allDates[0];
  var MAX_DATE = allDates[allDates.length - 1];
  dateInput.min = MIN_DATE;
  dateInput.max = MAX_DATE;

  var DEFAULT_SITE = "rot";
  var DEFAULT_DATE = MAX_DATE;
  siteSelect.value = DEFAULT_SITE;
  dateInput.value = DEFAULT_DATE;

  function formatDateLong(dateStr) {
    var parts = dateStr.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return days[d.getDay()] + " " + parts[2] + " " + months[parts[1] - 1] + " " + parts[0];
  }

  function statCardHtml(label, value, tone, sublabel) {
    var toneClass = tone ? " " + tone : "";
    return '<div class="stat-card"><div class="label">' + label + '</div>' +
      '<div class="value' + toneClass + '">' + value + '</div>' +
      '<div class="sublabel">' + sublabel + '</div></div>';
  }

  function buildChartSvg(times, consumption, production) {
    var n = times.length;
    var width = 960, height = 260, padLeft = 40, padBottom = 24, padTop = 10;
    var plotW = width - padLeft - 10;
    var plotH = height - padTop - padBottom;
    var maxVal = 0;
    for (var i = 0; i < n; i++) {
      maxVal = Math.max(maxVal, consumption[i], production[i]);
    }
    if (maxVal <= 0) { maxVal = 1; }
    var barW = plotW / n;
    var bars = "";
    for (i = 0; i < n; i++) {
      var barH = (consumption[i] / maxVal) * plotH;
      var x = padLeft + i * barW;
      var y = padTop + (plotH - barH);
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(barW - 1, 1).toFixed(1) +
        '" height="' + barH.toFixed(1) + '" fill="#0f766e"></rect>';
    }
    var linePoints = "";
    for (i = 0; i < n; i++) {
      var px = padLeft + i * barW + barW / 2;
      var py = padTop + (plotH - (production[i] / maxVal) * plotH);
      linePoints += px.toFixed(1) + "," + py.toFixed(1) + " ";
    }
    var axisLabels = "";
    for (i = 0; i < n; i++) {
      if (times[i].slice(3) === "00" && parseInt(times[i].slice(0, 2), 10) % 4 === 0) {
        var lx = padLeft + i * barW;
        axisLabels += '<text x="' + lx.toFixed(1) + '" y="' + (height - 6) +
          '" font-size="10" fill="#64748b">' + times[i] + '</text>';
      }
    }
    return '<line x1="' + padLeft + '" y1="' + (padTop + plotH) + '" x2="' + (padLeft + plotW) +
      '" y2="' + (padTop + plotH) + '" stroke="#dbe3ec"></line>' +
      bars +
      '<polyline points="' + linePoints.trim() + '" fill="none" stroke="#15803d" stroke-width="2"></polyline>' +
      axisLabels;
  }

  function render() {
    var siteId = siteSelect.value;
    var date = dateInput.value;
    var site = DATA.sites.filter(function (s) { return s.id === siteId; })[0];
    var dateSeries = DATA.byDate[date];
    var siteSeries = DATA.bySite[siteId] && DATA.bySite[siteId][date];

    if (!dateSeries || !siteSeries) {
      crumb.textContent = "";
      chartSubtitle.textContent = "";
      statRow.innerHTML = '<div class="stat-card"><div class="label">No data</div>' +
        '<div class="value">—</div><div class="sublabel">No data for this date.</div></div>';
      chart.innerHTML = "";
      tableBody.innerHTML = "";
      return;
    }

    crumb.textContent = site.name + " · " + formatDateLong(date);
    chartSubtitle.textContent = dateSeries.t.length + " intervals · Europe/Amsterdam";

    var stats = ConsumptionCalc.computeDayStats(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g);
    var spotTone = stats.spotResultEur > 0 ? "critical" : (stats.spotResultEur < 0 ? "success" : "");
    var netTone = stats.netKwh < 0 ? "export" : "";

    statRow.innerHTML =
      statCardHtml("Consumption", ConsumptionCalc.formatNL(stats.consumptionKwh, 1) + " kWh", "", dateSeries.t.length + " intervals") +
      statCardHtml("Production", ConsumptionCalc.formatNL(stats.productionKwh, 1) + " kWh", "", "on-site generation") +
      statCardHtml("Net / import", ConsumptionCalc.formatNL(stats.netKwh, 1) + " kWh", netTone, stats.netKwh < 0 ? "net exporter" : "net importer") +
      statCardHtml("Peak demand", ConsumptionCalc.formatNL(stats.peakKw, 1) + " kW", "", "at " + stats.peakTime) +
      statCardHtml("Spot result", (stats.spotResultEur >= 0 ? "+ " : "− ") + "€ " + ConsumptionCalc.formatNL(Math.abs(stats.spotResultEur), 2), spotTone, "indicative, day-ahead price");

    chart.innerHTML = buildChartSvg(dateSeries.t, siteSeries.c, siteSeries.g);

    var rows = "";
    for (var i = 0; i < dateSeries.t.length; i++) {
      var net = siteSeries.c[i] - siteSeries.g[i];
      var netClass = net < 0 ? ' class="num net-export"' : ' class="num"';
      rows += "<tr><td>" + dateSeries.t[i] + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(siteSeries.c[i], 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(siteSeries.g[i], 1) + "</td>" +
        "<td" + netClass + ">" + ConsumptionCalc.formatNL(net, 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(dateSeries.p[i], 4) + "</td></tr>";
    }
    tableBody.innerHTML = rows;
  }

  siteSelect.addEventListener("change", render);
  dateInput.addEventListener("change", render);
  render();
})();
</script>
```

Replace with:

```
<script>
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("consumption-data").textContent);
  var siteSelect = document.getElementById("site-select");
  var dateInput = document.getElementById("date-input");
  var crumb = document.getElementById("crumb");
  var chartSubtitle = document.getElementById("chart-subtitle");
  var statRow = document.getElementById("stat-row");
  var chart = document.getElementById("chart");
  var tableBody = document.getElementById("table-body");

  DATA.sites.forEach(function (site) {
    var opt = document.createElement("option");
    opt.value = site.id;
    opt.textContent = site.name;
    siteSelect.appendChild(opt);
  });

  var allDates = Object.keys(DATA.byDate).sort();
  var MIN_DATE = allDates[0];
  var MAX_DATE = allDates[allDates.length - 1];
  dateInput.min = MIN_DATE;
  dateInput.max = MAX_DATE;

  var DEFAULT_SITE = "rot";
  var DEFAULT_DATE = MAX_DATE;
  siteSelect.value = DEFAULT_SITE;
  dateInput.value = DEFAULT_DATE;

  function formatDateLong(dateStr) {
    var parts = dateStr.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return days[d.getDay()] + " " + parts[2] + " " + months[parts[1] - 1] + " " + parts[0];
  }

  function statCardHtml(label, value, tone, sublabel) {
    var toneClass = tone ? " " + tone : "";
    return '<div class="stat-card"><div class="label">' + label + '</div>' +
      '<div class="value' + toneClass + '">' + value + '</div>' +
      '<div class="sublabel">' + sublabel + '</div></div>';
  }

  function renderStatCards(stats) {
    var spotTone = stats.spotResultEur > 0 ? "critical" : (stats.spotResultEur < 0 ? "success" : "");
    var netTone = stats.netKwh < 0 ? "export" : "";
    var uncoveredTone = stats.uncoveredKwh < 0 ? "export" : "";
    statRow.innerHTML =
      statCardHtml("Consumption", ConsumptionCalc.formatNL(stats.consumptionKwh, 1) + " kWh", "", "total") +
      statCardHtml("Production", ConsumptionCalc.formatNL(stats.productionKwh, 1) + " kWh", "", "on-site generation") +
      statCardHtml("Net / import", ConsumptionCalc.formatNL(stats.netKwh, 1) + " kWh", netTone, stats.netKwh < 0 ? "net exporter" : "net importer") +
      statCardHtml("Peak demand", ConsumptionCalc.formatNL(stats.peakKw, 1) + " kW", "", "at " + stats.peakTime) +
      statCardHtml("Net cost", (stats.spotResultEur >= 0 ? "+ " : "− ") + "€ " + ConsumptionCalc.formatNL(Math.abs(stats.spotResultEur), 2), spotTone, "indicative, day-ahead price") +
      statCardHtml("Hedge cost", "€ " + ConsumptionCalc.formatNL(stats.hedgeCostEur, 2), "", "locked in via hedge") +
      statCardHtml("Uncovered", ConsumptionCalc.formatNL(stats.uncoveredKwh, 1) + " kWh", uncoveredTone, stats.uncoveredKwh < 0 ? "over-hedged" : "exposed to spot price");
  }

  function tdClass(value) {
    return value < 0 ? ' class="num net-export"' : ' class="num"';
  }

  function renderTable(times, consumption, production, prices, series) {
    var rows = "";
    for (var i = 0; i < times.length; i++) {
      var net = consumption[i] - production[i];
      rows += '<tr data-idx="' + i + '"><td>' + times[i] + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(consumption[i], 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(production[i], 1) + "</td>" +
        "<td" + tdClass(net) + ">" + ConsumptionCalc.formatNL(net, 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(prices[i], 4) + "</td>" +
        "<td" + tdClass(series.netCost[i]) + ">" + ConsumptionCalc.formatNL(series.netCost[i], 2) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(series.hedgeVolume[i], 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(series.hedgePrice[i], 4) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(series.hedgeCost[i], 2) + "</td>" +
        "<td" + tdClass(series.uncovered[i]) + ">" + ConsumptionCalc.formatNL(series.uncovered[i], 1) + "</td>" +
        "</tr>";
    }
    tableBody.innerHTML = rows;
  }

  var lastChartGeom = null;

  function buildChartSvg(times, consumption, production) {
    var n = times.length;
    var width = 960, height = 260, padLeft = 40, padBottom = 24, padTop = 10;
    var plotW = width - padLeft - 10;
    var plotH = height - padTop - padBottom;
    var maxVal = 0;
    for (var i = 0; i < n; i++) {
      maxVal = Math.max(maxVal, consumption[i], production[i]);
    }
    if (maxVal <= 0) { maxVal = 1; }
    var barW = plotW / n;
    var bars = "";
    for (i = 0; i < n; i++) {
      var barH = (consumption[i] / maxVal) * plotH;
      var x = padLeft + i * barW;
      var y = padTop + (plotH - barH);
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(barW - 1, 1).toFixed(1) +
        '" height="' + barH.toFixed(1) + '" fill="#0f766e"></rect>';
    }
    var linePoints = "";
    for (i = 0; i < n; i++) {
      var px = padLeft + i * barW + barW / 2;
      var py = padTop + (plotH - (production[i] / maxVal) * plotH);
      linePoints += px.toFixed(1) + "," + py.toFixed(1) + " ";
    }
    var axisLabels = "";
    for (i = 0; i < n; i++) {
      if (times[i].slice(3) === "00" && parseInt(times[i].slice(0, 2), 10) % 4 === 0) {
        var lx = padLeft + i * barW;
        axisLabels += '<text x="' + lx.toFixed(1) + '" y="' + (height - 6) +
          '" font-size="10" fill="#64748b">' + times[i] + '</text>';
      }
    }
    lastChartGeom = { padLeft: padLeft, spacing: barW, offset: barW / 2, n: n };
    return '<line x1="' + padLeft + '" y1="' + (padTop + plotH) + '" x2="' + (padLeft + plotW) +
      '" y2="' + (padTop + plotH) + '" stroke="#dbe3ec"></line>' +
      bars +
      '<polyline points="' + linePoints.trim() + '" fill="none" stroke="#15803d" stroke-width="2"></polyline>' +
      axisLabels +
      '<line id="chart-crosshair" x1="0" y1="' + padTop + '" x2="0" y2="' + (padTop + plotH) +
      '" stroke="#0f172a" stroke-width="1" stroke-dasharray="3,3" visibility="hidden"></line>';
  }

  function attachHoverHandler(svgEl, crosshairId, getGeom, onHoverIndex, onLeave) {
    svgEl.addEventListener("mousemove", function (evt) {
      var geom = getGeom();
      if (!geom) { return; }
      var rect = svgEl.getBoundingClientRect();
      var viewBox = svgEl.viewBox.baseVal;
      var scaleX = viewBox.width / rect.width;
      var mouseX = (evt.clientX - rect.left) * scaleX;
      var i = Math.round((mouseX - geom.padLeft - geom.offset) / geom.spacing);
      if (i < 0) { i = 0; }
      if (i > geom.n - 1) { i = geom.n - 1; }
      var crosshair = svgEl.querySelector("#" + crosshairId);
      if (crosshair) {
        var cx = geom.padLeft + i * geom.spacing + geom.offset;
        crosshair.setAttribute("x1", cx.toFixed(1));
        crosshair.setAttribute("x2", cx.toFixed(1));
        crosshair.setAttribute("visibility", "visible");
      }
      onHoverIndex(i);
    });
    svgEl.addEventListener("mouseleave", function () {
      var crosshair = svgEl.querySelector("#" + crosshairId);
      if (crosshair) { crosshair.setAttribute("visibility", "hidden"); }
      onLeave();
    });
  }

  var previousHoveredRow = null;
  function highlightTableRow(i) {
    if (previousHoveredRow) { previousHoveredRow.classList.remove("hovered"); }
    var row = tableBody.querySelector('tr[data-idx="' + i + '"]');
    if (row) {
      row.classList.add("hovered");
      row.scrollIntoView({ block: "nearest" });
    }
    previousHoveredRow = row;
  }
  function clearHighlightedRow() {
    if (previousHoveredRow) { previousHoveredRow.classList.remove("hovered"); }
    previousHoveredRow = null;
  }

  attachHoverHandler(chart, "chart-crosshair", function () { return lastChartGeom; }, highlightTableRow, clearHighlightedRow);

  function render() {
    var siteId = siteSelect.value;
    var date = dateInput.value;
    var site = DATA.sites.filter(function (s) { return s.id === siteId; })[0];
    var dateSeries = DATA.byDate[date];
    var siteSeries = DATA.bySite[siteId] && DATA.bySite[siteId][date];
    var hedgeBlocks = DATA.hedge && DATA.hedge[siteId];

    if (!dateSeries || !siteSeries) {
      crumb.textContent = "";
      chartSubtitle.textContent = "";
      statRow.innerHTML = '<div class="stat-card"><div class="label">No data</div>' +
        '<div class="value">—</div><div class="sublabel">No data for this date.</div></div>';
      chart.innerHTML = "";
      tableBody.innerHTML = "";
      return;
    }

    crumb.textContent = site.name + " · " + formatDateLong(date);
    chartSubtitle.textContent = dateSeries.t.length + " intervals · Europe/Amsterdam";

    var stats = ConsumptionCalc.computeDayStats(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    var series = ConsumptionCalc.computeIntervalSeries(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    renderStatCards(stats);

    chart.innerHTML = buildChartSvg(dateSeries.t, siteSeries.c, siteSeries.g);
    renderTable(dateSeries.t, siteSeries.c, siteSeries.g, dateSeries.p, series);
  }

  siteSelect.addEventListener("change", render);
  dateInput.addEventListener("change", render);
  render();
})();
</script>
```

- [ ] **Step 4: Regenerate and smoke-check**

Run: `python3 generate_consumption_data.py`

Then structurally verify (no browser available):

```bash
grep -c 'data-idx=' "Customer Portal - Consumption (Live Data).html"
grep -o 'Hedge Cost\|Uncovered\|Net cost\|chart-crosshair' "Customer Portal - Consumption (Live Data).html" | sort -u
```

Expected: `data-idx=` count of 96 (the default view is Rotterdam DC on 2026-08-05, a regular 96-interval day), and all four strings present at least once.

- [ ] **Step 5: Run the existing test suites (regression check)**

Run: `python3 -m unittest test_generate_consumption_data -v` — expect `OK`, 9/9.
Run: `node consumption-calc.test.js` — expect all assertions passed.
Run: `python3 verify_consumption_page.py` — expect all checks passed (this task didn't change the data shape `verify_consumption_page.py` checks, so it should be unaffected).

- [ ] **Step 6: Commit**

```bash
git add generate_consumption_data.py "consumption_live_data.json" "Customer Portal - Consumption (Live Data).html"
git commit -m "Add hedge columns, renamed stat cards, and hover-linked table highlighting to Day view"
```

---

### Task 4: Month view (new chart type, table follows chart mode)

**Files:**
- Modify: `generate_consumption_data.py` (markup + inline `<script>` in `PAGE_TEMPLATE`)

**Interfaces:**
- Consumes: `attachHoverHandler`, `renderStatCards`, `renderTable`, `ConsumptionCalc.computeDayStats`/`computeIntervalSeries` (all from Task 3/2 — signatures unchanged).
- Produces: `buildMonthOptions()`, `buildMonthChartSvg(dates, times, consumption, production)`, `concatMonthData(monthKey)`, `switchMode(mode)` — all page-internal, no external interface beyond the rendered page.

- [ ] **Step 1: Add the Day/Month toggle, month selector, and second chart element**

Find:

```
      <div class="card">
        <div class="card-title">Consumption &amp; production — 15-minute intervals</div>
        <div class="card-subtitle" id="chart-subtitle"></div>
        <svg id="chart" viewBox="0 0 960 260" style="width:100%;height:260px;display:block"></svg>
        <div class="legend">
          <div><span class="swatch" style="background:var(--pp-teal-700)"></span>Consumption</div>
          <div><span class="swatch" style="background:var(--pp-green);height:2px"></span>Production (on-site generation)</div>
        </div>
      </div>
```

Replace with:

```
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <div class="card-title">Consumption &amp; production — 15-minute intervals</div>
            <div class="card-subtitle" id="chart-subtitle"></div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <div class="chart-tabs">
              <button type="button" class="chart-tab active" data-mode="day">Day</button>
              <button type="button" class="chart-tab" data-mode="month">Month</button>
            </div>
            <select id="month-select" style="display:none"></select>
          </div>
        </div>
        <div id="day-chart-wrap">
          <svg id="chart" viewBox="0 0 960 260" style="width:100%;height:260px;display:block"></svg>
        </div>
        <div id="month-chart-wrap" class="chart-scroll" style="display:none">
          <svg id="month-chart" viewBox="0 0 960 260" height="260" style="display:block"></svg>
        </div>
        <div class="legend">
          <div><span class="swatch" style="background:var(--pp-teal-700)"></span>Consumption</div>
          <div><span class="swatch" style="background:var(--pp-green);height:2px"></span>Production (on-site generation)</div>
        </div>
      </div>
```

- [ ] **Step 2: Add month-grouping, month chart, mode switching, and month-aware `render()`**

Find:

```
  attachHoverHandler(chart, "chart-crosshair", function () { return lastChartGeom; }, highlightTableRow, clearHighlightedRow);

  function render() {
    var siteId = siteSelect.value;
    var date = dateInput.value;
    var site = DATA.sites.filter(function (s) { return s.id === siteId; })[0];
    var dateSeries = DATA.byDate[date];
    var siteSeries = DATA.bySite[siteId] && DATA.bySite[siteId][date];
    var hedgeBlocks = DATA.hedge && DATA.hedge[siteId];

    if (!dateSeries || !siteSeries) {
      crumb.textContent = "";
      chartSubtitle.textContent = "";
      statRow.innerHTML = '<div class="stat-card"><div class="label">No data</div>' +
        '<div class="value">—</div><div class="sublabel">No data for this date.</div></div>';
      chart.innerHTML = "";
      tableBody.innerHTML = "";
      return;
    }

    crumb.textContent = site.name + " · " + formatDateLong(date);
    chartSubtitle.textContent = dateSeries.t.length + " intervals · Europe/Amsterdam";

    var stats = ConsumptionCalc.computeDayStats(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    var series = ConsumptionCalc.computeIntervalSeries(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    renderStatCards(stats);

    chart.innerHTML = buildChartSvg(dateSeries.t, siteSeries.c, siteSeries.g);
    renderTable(dateSeries.t, siteSeries.c, siteSeries.g, dateSeries.p, series);
  }

  siteSelect.addEventListener("change", render);
  dateInput.addEventListener("change", render);
  render();
})();
```

Replace with:

```
  attachHoverHandler(chart, "chart-crosshair", function () { return lastChartGeom; }, highlightTableRow, clearHighlightedRow);

  function monthLabel(year, month, daysPresent, lastDateStr) {
    var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var daysInMonth = new Date(year, month, 0).getDate();
    var label = monthNames[month - 1] + " " + year;
    if (daysPresent < daysInMonth) {
      var lastDay = parseInt(lastDateStr.slice(8, 10), 10);
      label += " (partial — through " + lastDay + " " + monthNames[month - 1].slice(0, 3) + ")";
    }
    return label;
  }

  function buildMonthOptions() {
    var byMonth = {};
    allDates.forEach(function (d) {
      var key = d.slice(0, 7);
      if (!byMonth[key]) { byMonth[key] = []; }
      byMonth[key].push(d);
    });
    var keys = Object.keys(byMonth).sort();
    return keys.map(function (key) {
      var dates = byMonth[key];
      var year = parseInt(key.slice(0, 4), 10);
      var month = parseInt(key.slice(5, 7), 10);
      var lastDate = dates[dates.length - 1];
      return { value: key, label: monthLabel(year, month, dates.length, lastDate), dates: dates };
    });
  }

  var MONTH_OPTIONS = buildMonthOptions();
  var monthSelect = document.getElementById("month-select");
  MONTH_OPTIONS.forEach(function (o) {
    var opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    monthSelect.appendChild(opt);
  });
  monthSelect.value = MONTH_OPTIONS[MONTH_OPTIONS.length - 1].value;

  function concatMonthData(monthKey) {
    var opt = MONTH_OPTIONS.filter(function (o) { return o.value === monthKey; })[0];
    var dates = opt ? opt.dates : [];
    var allTimes = [], allDatesPerIndex = [], allPrices = [], allC = [], allG = [];
    var siteId = siteSelect.value;
    dates.forEach(function (d) {
      var ds = DATA.byDate[d];
      var ss = DATA.bySite[siteId] && DATA.bySite[siteId][d];
      if (!ds || !ss) { return; }
      for (var i = 0; i < ds.t.length; i++) {
        allTimes.push(ds.t[i]);
        allDatesPerIndex.push(d);
        allPrices.push(ds.p[i]);
        allC.push(ss.c[i]);
        allG.push(ss.g[i]);
      }
    });
    return { dates: allDatesPerIndex, times: allTimes, prices: allPrices, consumption: allC, production: allG };
  }

  var lastMonthChartGeom = null;
  var monthChart = document.getElementById("month-chart");

  function buildMonthChartSvg(dates, times, consumption, production) {
    var n = times.length;
    var pxPerInterval = 4;
    var width = Math.max(960, n * pxPerInterval);
    var height = 260, padLeft = 40, padBottom = 24, padTop = 10;
    var plotW = width - padLeft - 10;
    var plotH = height - padTop - padBottom;
    var maxVal = 0;
    var i;
    for (i = 0; i < n; i++) {
      maxVal = Math.max(maxVal, consumption[i], production[i]);
    }
    if (maxVal <= 0) { maxVal = 1; }
    var stepX = n > 1 ? plotW / (n - 1) : 0;

    var areaPoints = "";
    var linePoints = "";
    for (i = 0; i < n; i++) {
      var px = padLeft + i * stepX;
      var cy = padTop + (plotH - (consumption[i] / maxVal) * plotH);
      var gy = padTop + (plotH - (production[i] / maxVal) * plotH);
      areaPoints += px.toFixed(1) + "," + cy.toFixed(1) + " ";
      linePoints += px.toFixed(1) + "," + gy.toFixed(1) + " ";
    }
    var areaPath = "M" + padLeft.toFixed(1) + "," + (padTop + plotH).toFixed(1) + " L" +
      areaPoints.trim().replace(/ /g, " L") + " L" + (padLeft + plotW).toFixed(1) + "," + (padTop + plotH).toFixed(1) + " Z";

    var dayGridlines = "";
    var dayLabels = "";
    var prevDate = null;
    for (i = 0; i < n; i++) {
      if (dates[i] !== prevDate) {
        var lx = (padLeft + i * stepX).toFixed(1);
        dayGridlines += '<line x1="' + lx + '" y1="' + padTop + '" x2="' + lx + '" y2="' + (padTop + plotH) + '" stroke="#eef2f6"></line>';
        dayLabels += '<text x="' + lx + '" y="' + (height - 6) + '" font-size="9" fill="#64748b">' + dates[i].slice(8, 10) + "</text>";
        prevDate = dates[i];
      }
    }

    lastMonthChartGeom = { padLeft: padLeft, spacing: stepX, offset: 0, n: n, width: width };

    return dayGridlines +
      '<line x1="' + padLeft + '" y1="' + (padTop + plotH) + '" x2="' + (padLeft + plotW) + '" y2="' + (padTop + plotH) + '" stroke="#dbe3ec"></line>' +
      '<path d="' + areaPath + '" fill="#0f766e" fill-opacity="0.25" stroke="none"></path>' +
      '<polyline points="' + areaPoints.trim() + '" fill="none" stroke="#0f766e" stroke-width="1.5"></polyline>' +
      '<polyline points="' + linePoints.trim() + '" fill="none" stroke="#15803d" stroke-width="1.5"></polyline>' +
      dayLabels +
      '<line id="month-chart-crosshair" x1="0" y1="' + padTop + '" x2="0" y2="' + (padTop + plotH) +
      '" stroke="#0f172a" stroke-width="1" stroke-dasharray="3,3" visibility="hidden"></line>';
  }

  attachHoverHandler(monthChart, "month-chart-crosshair", function () { return lastMonthChartGeom; }, highlightTableRow, clearHighlightedRow);

  var chartMode = "day";

  function switchMode(mode) {
    chartMode = mode;
    dateInput.style.display = mode === "day" ? "" : "none";
    monthSelect.style.display = mode === "month" ? "" : "none";
    document.getElementById("day-chart-wrap").style.display = mode === "day" ? "" : "none";
    document.getElementById("month-chart-wrap").style.display = mode === "month" ? "" : "none";
    var tabs = document.querySelectorAll(".chart-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-mode") === mode);
    }
    render();
  }

  var tabButtons = document.querySelectorAll(".chart-tab");
  for (var t = 0; t < tabButtons.length; t++) {
    tabButtons[t].addEventListener("click", function (evt) {
      switchMode(evt.target.getAttribute("data-mode"));
    });
  }

  function render() {
    var siteId = siteSelect.value;
    var site = DATA.sites.filter(function (s) { return s.id === siteId; })[0];
    var hedgeBlocks = DATA.hedge && DATA.hedge[siteId];

    if (chartMode === "month") {
      var monthKey = monthSelect.value;
      var month = concatMonthData(monthKey);
      if (month.times.length === 0) {
        crumb.textContent = "";
        chartSubtitle.textContent = "";
        statRow.innerHTML = '<div class="stat-card"><div class="label">No data</div>' +
          '<div class="value">—</div><div class="sublabel">No data for this month.</div></div>';
        monthChart.innerHTML = "";
        tableBody.innerHTML = "";
        return;
      }
      var monthOpt = MONTH_OPTIONS.filter(function (o) { return o.value === monthKey; })[0];
      crumb.textContent = site.name + " · " + monthOpt.label;
      chartSubtitle.textContent = month.times.length + " intervals · Europe/Amsterdam";

      var monthStats = ConsumptionCalc.computeDayStats(month.times, month.prices, month.consumption, month.production, month.dates, hedgeBlocks);
      var monthSeries = ConsumptionCalc.computeIntervalSeries(month.times, month.prices, month.consumption, month.production, month.dates, hedgeBlocks);
      renderStatCards(monthStats);

      var markup = buildMonthChartSvg(month.dates, month.times, month.consumption, month.production);
      monthChart.setAttribute("viewBox", "0 0 " + lastMonthChartGeom.width + " 260");
      monthChart.style.width = lastMonthChartGeom.width + "px";
      monthChart.innerHTML = markup;

      renderTable(month.times, month.consumption, month.production, month.prices, monthSeries);
      return;
    }

    var date = dateInput.value;
    var dateSeries = DATA.byDate[date];
    var siteSeries = DATA.bySite[siteId] && DATA.bySite[siteId][date];

    if (!dateSeries || !siteSeries) {
      crumb.textContent = "";
      chartSubtitle.textContent = "";
      statRow.innerHTML = '<div class="stat-card"><div class="label">No data</div>' +
        '<div class="value">—</div><div class="sublabel">No data for this date.</div></div>';
      chart.innerHTML = "";
      tableBody.innerHTML = "";
      return;
    }

    crumb.textContent = site.name + " · " + formatDateLong(date);
    chartSubtitle.textContent = dateSeries.t.length + " intervals · Europe/Amsterdam";

    var dayStats = ConsumptionCalc.computeDayStats(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    var daySeries = ConsumptionCalc.computeIntervalSeries(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    renderStatCards(dayStats);

    chart.innerHTML = buildChartSvg(dateSeries.t, siteSeries.c, siteSeries.g);
    renderTable(dateSeries.t, siteSeries.c, siteSeries.g, dateSeries.p, daySeries);
  }

  siteSelect.addEventListener("change", render);
  dateInput.addEventListener("change", render);
  monthSelect.addEventListener("change", render);
  render();
})();
```

Note: neither the Find nor the Replace text above includes the trailing
`</script>` tag — it isn't part of either block, since it appears
immediately after `})();` in the file already and Step 2 doesn't touch it.
Leave it exactly where it is; do not add a second `</script>` after the
Replace text.

- [ ] **Step 3: Regenerate and smoke-check**

Run: `python3 generate_consumption_data.py`

Then structurally verify:

```bash
grep -c 'month-chart\|chart-tab\|month-select' "Customer Portal - Consumption (Live Data).html"
python3 -c "
import re, json
with open('Customer Portal - Consumption (Live Data).html', encoding='utf-8') as f:
    html = f.read()
assert 'buildMonthChartSvg' in html
assert 'concatMonthData' in html
assert html.count('__DATA_JSON__') == 0 and html.count('__CALC_JS__') == 0
print('month-view structural check OK')
"
```

Expected: non-zero counts, and the script prints `month-view structural check OK`.

- [ ] **Step 4: Run the existing test suites (regression check)**

Run: `python3 -m unittest test_generate_consumption_data -v` — expect `OK`, 9/9.
Run: `node consumption-calc.test.js` — expect all assertions passed.
Run: `python3 verify_consumption_page.py` — expect all checks passed.

- [ ] **Step 5: Commit**

```bash
git add generate_consumption_data.py "consumption_live_data.json" "Customer Portal - Consumption (Live Data).html"
git commit -m "Add Month view (line/area chart, month selector, table follows chart mode)"
```

---

### Task 5: Hedge data integrity check (`verify_consumption_page.py`)

**Files:**
- Modify: `verify_consumption_page.py`

**Interfaces:** none new — extends the existing `main()` with one additional check function.

This check verifies the *embedded hedge data* is complete and correct (a data-integrity check, independent of the JS runtime, which isn't available in Python) — the *formulas* themselves are already directly unit tested in Task 2's `consumption-calc.test.js`. Together, these two give end-to-end confidence without needing a browser: correct formulas (Node tests) applied to correct embedded data (this check).

- [ ] **Step 1: Add the hedge check**

Find:

```python
EXPECTED_DATES = 217
EXPECTED_SITES = ["rot", "venlo", "tilburg", "almere", "unnamed", "breda"]
DST_SHORT_DAY = "2026-03-29"
REGULAR_DAY = "2026-08-05"
```

Replace with:

```python
EXPECTED_DATES = 217
EXPECTED_SITES = ["rot", "venlo", "tilburg", "almere", "unnamed", "breda"]
DST_SHORT_DAY = "2026-03-29"
REGULAR_DAY = "2026-08-05"

EXPECTED_HEDGE_ROT = [
    {"shape": "base", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.07},
    {"shape": "peak", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.095},
]
```

Then find:

```python
    assert dataset["byDate"][REGULAR_DAY]["t"] == expected_t, "%s time labels mismatch" % REGULAR_DAY

    print("verify_consumption_page.py: all checks passed (%d dates, %d sites)" %
          (len(dataset["byDate"]), len(dataset["sites"])))
```

Replace with:

```python
    assert dataset["byDate"][REGULAR_DAY]["t"] == expected_t, "%s time labels mismatch" % REGULAR_DAY

    assert dataset["hedge"]["rot"] == EXPECTED_HEDGE_ROT, \
        "rot hedge blocks mismatch: %s" % (dataset["hedge"]["rot"],)
    for site_id in EXPECTED_SITES:
        assert site_id in dataset["hedge"], "missing site %s in hedge" % site_id
        assert len(dataset["hedge"][site_id]) == 2, \
            "site %s should have 2 hedge blocks (base+peak), got %d" % (site_id, len(dataset["hedge"][site_id]))

    # 2026-08-03 is a Monday: weekday-peak interval (10:00) has both base+peak
    # active; an off-peak interval the same day (21:00) has base only.
    weekday_peak_hedge_kwh = 1000.0 * 0.25 + 1000.0 * 0.25
    weekday_peak_hedge_cost = 1000.0 * 0.25 * 0.07 + 1000.0 * 0.25 * 0.095
    assert abs(weekday_peak_hedge_kwh - 500.0) < 1e-9, "weekday-peak hedge volume formula check failed"
    assert abs(weekday_peak_hedge_cost - 41.25) < 1e-9, "weekday-peak hedge cost formula check failed"

    off_peak_hedge_kwh = 1000.0 * 0.25
    off_peak_hedge_cost = 1000.0 * 0.25 * 0.07
    assert abs(off_peak_hedge_kwh - 250.0) < 1e-9, "off-peak hedge volume formula check failed"
    assert abs(off_peak_hedge_cost - 17.5) < 1e-9, "off-peak hedge cost formula check failed"

    print("verify_consumption_page.py: all checks passed (%d dates, %d sites, hedge data verified)" %
          (len(dataset["byDate"]), len(dataset["sites"])))
```

- [ ] **Step 2: Run it**

Run: `python3 verify_consumption_page.py`
Expected: `verify_consumption_page.py: all checks passed (217 dates, 6 sites, hedge data verified)` with no `AssertionError`.

- [ ] **Step 3: Commit**

```bash
git add verify_consumption_page.py
git commit -m "Add hedge data integrity check to verify_consumption_page.py"
```

---

### Task 6: Documentation (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none (documentation only). No new files are added by this plan, so no new table rows are needed — only wording updates to existing rows/sections.

- [ ] **Step 1: Update two "Repository contents" table cells**

Find:

```markdown
| `hedge_blocks_2026.json` | ~5 KB | Test hedge/trade block data (Base & Peak shapes) per EAN, meant to back a future *Trading* screen — see "Hedge block test data" below. |
```

Replace with:

```markdown
| `hedge_blocks_2026.json` | ~5 KB | Test hedge/trade block data (Base & Peak shapes) per EAN — backs the hedge cost/coverage figures on the Consumption (Live Data) page (see below) and a future *Trading* screen — see "Hedge block test data" below. |
```

Find:

```markdown
| `consumption_live_data.json` | ~1.7 MB | Generated compact per-site/per-date consumption/production/EPEX data, embedded into the Live Data page. |
```

Replace with:

```markdown
| `consumption_live_data.json` | ~1.7 MB | Generated compact per-site/per-date consumption/production/EPEX data plus each site's hedge blocks, embedded into the Live Data page. |
```

(Leave the size figure as-is unless a fresh `ls -la` after Task 4's regeneration shows the rounded value has changed — check and update if so.)

- [ ] **Step 2: Rewrite the "Consumption (Live Data) page" section**

Find the entire section (from `## Consumption (Live Data) page` through the paragraph ending `...values matching the raw source rows exactly).` right before `## Conventions`):

```markdown
## Consumption (Live Data) page

`Customer Portal - Consumption (Live Data).html` (generated by
`generate_consumption_data.py`) is a standalone companion to the Customer
Portal mockup's *Consumption* screen — instead of the mockup's seeded
placeholder data, it reads real 15-minute consumption/production/EPEX data
straight from `epex_tariffs_usage_combined_15_min_interval.json` for a
connection and date picked from dropdowns (all 6 electricity sites; any
date 2026-01-01 through 2026-08-05). It doesn't modify or depend on
`Customer Portal - Preview.html` — that file stays a pure design mockup.

**Scope:** day-level view only (no Month/Quarter tabs, no hedge/block-cover
overlay from the mockup's Day tab — those aren't 15-minute series and
weren't asked for here). `tilburg-gas` is excluded — it has no usage rows.

**Data shape** (`consumption_live_data.json`, embedded inline in the HTML —
no `fetch`, no network requests, opens directly via `file://`):

```jsonc
{
  "sites": [{ "id": "rot", "ean": "871687100000000011", "name": "Rotterdam DC" }, "... 6 total"],
  "byDate": { "2026-01-01": { "t": ["00:00", "..."], "p": [0.0896, "..."] }, "... 217 dates" },
  "bySite": { "rot": { "2026-01-01": { "c": [612.4, "..."], "g": [0.0, "..."] } }, "... 6 sites" }
}
```

`byDate[date].t`/`.p` (local time-of-day, EPEX €/kWh) are stored once per
date and shared across sites; `bySite[id][date].c`/`.g` are per-site
consumption/production (kW), index-aligned with `byDate[date].t`. Array
length is 96 every day except 2026-03-29 (the spring-forward DST day),
which has 92.

**Calculations** (`consumption-calc.js`, unit tested via
`consumption-calc.test.js`): daily totals use `energy_kWh = power_kW ×
0.25` per interval; "Spot result" is the indicative €-cost of net
(consumption − production) at that day's EPEX prices, summed across
intervals. Numbers display NL-style (comma decimal, period thousands
separator).

**Regenerating:** `python3 generate_consumption_data.py` rebuilds both
`consumption_live_data.json` and the HTML page from the current combined
dataset; `python3 verify_consumption_page.py` cross-checks the result
against the source file (site/date coverage, DST-day interval count,
HTML-embedded data matching the standalone JSON, and one site/date's
values matching the raw source rows exactly).
```

Replace with:

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Document hedge columns, hover, and Month view in CLAUDE.md"
```

---

## Manual QA (not automated by this plan)

Same rationale as the prior plan — no headless-browser tooling in this
project. Automated checks (Tasks 1, 2, 5) cover the data pipeline and the
calc formulas directly; the following needs a human (or a browser-driving
tool) to confirm:

- [ ] Open the regenerated HTML, confirm the 5 new table columns render
      with sensible values for the default (Rotterdam DC, latest date)
      view, and the 2 new + 1 renamed stat cards show plausible numbers.
- [ ] Hover over a bar in the Day chart; confirm the crosshair appears and
      the matching table row highlights and scrolls into view.
- [ ] Switch to Month view; confirm the month dropdown lists every month
      present in the data (including a "partial" label on August 2026),
      the chart renders as a scrollable line/area chart, and the table
      lists that whole month's intervals.
- [ ] Hover over a point in the Month chart; confirm the same highlight/
      scroll behavior works against the now-much-longer table.
- [ ] Switch back to Day view; confirm the table reverts to a single day
      and the date input (not the month select) is visible again.
