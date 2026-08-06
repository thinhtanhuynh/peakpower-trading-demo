# Consumption (Live Data) Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new standalone page, `Customer Portal - Consumption (Live Data).html`, that shows real 15-minute consumption/production/EPEX-price data (from `epex_tariffs_usage_combined_15_min_interval.json`) for a selectable connection (EAN) and date, without touching the existing mockup files.

**Architecture:** A Python script (`generate_consumption_data.py`) transforms the 124,968-row combined dataset into a compact per-site/per-date JSON structure, then embeds that JSON plus a small pure-function JS calculation module (`consumption-calc.js`) into a hand-written, self-contained HTML page. The pure logic (data grouping in Python, stat/format math in JS) is unit tested directly; the assembled artifacts are checked with an integration script that cross-validates them against the original source data.

**Tech Stack:** Python 3 (stdlib only: `json`, `unittest`, `collections`, `re`, `os` — no new dependencies), vanilla JS (no framework, no build step), Node.js (already installed, used only to run the plain-`assert`-based JS tests — not a runtime dependency of the shipped page).

## Global Constraints

- Verified date range in the actual data is **2026-01-01 through 2026-08-05 inclusive (217 dates)** — confirmed directly against both `epex_tariffs_15_min_interval.json` and the combined file. (`CLAUDE.md`'s EPEX tariff section currently says "2026-01-16 through 2026-08-05," which is stale/incorrect; Task 5 corrects it.)
- Exactly 6 electricity sites are in scope: `rot` (871687100000000011), `venlo` (871687100000000027), `tilburg` (871687100000000043), `almere` (871687100000000059), `unnamed` (871687100000000061), `breda` (871687100000000078). `tilburg-gas` (871687100000000092) is excluded — it has no usage rows.
- kWh conversion for every interval, including the 92-interval DST day (2026-03-29): `energy_kWh = power_kW × 0.25`.
- Rounding before embedding: consumption/production to 1 decimal (kW), EPEX price to 4 decimals (€/kWh).
- Display number formatting is NL-style: comma decimal separator, period thousands separator (e.g. `1.234,5`).
- The final HTML page makes **no network requests** — data JSON and calc JS are both embedded inline so it opens correctly via `file://` with no server.
- Every new file gets a row in `CLAUDE.md`'s "Repository contents" table, per existing repo convention.

---

### Task 1: Compact dataset builder (`generate_consumption_data.py`)

**Files:**
- Create: `generate_consumption_data.py`
- Test: `test_generate_consumption_data.py`

**Interfaces:**
- Produces: `SITE_META` — list of 6 dicts `{"id": str, "ean": str, "name": str}`, in this exact order: `rot`, `venlo`, `tilburg`, `almere`, `unnamed`, `breda`.
- Produces: `build_compact_dataset(rows: list[dict]) -> dict` returning:
  ```
  {
    "sites": SITE_META,
    "byDate": { "<delivery_day>": {"t": [<"HH:MM">, ...], "p": [<float>, ...]} },
    "bySite": { "<site id>": { "<delivery_day>": {"c": [<float>, ...], "g": [<float>, ...]} } }
  }
  ```
  Rows whose `EAN` isn't one of the 6 in `SITE_META` are silently skipped. Within a `(site, date)` group, rows are sorted by `isp` before building the arrays. `byDate[date]` is populated once (from whichever site's rows are encountered first for that date) since time-of-day and EPEX price don't vary by site.

- [ ] **Step 1: Write the failing tests**

Create `test_generate_consumption_data.py`:

```python
import unittest
from generate_consumption_data import build_compact_dataset, SITE_META

ROT_EAN = SITE_META[0]["ean"]        # rot
VENLO_EAN = SITE_META[1]["ean"]      # venlo
UNKNOWN_EAN = "999999999999999999"   # not in SITE_META (e.g. tilburg-gas)


def make_row(ean, date, isp, hhmm, epex, consumption, production):
    return {
        "EAN": ean,
        "delivery_day": date,
        "isp": isp,
        "timestamp": "%s %s:00.000000" % (date, hhmm),
        "epex": epex,
        "consumption": consumption,
        "production": production,
    }


class BuildCompactDatasetTests(unittest.TestCase):
    def test_groups_by_site_and_date(self):
        rows = [
            make_row(ROT_EAN, "2026-01-01", 1, "00:00", 0.1000, 100.0, 0.0),
            make_row(ROT_EAN, "2026-01-01", 2, "00:15", 0.2000, 200.0, 10.0),
        ]
        result = build_compact_dataset(rows)
        self.assertEqual(result["byDate"]["2026-01-01"]["t"], ["00:00", "00:15"])
        self.assertEqual(result["byDate"]["2026-01-01"]["p"], [0.1, 0.2])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["c"], [100.0, 200.0])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["g"], [0.0, 10.0])

    def test_sorts_by_isp_even_if_input_unordered(self):
        rows = [
            make_row(ROT_EAN, "2026-01-01", 2, "00:15", 0.2000, 200.0, 0.0),
            make_row(ROT_EAN, "2026-01-01", 1, "00:00", 0.1000, 100.0, 0.0),
        ]
        result = build_compact_dataset(rows)
        self.assertEqual(result["byDate"]["2026-01-01"]["t"], ["00:00", "00:15"])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["c"], [100.0, 200.0])

    def test_rounds_consumption_production_and_price(self):
        rows = [make_row(ROT_EAN, "2026-01-01", 1, "00:00", 0.089621, 612.449, 0.049)]
        result = build_compact_dataset(rows)
        self.assertEqual(result["byDate"]["2026-01-01"]["p"], [0.0896])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["c"], [612.4])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["g"], [0.0])

    def test_unknown_ean_is_ignored(self):
        rows = [make_row(UNKNOWN_EAN, "2026-01-01", 1, "00:00", 0.1, 1.0, 0.0)]
        result = build_compact_dataset(rows)
        self.assertEqual(result["byDate"], {})
        for site_dates in result["bySite"].values():
            self.assertEqual(site_dates, {})

    def test_multiple_sites_share_date_but_have_own_series(self):
        rows = [
            make_row(ROT_EAN, "2026-01-01", 1, "00:00", 0.10, 100.0, 0.0),
            make_row(VENLO_EAN, "2026-01-01", 1, "00:00", 0.10, 500.0, 0.0),
        ]
        result = build_compact_dataset(rows)
        self.assertEqual(len(result["byDate"]), 1)
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["c"], [100.0])
        self.assertEqual(result["bySite"]["venlo"]["2026-01-01"]["c"], [500.0])

    def test_sites_list_matches_meta(self):
        result = build_compact_dataset([])
        self.assertEqual(result["sites"], SITE_META)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests, confirm they fail with an import error**

Run: `python3 -m unittest test_generate_consumption_data -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'generate_consumption_data'` (the file doesn't exist yet).

- [ ] **Step 3: Write `generate_consumption_data.py` (data layer only for now)**

```python
"""
Builds the compact live-data JSON for the Consumption (Live Data) page, and
assembles the final self-contained HTML page from it.

Input:  epex_tariffs_usage_combined_15_min_interval.json
Output: consumption_live_data.json
        Customer Portal - Consumption (Live Data).html

Re-runnable: pure transform of the combined dataset, no randomness.
"""
import json
import os
from collections import defaultdict

SITE_META = [
    {"id": "rot",     "ean": "871687100000000011", "name": "Rotterdam DC"},
    {"id": "venlo",   "ean": "871687100000000027", "name": "Venlo cold store"},
    {"id": "tilburg", "ean": "871687100000000043", "name": "Tilburg plant"},
    {"id": "almere",  "ean": "871687100000000059", "name": "Almere office"},
    {"id": "unnamed", "ean": "871687100000000061", "name": "— no name set —"},
    {"id": "breda",   "ean": "871687100000000078", "name": "Breda warehouse"},
]

HERE = os.path.dirname(os.path.abspath(__file__))
COMBINED_PATH = os.path.join(HERE, "epex_tariffs_usage_combined_15_min_interval.json")
DATA_OUT_PATH = os.path.join(HERE, "consumption_live_data.json")
CALC_JS_PATH = os.path.join(HERE, "consumption-calc.js")
HTML_OUT_PATH = os.path.join(HERE, "Customer Portal - Consumption (Live Data).html")


def build_compact_dataset(rows):
    """Group raw combined-file rows into the compact {sites, byDate, bySite} shape.

    Rows for EANs not in SITE_META are ignored (e.g. the non-electricity
    tilburg-gas connection, which has no rows anyway).
    """
    ean_to_meta = {m["ean"]: m for m in SITE_META}
    grouped = defaultdict(list)
    for r in rows:
        meta = ean_to_meta.get(r["EAN"])
        if meta is None:
            continue
        grouped[(meta["id"], r["delivery_day"])].append(r)

    by_date = {}
    by_site = {m["id"]: {} for m in SITE_META}

    for (site_id, date), day_rows in grouped.items():
        day_rows.sort(key=lambda r: r["isp"])
        if date not in by_date:
            by_date[date] = {
                "t": [r["timestamp"][11:16] for r in day_rows],
                "p": [round(r["epex"], 4) for r in day_rows],
            }
        by_site[site_id][date] = {
            "c": [round(r["consumption"], 1) for r in day_rows],
            "g": [round(r["production"], 1) for r in day_rows],
        }

    return {"sites": SITE_META, "byDate": by_date, "bySite": by_site}


if __name__ == "__main__":
    pass  # main() is added in Task 3
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `python3 -m unittest test_generate_consumption_data -v`
Expected: `OK` — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add generate_consumption_data.py test_generate_consumption_data.py
git commit -m "Add compact dataset builder for the Consumption (Live Data) page"
```

---

### Task 2: Pure calculation/formatting module (`consumption-calc.js`)

**Files:**
- Create: `consumption-calc.js`
- Test: `consumption-calc.test.js`

**Interfaces:**
- Produces: `ConsumptionCalc.computeDayStats(times: string[], prices: number[], consumption: number[], production: number[]) -> {consumptionKwh: number, productionKwh: number, netKwh: number, peakKw: number, peakTime: string, spotResultEur: number}`.
- Produces: `ConsumptionCalc.formatNL(value: number, decimals: number) -> string` (comma decimal separator, period thousands separator, leading `-` for negatives).
- Loadable both via Node (`require("./consumption-calc.js")`) and as a plain `<script>` in a browser (attaches `window.ConsumptionCalc`) — this dual-mode wrapper is what Task 3's HTML template relies on.

- [ ] **Step 1: Write the failing test**

Create `consumption-calc.test.js`:

```js
var assert = require("assert");
var ConsumptionCalc = require("./consumption-calc.js");

function assertClose(actual, expected, message) {
  var epsilon = 1e-9;
  assert.ok(Math.abs(actual - expected) < epsilon,
    (message || "") + " expected " + expected + " got " + actual);
}

// computeDayStats: totals, peak, spot result
(function () {
  var times = ["00:00", "00:15"];
  var prices = [0.10, 0.20];
  var consumption = [100, 200];
  var production = [0, 50];
  var stats = ConsumptionCalc.computeDayStats(times, prices, consumption, production);

  assertClose(stats.consumptionKwh, 75, "consumptionKwh");
  assertClose(stats.productionKwh, 12.5, "productionKwh");
  assertClose(stats.netKwh, 62.5, "netKwh");
  assert.strictEqual(stats.peakKw, 200, "peakKw");
  assert.strictEqual(stats.peakTime, "00:15", "peakTime");
  assertClose(stats.spotResultEur, 10, "spotResultEur");
})();

// computeDayStats: net exporter (production > consumption) gives negative net/spot result
(function () {
  var stats = ConsumptionCalc.computeDayStats(["12:00"], [0.10], [50], [200]);
  assertClose(stats.netKwh, -37.5, "netKwh (exporter)");
  assertClose(stats.spotResultEur, -3.75, "spotResultEur (exporter)");
})();

// formatNL: comma decimal, dot thousands, negative sign
(function () {
  assert.strictEqual(ConsumptionCalc.formatNL(612.4, 1), "612,4");
  assert.strictEqual(ConsumptionCalc.formatNL(1234.5, 1), "1.234,5");
  assert.strictEqual(ConsumptionCalc.formatNL(-62.5, 1), "-62,5");
  assert.strictEqual(ConsumptionCalc.formatNL(0.0896, 4), "0,0896");
  assert.strictEqual(ConsumptionCalc.formatNL(0, 1), "0,0");
})();

console.log("consumption-calc.test.js: all assertions passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node consumption-calc.test.js`
Expected: FAIL — `Error: Cannot find module './consumption-calc.js'`.

- [ ] **Step 3: Write `consumption-calc.js`**

```js
(function (root) {
  "use strict";

  function computeDayStats(times, prices, consumption, production) {
    var n = times.length;
    var consumptionKwh = 0;
    var productionKwh = 0;
    var spotResultEur = 0;
    var peakKw = -Infinity;
    var peakTime = null;

    for (var i = 0; i < n; i++) {
      var c = consumption[i];
      var g = production[i];
      var net = c - g;
      consumptionKwh += c * 0.25;
      productionKwh += g * 0.25;
      spotResultEur += net * 0.25 * prices[i];
      if (c > peakKw) {
        peakKw = c;
        peakTime = times[i];
      }
    }

    return {
      consumptionKwh: consumptionKwh,
      productionKwh: productionKwh,
      netKwh: consumptionKwh - productionKwh,
      peakKw: peakKw,
      peakTime: peakTime,
      spotResultEur: spotResultEur
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
git commit -m "Add pure JS calc/format module for the Consumption (Live Data) page"
```

---

### Task 3: Assemble the page and generate the real artifacts

**Files:**
- Modify: `generate_consumption_data.py` (add `PAGE_TEMPLATE`, `render_html()`, `main()`)
- Create (generated, not hand-written): `consumption_live_data.json`, `Customer Portal - Consumption (Live Data).html`

**Interfaces:**
- Consumes: `build_compact_dataset` (Task 1), `consumption-calc.js` file contents (Task 2).
- Produces: `render_html(data_json_text: str, calc_js_text: str) -> str` — returns the full HTML document text with both placeholders substituted. `main()` — reads the combined JSON, writes `consumption_live_data.json`, reads `consumption-calc.js`, writes the final HTML.
- This task's correctness is validated end-to-end by Task 4 (there's no isolated unit test for `render_html`/`main` beyond the smoke check in Step 3 below, since they're I/O glue around already-tested logic).

- [ ] **Step 1: Add `PAGE_TEMPLATE` and `render_html()` to `generate_consumption_data.py`**

Append to `generate_consumption_data.py` (before the `if __name__ == "__main__":` line):

```python
PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Consumption — Live Data · PeakPower Customer Portal</title>
<style>
  :root {
    --pp-bg:#eef2f6; --pp-surface:#ffffff; --pp-surface-alt:#f8fafc; --pp-surface-zebra:#fbfdff;
    --pp-border:#dbe3ec; --pp-border-strong:#c3cede;
    --pp-text-heading:#0f172a; --pp-text-body:#64748b; --pp-text-faint:#94a3b8;
    --pp-sidebar-bg:#0f2b33; --pp-sidebar-text:#cbd5e1; --pp-sidebar-text-active:#ffffff;
    --pp-sidebar-subtitle:#5eead4; --pp-sidebar-active-bg:rgba(20,184,166,0.16);
    --pp-teal-700:#0f766e; --pp-teal-600:#0d9488; --pp-teal-500:#14b8a6;
    --pp-green:#15803d; --pp-red:#dc2626; --pp-cyan:#0891b2;
    --pp-indigo:#4f46e5; --pp-indigo-bg:#e0e7ff;
    --font-sans:'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;
    --font-mono:'SF Mono','Cascadia Mono',Menlo,Consolas,monospace;
  }
  * { box-sizing: border-box; }
  body { margin:0; font-family: var(--font-sans); background: var(--pp-bg); color: var(--pp-text-heading); }
  .app { display:flex; height:100vh; width:100%; overflow:hidden; }
  .sidebar { width:218px; min-width:218px; background:var(--pp-sidebar-bg); color:var(--pp-sidebar-text); display:flex; flex-direction:column; padding:20px 0; }
  .sidebar .brand { padding:0 20px 20px; font-size:11px; letter-spacing:.05em; color:var(--pp-sidebar-subtitle); font-weight:700; text-transform:uppercase; }
  .sidebar nav { display:flex; flex-direction:column; gap:2px; padding:0 10px; }
  .sidebar nav a { display:block; padding:9px 12px; border-radius:7px; font-size:13px; color:var(--pp-sidebar-text); text-decoration:none; }
  .sidebar nav a.active { background:var(--pp-sidebar-active-bg); color:var(--pp-sidebar-text-active); font-weight:600; }
  .main { flex:1; display:flex; flex-direction:column; overflow:auto; }
  .topbar { height:56px; min-height:56px; background:#fff; border-bottom:1px solid var(--pp-border); display:flex; align-items:center; justify-content:space-between; padding:0 28px; position:sticky; top:0; z-index:5; }
  .topbar .crumb { font-size:11px; color:var(--pp-text-body); }
  .topbar .title { font-size:17px; font-weight:700; color:var(--pp-text-heading); margin-top:2px; }
  .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:10.5px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; }
  .badge.info { background:var(--pp-indigo-bg); color:var(--pp-indigo); }
  .content { padding:28px; display:flex; flex-direction:column; gap:16px; }
  .controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  select, input[type=date] { border:1px solid var(--pp-border-strong); border-radius:7px; padding:7px 10px; font-size:12.5px; color:var(--pp-text-heading); background:#fff; font-family:var(--font-sans); }
  .stat-row { display:flex; gap:14px; flex-wrap:wrap; }
  .stat-card { background:#fff; border:1px solid var(--pp-border); border-radius:8px; padding:12px 14px; min-width:160px; flex:1; }
  .stat-card .label { font-size:10.5px; font-weight:700; letter-spacing:.04em; color:var(--pp-text-body); text-transform:uppercase; }
  .stat-card .value { font-size:20px; font-weight:700; margin-top:6px; color:var(--pp-text-heading); }
  .stat-card .value.critical { color:var(--pp-red); }
  .stat-card .value.success { color:var(--pp-green); }
  .stat-card .value.export { color:var(--pp-cyan); }
  .stat-card .sublabel { font-size:11px; color:var(--pp-text-faint); margin-top:4px; }
  .card { background:#fff; border:1px solid var(--pp-border); border-radius:10px; padding:16px 18px; }
  .card .card-title { font-size:14px; font-weight:700; color:var(--pp-text-heading); }
  .card .card-subtitle { font-size:11.5px; color:var(--pp-text-body); margin-top:2px; margin-bottom:10px; }
  .legend { display:flex; gap:22px; margin-top:10px; font-size:11px; color:var(--pp-text-body); flex-wrap:wrap; }
  .legend .swatch { width:12px; height:10px; display:inline-block; border-radius:2px; margin-right:6px; vertical-align:middle; }
  .table-wrap { max-height:420px; overflow:auto; border:1px solid var(--pp-border); border-radius:8px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  thead th { position:sticky; top:0; background:var(--pp-surface-alt); text-align:left; padding:9px 14px; font-size:10.5px; font-weight:700; color:var(--pp-text-body); letter-spacing:.03em; border-bottom:1px solid var(--pp-border); text-transform:uppercase; }
  thead th.num, td.num { text-align:right; }
  tbody td { padding:6px 14px; border-bottom:1px solid var(--pp-border); }
  tbody tr:nth-child(even) { background:var(--pp-surface-zebra); }
  td.net-export { color:var(--pp-cyan); font-weight:600; }
</style>
</head>
<body>
<div class="app">
  <div class="sidebar">
    <div class="brand">Customer portal</div>
    <nav>
      <a>Dashboard</a>
      <a>Connections</a>
      <a class="active">Consumption</a>
      <a>Prices</a>
      <a>Trading</a>
      <a>Wallet</a>
      <a>Invoices</a>
    </nav>
  </div>
  <div class="main">
    <div class="topbar">
      <div>
        <div class="crumb" id="crumb"></div>
        <div class="title">Consumption</div>
      </div>
      <span class="badge info">Generated test data</span>
    </div>
    <div class="content">
      <div class="controls">
        <select id="site-select"></select>
        <input type="date" id="date-input" min="2026-01-01" max="2026-08-05">
      </div>
      <div class="stat-row" id="stat-row"></div>
      <div class="card">
        <div class="card-title">Consumption &amp; production — 15-minute intervals</div>
        <div class="card-subtitle" id="chart-subtitle"></div>
        <svg id="chart" viewBox="0 0 960 260" style="width:100%;height:260px;display:block"></svg>
        <div class="legend">
          <div><span class="swatch" style="background:var(--pp-teal-700)"></span>Consumption</div>
          <div><span class="swatch" style="background:var(--pp-green);height:2px"></span>Production (on-site generation)</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">15-minute interval detail</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th class="num">Consumption (kW)</th><th class="num">Production (kW)</th><th class="num">Net (kW)</th><th class="num">EPEX (€/kWh)</th></tr>
            </thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

<script>__CALC_JS__</script>
<script type="application/json" id="consumption-data">__DATA_JSON__</script>
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

  var DEFAULT_SITE = "rot";
  var DEFAULT_DATE = "2026-08-05";
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
</body>
</html>
"""


def render_html(data_json_text, calc_js_text):
    # Guard against the (currently impossible, but cheap to guard) case of a
    # "</script" sequence inside the embedded JSON breaking out of its tag.
    safe_data_json_text = data_json_text.replace("</", "<\\/")
    html = PAGE_TEMPLATE.replace("__CALC_JS__", calc_js_text)
    html = html.replace("__DATA_JSON__", safe_data_json_text)
    return html
```

- [ ] **Step 2: Add `main()` to `generate_consumption_data.py`**

Replace the `if __name__ == "__main__": pass` placeholder from Task 1 with:

```python
def main():
    with open(COMBINED_PATH, "r", encoding="utf-8") as f:
        rows = json.load(f)

    dataset = build_compact_dataset(rows)

    data_json_text = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"))
    with open(DATA_OUT_PATH, "w", encoding="utf-8") as f:
        f.write(data_json_text)
    print("Wrote %s (%d bytes)" % (DATA_OUT_PATH, len(data_json_text)))

    with open(CALC_JS_PATH, "r", encoding="utf-8") as f:
        calc_js_text = f.read()

    html = render_html(data_json_text, calc_js_text)
    with open(HTML_OUT_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print("Wrote %s (%d bytes)" % (HTML_OUT_PATH, len(html)))


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the generator and smoke-check the output**

Run: `python3 generate_consumption_data.py`
Expected: two "Wrote ..." lines; `consumption_live_data.json` in the low single-digit MB, the HTML file only slightly larger.

Then run a quick smoke check:

```bash
python3 -c "
import json
with open('consumption_live_data.json') as f:
    d = json.load(f)
print(len(d['sites']), len(d['byDate']), sorted(d['bySite'].keys()))
"
```
Expected: `6 217 ['almere', 'breda', 'rot', 'tilburg', 'unnamed', 'venlo']`

- [ ] **Step 4: Commit**

```bash
git add generate_consumption_data.py "consumption_live_data.json" "Customer Portal - Consumption (Live Data).html"
git commit -m "Generate the Consumption (Live Data) page from the combined dataset"
```

---

### Task 4: Integration verification against the source data

**Files:**
- Create: `verify_consumption_page.py`

**Interfaces:**
- Consumes: `consumption_live_data.json`, `Customer Portal - Consumption (Live Data).html`, `epex_tariffs_usage_combined_15_min_interval.json` (all from Task 3 / repo root).
- Produces: exits 0 and prints a summary line on success; raises `AssertionError` on any mismatch.

- [ ] **Step 1: Write `verify_consumption_page.py`**

```python
"""
Integration check for the generated Consumption (Live Data) artifacts.
Run after `python3 generate_consumption_data.py`.

Verifies:
  - consumption_live_data.json has all 6 sites and all 217 dates
  - the DST day (2026-03-29) has 92 intervals, a regular day has 96
  - the JSON embedded in the final HTML matches consumption_live_data.json exactly
  - one site/date's compact arrays match the raw combined source file exactly (rounded)
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(HERE, "consumption_live_data.json")
HTML_PATH = os.path.join(HERE, "Customer Portal - Consumption (Live Data).html")
COMBINED_PATH = os.path.join(HERE, "epex_tariffs_usage_combined_15_min_interval.json")

EXPECTED_DATES = 217
EXPECTED_SITES = ["rot", "venlo", "tilburg", "almere", "unnamed", "breda"]
DST_SHORT_DAY = "2026-03-29"
REGULAR_DAY = "2026-08-05"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_embedded_json(html_text):
    match = re.search(
        r'<script type="application/json" id="consumption-data">(.*?)</script>',
        html_text, re.S)
    assert match, "consumption-data script tag not found in HTML"
    return json.loads(match.group(1))


def main():
    dataset = load_json(DATA_PATH)

    assert sorted(s["id"] for s in dataset["sites"]) == sorted(EXPECTED_SITES), \
        "site id set mismatch: %s" % (dataset["sites"],)
    assert len(dataset["byDate"]) == EXPECTED_DATES, \
        "expected %d dates, got %d" % (EXPECTED_DATES, len(dataset["byDate"]))

    for site_id in EXPECTED_SITES:
        assert site_id in dataset["bySite"], "missing site %s in bySite" % site_id
        assert len(dataset["bySite"][site_id]) == EXPECTED_DATES, \
            "site %s has %d dates, expected %d" % (
                site_id, len(dataset["bySite"][site_id]), EXPECTED_DATES)

    assert len(dataset["byDate"][DST_SHORT_DAY]["t"]) == 92, \
        "DST day should have 92 intervals, got %d" % len(dataset["byDate"][DST_SHORT_DAY]["t"])
    assert len(dataset["byDate"][REGULAR_DAY]["t"]) == 96, \
        "%s should have 96 intervals, got %d" % (REGULAR_DAY, len(dataset["byDate"][REGULAR_DAY]["t"]))

    with open(HTML_PATH, "r", encoding="utf-8") as f:
        html_text = f.read()
    embedded = extract_embedded_json(html_text)
    assert embedded == dataset, "embedded HTML data does not match consumption_live_data.json"

    raw_rows = load_json(COMBINED_PATH)
    rot_rows = sorted(
        (r for r in raw_rows if r["EAN"] == "871687100000000011" and r["delivery_day"] == REGULAR_DAY),
        key=lambda r: r["isp"],
    )
    expected_c = [round(r["consumption"], 1) for r in rot_rows]
    expected_g = [round(r["production"], 1) for r in rot_rows]
    expected_p = [round(r["epex"], 4) for r in rot_rows]
    expected_t = [r["timestamp"][11:16] for r in rot_rows]

    actual = dataset["bySite"]["rot"][REGULAR_DAY]
    assert actual["c"] == expected_c, "rot/%s consumption mismatch" % REGULAR_DAY
    assert actual["g"] == expected_g, "rot/%s production mismatch" % REGULAR_DAY
    assert dataset["byDate"][REGULAR_DAY]["p"] == expected_p, "%s price mismatch" % REGULAR_DAY
    assert dataset["byDate"][REGULAR_DAY]["t"] == expected_t, "%s time labels mismatch" % REGULAR_DAY

    print("verify_consumption_page.py: all checks passed (%d dates, %d sites)" %
          (len(dataset["byDate"]), len(dataset["sites"])))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python3 verify_consumption_page.py`
Expected: `verify_consumption_page.py: all checks passed (217 dates, 6 sites)` with no `AssertionError`.

- [ ] **Step 3: Commit**

```bash
git add verify_consumption_page.py
git commit -m "Add integration verification for the Consumption (Live Data) page"
```

---

### Task 5: Documentation (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Add the 4 new rows to the "Repository contents" table**

In the table under `## Repository contents` (after the `gen_hedge.py` row), add:

```markdown
| `generate_consumption_data.py` | ~11 KB | Generator + page-assembly script for the Consumption (Live Data) page — see "Consumption (Live Data) page" below. Companion tests: `test_generate_consumption_data.py`, `consumption-calc.test.js`, `verify_consumption_page.py`. |
| `consumption-calc.js` | ~1 KB | Pure JS stat/formatting module used by the Consumption (Live Data) page (dual Node/browser module). |
| `consumption_live_data.json` | ~2 MB | Generated compact per-site/per-date consumption/production/EPEX data, embedded into the Live Data page. |
| `Customer Portal - Consumption (Live Data).html` | ~2 MB | Standalone, hand-written (not bundled/exported) page showing real 15-minute interval data for a selectable connection and date. |
```

(Adjust the size figures to the actual `ls -la` output once Task 3 has run.)

- [ ] **Step 2: Correct the stale EPEX date range in the "EPEX tariff data" section**

Find this sentence:
```markdown
Source file: `EPEX tariffs 15 min interval.csv` / `epex_tariffs_15_min_interval.json`.
20,828 rows, 2026-01-16 through 2026-08-05, one row per 15-minute interval.
```
Replace with (verified directly against the file: 217 distinct `delivery_day` values, min `2026-01-01`, max `2026-08-05`):
```markdown
Source file: `EPEX tariffs 15 min interval.csv` / `epex_tariffs_15_min_interval.json`.
20,828 rows, 2026-01-01 through 2026-08-05 (217 days), one row per 15-minute interval.
```

- [ ] **Step 3: Add a new "Consumption (Live Data) page" subsection**

Insert after the "Hedge block test data" section (before `## Conventions`):

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

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the Consumption (Live Data) page in CLAUDE.md"
```

---

## Manual QA (not automated by this plan)

Tasks 1–4 automate everything that's testable without a browser (data
transform, calc/format math, cross-checks against the source dataset).
The following is real UI/runtime behavior that needs a human (or a
browser-driving tool) to confirm, since no headless-browser tooling is
installed in this project and adding one would introduce a new dependency
outside this repo's "no build tooling" convention:

- [ ] Open `Customer Portal - Consumption (Live Data).html` directly in a
      browser (double-click / `open` on macOS) and confirm: no console
      errors, no network requests (Network tab stays empty), default view
      (Rotterdam DC, 2026-08-05) renders stat cards + chart + a 96-row table.
- [ ] Switch the connection dropdown and the date picker independently;
      confirm stat cards, chart, and table all update.
- [ ] Select 2026-03-29 (the DST day) and confirm the table shows 92 rows
      with no gaps or errors.
- [ ] Select a solar/CHP site (e.g. Tilburg plant or the unnamed
      greenhouse) on a sunny summer date and confirm the production line
      is visible against the consumption bars at a sensible scale.
